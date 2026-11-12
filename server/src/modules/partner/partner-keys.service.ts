import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { AccessLevel } from '../access-levels/entities/access-level.entity';
import { School } from '../schools/entities/school.entity';
import { Permission } from '../../common/constants/permissions.constant';
import { deriveKey } from '../../common/security/crypto';
import {
  PARTNER_SCOPES,
  PartnerApiKey,
  type PartnerScope,
} from './entities/partner-api-key.entity';
import {
  clamp,
  EMBED_LINK_TTL,
  EMBED_SESSION_MINUTES,
  embedPath,
  isSchoolView,
  schoolLocation,
  type EmbedClaims,
  type EmbedLinkPayload,
  type EmbedView,
} from './partner-embed';
import {
  accessOf,
  clampMapArea,
  MAX_ACCESS_SCHOOLS,
  PARTNER_ACCESS_TIERS,
  schoolInAccess,
  type PartnerAccess,
  type PartnerAccessTier,
} from './partner-access';
import { EMBED_VIEWS } from './partner-embed';

/** An access level as an admin sends it (create / edit a key). */
export interface AccessInput {
  accessTier?: string;
  accessProvince?: string | null;
  accessDistrict?: string | null;
  accessSchoolCodes?: string[] | null;
  allowedViews?: string[] | null;
}

const denied = (message: string) =>
  new ForbiddenException({
    statusCode: 403,
    code: 'PARTNER_ACCESS_DENIED',
    message,
  });

/** Read-only role every partner embed account has (national; narrowed per link). */
export const PARTNER_VIEWER_ROLE = 'partner_viewer';
export const PARTNER_VIEWER_PERMISSIONS: Permission[] = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_MAP,
  Permission.VIEW_SCHOOLS,
  Permission.VIEW_ANALYTICS,
  Permission.VIEW_INTELLIGENCE,
  Permission.SCHOOL_LEVEL_DASHBOARD,
  Permission.VIEW_POPULATION,
  Permission.VIEW_REPORTING,
  Permission.SCHOOL_VIEW_2D3D_MAP,
  Permission.USE_MEASURE_TOOLS,
];

const KEY_PREFIX = 'rtbgis_pk_';

export const hashKey = (raw: string) =>
  createHash('sha256').update(raw.trim()).digest('hex');

const ORIGIN_RE = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i;

export interface EmbedLinkRequest {
  view: EmbedView;
  schoolCode?: string;
  province?: string;
  district?: string;
  ttlSeconds?: number;
  sessionMinutes?: number;
}

@Injectable()
export class PartnerKeysService {
  constructor(
    @InjectRepository(PartnerApiKey)
    private readonly keys: Repository<PartnerApiKey>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(AccessLevel)
    private readonly levels: Repository<AccessLevel>,
    @InjectRepository(School) private readonly schools: Repository<School>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get linkSecret(): string {
    return deriveKey(
      this.config.get<string>('JWT_SECRET') ?? '',
      'rtb-gis/embed-link/v1',
    ).toString('hex');
  }

  /** Public URL of the web app (embed links point here). */
  get appUrl(): string {
    const explicit = (this.config.get<string>('APP_PUBLIC_URL') ?? '').trim();
    const first =
      (this.config.get<string>('APP_CORS_ORIGINS') ?? '')
        .split(',')[0]
        ?.trim() ?? '';
    return (explicit || first || 'http://localhost:5173').replace(/\/+$/, '');
  }

  // ── Keys ─────────────────────────────────────────────────────────────────

  list() {
    return this.keys.find({ order: { createdAt: 'DESC' } });
  }

  /** Creates a key; the raw key is returned once and never stored. */
  async create(
    input: {
      name: string;
      partner: string;
      scopes?: string[];
      allowedOrigins?: string[];
    } & AccessInput,
    by: string | null,
  ): Promise<{ key: PartnerApiKey; rawKey: string }> {
    const access = await this.validateAccess(input);
    const scopes = (
      input.scopes?.length ? input.scopes : [...PARTNER_SCOPES]
    ) as PartnerScope[];
    const bad = scopes.filter(
      (s) => !(PARTNER_SCOPES as readonly string[]).includes(s),
    );
    if (bad.length)
      throw new BadRequestException(`Unknown scope(s): ${bad.join(', ')}`);
    const origins = (input.allowedOrigins ?? [])
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    const badOrigins = origins.filter((o) => !ORIGIN_RE.test(o));
    if (badOrigins.length)
      throw new BadRequestException(
        `Origins must look like https://example.org: ${badOrigins.join(', ')}`,
      );

    const rawKey = KEY_PREFIX + randomBytes(32).toString('hex');
    const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 6);
    const serviceUser = await this.createServiceUser(input.partner, keyPrefix);
    const key = await this.keys.save(
      this.keys.create({
        name: input.name.trim(),
        partner: input.partner.trim(),
        keyPrefix,
        keyHash: hashKey(rawKey),
        scopes,
        allowedOrigins: origins,
        ...access,
        serviceUserId: serviceUser.id,
        createdBy: by,
        lastUsedAt: null,
        revokedAt: null,
        revokedBy: null,
      }),
    );
    return { key, rawKey };
  }

  /** Revokes a key and deactivates its embed account (live sessions end). */
  async revoke(id: string, by: string | null): Promise<PartnerApiKey> {
    const key = await this.keys.findOne({ where: { id } });
    if (!key) throw new NotFoundException('Partner key not found');
    if (!key.revokedAt) {
      key.revokedAt = new Date();
      key.revokedBy = by;
      await this.keys.save(key);
      await this.users.update(key.serviceUserId, { isActive: false });
    }
    return key;
  }

  /**
   * Changes a key's access level. The key moves to a fresh partner account
   * and the old one is deactivated, so views opened under the old access end
   * at once (and links signed before the change no longer open, see
   * openEmbedSession).
   */
  async updateAccess(id: string, input: AccessInput): Promise<PartnerApiKey> {
    const key = await this.keys.findOne({ where: { id } });
    if (!key) throw new NotFoundException('Partner key not found');
    if (key.revokedAt) throw new BadRequestException('This key is revoked.');
    const access = await this.validateAccess(input);
    const fresh = await this.createServiceUser(
      key.partner,
      `${key.keyPrefix.slice(0, KEY_PREFIX.length)}${randomBytes(3).toString('hex')}`,
    );
    await this.users.update(key.serviceUserId, { isActive: false });
    Object.assign(key, access, { serviceUserId: fresh.id });
    return this.keys.save(key);
  }

  /** Checks an access level against the school data and normalises it. */
  private async validateAccess(input: AccessInput) {
    const tier = (input.accessTier ?? 'national') as PartnerAccessTier;
    if (!(PARTNER_ACCESS_TIERS as readonly string[]).includes(tier))
      throw new BadRequestException(
        `accessTier must be one of ${PARTNER_ACCESS_TIERS.join(', ')}`,
      );
    const views = (input.allowedViews ?? [])
      .map((v) => v.trim())
      .filter(Boolean);
    const badViews = views.filter(
      (v) => !(EMBED_VIEWS as readonly string[]).includes(v),
    );
    if (badViews.length)
      throw new BadRequestException(`Unknown view(s): ${badViews.join(', ')}`);
    const province = input.accessProvince?.trim() || null;
    const district = input.accessDistrict?.trim() || null;
    const codes = [
      ...new Set(
        (input.accessSchoolCodes ?? []).map((c) => c.trim()).filter(Boolean),
      ),
    ];
    const count = (where: string, params: Record<string, unknown>) =>
      this.schools.createQueryBuilder('s').where(where, params).getCount();

    if (tier === 'province') {
      if (!province)
        throw new BadRequestException(
          'A province is required for a province key.',
        );
      if (!(await count('LOWER(s.province) = LOWER(:p)', { p: province })))
        throw new BadRequestException(
          `No school in RTB GIS is in province "${province}".`,
        );
    }
    if (tier === 'district') {
      if (!district)
        throw new BadRequestException(
          'A district is required for a district key.',
        );
      const n = await count(
        province
          ? 'LOWER(s.district) = LOWER(:d) AND LOWER(s.province) = LOWER(:p)'
          : 'LOWER(s.district) = LOWER(:d)',
        { d: district, p: province },
      );
      if (!n)
        throw new BadRequestException(
          `No school in RTB GIS is in district "${district}"${province ? ` (${province})` : ''}.`,
        );
    }
    if (tier === 'schools') {
      if (!codes.length)
        throw new BadRequestException('List at least one school code.');
      if (codes.length > MAX_ACCESS_SCHOOLS)
        throw new BadRequestException(
          `At most ${MAX_ACCESS_SCHOOLS} schools per key.`,
        );
      const found = await this.schools
        .createQueryBuilder('s')
        .select(['s.code', 's.tdmpSchoolCode'])
        .where('s."tdmpSchoolCode" IN (:...c) OR s.code IN (:...c)', {
          c: codes,
        })
        .getMany();
      const known = new Set(
        found.flatMap((s) =>
          [s.code, s.tdmpSchoolCode]
            .filter(Boolean)
            .map((c) => String(c).toLowerCase()),
        ),
      );
      const unknown = codes.filter((c) => !known.has(c.toLowerCase()));
      if (unknown.length)
        throw new BadRequestException(
          `Unknown school code(s): ${unknown.join(', ')}`,
        );
    }
    return {
      accessTier: tier,
      accessProvince:
        tier === 'province' || tier === 'district' ? province : null,
      accessDistrict: tier === 'district' ? district : null,
      accessSchoolCodes: tier === 'schools' ? codes : null,
      allowedViews: views.length === EMBED_VIEWS.length ? [] : views,
    };
  }

  /** The active key for a raw value, or null. Touches lastUsedAt (≤ once a minute). */
  async verify(raw: string | undefined | null): Promise<PartnerApiKey | null> {
    if (!raw || !raw.startsWith(KEY_PREFIX)) return null;
    const key = await this.keys.findOne({
      where: { keyHash: hashKey(raw), revokedAt: IsNull() },
    });
    if (!key) return null;
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
      key.lastUsedAt = new Date();
      await this.keys.update(key.id, { lastUsedAt: key.lastUsedAt });
    }
    return key;
  }

  private async ensureViewerRole(): Promise<Role> {
    const existing = await this.roles.findOne({
      where: { name: PARTNER_VIEWER_ROLE },
    });
    if (existing) return existing;
    const national = await this.levels.findOne({ where: { slug: 'national' } });
    return this.roles.save(
      this.roles.create({
        name: PARTNER_VIEWER_ROLE,
        description:
          'Read-only account behind a partner key (TDMP embeds). Each embed link narrows it to one school or area.',
        permissions: PARTNER_VIEWER_PERMISSIONS,
        accessLevel: national ?? undefined,
      }),
    );
  }

  private async createServiceUser(
    partner: string,
    keyPrefix: string,
  ): Promise<User> {
    const role = await this.ensureViewerRole();
    const slug =
      partner
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'partner';
    return this.users.save(
      this.users.create({
        firstName: partner.trim(),
        lastName: 'embed viewer',
        // .invalid is reserved: it can never receive mail or pass Google sign-in.
        email: `${slug}.${keyPrefix.slice(KEY_PREFIX.length)}@partner.rtb-gis.invalid`,
        // Unusable: login() refuses partner accounts before checking it.
        password: randomBytes(48).toString('base64url'),
        role,
        isActive: true,
        authSource: 'partner',
        mustChangePassword: false,
        location: { tier: 'national' },
      }),
    );
  }

  // ── Embed links ──────────────────────────────────────────────────────────

  /** A signed, short-lived link to one view, for the partner's server to put in an iframe. */
  async createEmbedLink(key: PartnerApiKey, req: EmbedLinkRequest) {
    const access = accessOf(key);
    if (!access.views.includes(req.view))
      throw denied(`This key may not open the ${req.view} view.`);
    let claims: EmbedClaims;
    let schoolSummary: { id: string; code: string; name: string } | null = null;
    if (isSchoolView(req.view)) {
      const code = (req.schoolCode ?? '').trim();
      if (!code)
        throw new BadRequestException(
          'schoolCode is required for school views',
        );
      const school = await this.schools.findOne({
        where: [{ tdmpSchoolCode: code }, { code }],
        select: [
          'id',
          'code',
          'name',
          'province',
          'district',
          'sector',
          'tdmpSchoolCode',
        ],
      });
      // Outside the key's access: the school does not exist for this key.
      if (!school || !schoolInAccess(access, school))
        throw new NotFoundException(`No school with code ${code} in RTB GIS`);
      claims = {
        pk: key.id,
        view: req.view,
        sid: school.id,
        loc: schoolLocation(school),
      };
      schoolSummary = {
        id: school.id,
        code: school.tdmpSchoolCode ?? school.code,
        name: school.name,
      };
    } else {
      claims = {
        pk: key.id,
        view: req.view,
        loc: await this.mapArea(access, req),
      };
    }
    const ttl = clamp(req.ttlSeconds, EMBED_LINK_TTL);
    const smin = clamp(req.sessionMinutes, EMBED_SESSION_MINUTES);
    const payload: EmbedLinkPayload = {
      ...claims,
      typ: 'embed-link',
      smin,
      jti: randomUUID(),
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.linkSecret,
      expiresIn: ttl,
    });
    return {
      view: req.view,
      // In the fragment, not the query: never sent to servers or in Referer headers.
      url: `${this.appUrl}${embedPath(req.view, claims.sid)}#token=${token}`,
      token,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      sessionMinutes: smin,
      scope: claims.loc,
      school: schoolSummary,
    };
  }

  /** The national-map area for a request, never wider than the key. */
  private async mapArea(access: PartnerAccess, req: EmbedLinkRequest) {
    const clamped = clampMapArea(access, req);
    if (clamped.ok === true) return clamped.loc;
    if (clamped.ok === false) throw denied(clamped.reason);
    const n = await this.schools
      .createQueryBuilder('s')
      .where(
        'LOWER(s.district) = LOWER(:d) AND LOWER(s.province) = LOWER(:p)',
        { d: clamped.district, p: clamped.province },
      )
      .getCount();
    if (!n) throw denied(`${clamped.district} is not in ${clamped.province}.`);
    return {
      tier: 'district' as const,
      province: clamped.province,
      district: clamped.district,
    };
  }

  /** Whether a link's scope still fits the key's current access. */
  private async linkWithinAccess(
    access: PartnerAccess,
    link: EmbedClaims,
  ): Promise<boolean> {
    if (!access.views.includes(link.view)) return false;
    if (access.tier === 'national') return true;
    if (link.sid) {
      const school = await this.schools.findOne({
        where: { id: link.sid },
        select: ['id', 'code', 'tdmpSchoolCode', 'province', 'district'],
      });
      return !!school && schoolInAccess(access, school);
    }
    const loc = link.loc;
    const same = (a?: string | null, b?: string | null) =>
      (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
    if (access.tier === 'province')
      return loc.tier !== 'national' && same(loc.province, access.province);
    if (access.tier === 'district')
      return loc.tier === 'district' && same(loc.district, access.district);
    return false;
  }

  /**
   * Exchanges a link for a read-only session: an access token for the key's
   * embed account carrying the link's scope (`emb`).
   */
  async openEmbedSession(token: string) {
    let link: EmbedLinkPayload;
    try {
      link = await this.jwt.verifyAsync<EmbedLinkPayload>(token, {
        secret: this.linkSecret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'EMBED_LINK_INVALID',
        message: 'This embed link has expired or is not valid.',
      });
    }
    if (link.typ !== 'embed-link')
      throw new UnauthorizedException({
        code: 'EMBED_LINK_INVALID',
        message: 'Not an embed link.',
      });
    const key = await this.keys.findOne({
      where: { id: link.pk, revokedAt: IsNull() },
    });
    if (!key)
      throw new UnauthorizedException({
        code: 'EMBED_LINK_REVOKED',
        message: 'The partner key behind this link was revoked.',
      });
    // A link signed before the key's access was narrowed no longer opens.
    if (!(await this.linkWithinAccess(accessOf(key), link)))
      throw new UnauthorizedException({
        code: 'EMBED_LINK_REVOKED',
        message: "This view is no longer within the partner key's access.",
      });
    const user = await this.users.findOne({
      where: { id: key.serviceUserId, isActive: true },
      relations: ['role', 'role.accessLevel'],
    });
    if (!user || user.authSource !== 'partner')
      throw new UnauthorizedException({
        code: 'EMBED_LINK_REVOKED',
        message: 'The partner account is not active.',
      });

    const emb: EmbedClaims = {
      pk: link.pk,
      view: link.view,
      sid: link.sid,
      loc: link.loc,
    };
    const smin = clamp(link.smin, EMBED_SESSION_MINUTES);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, typ: 'access', emb },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: smin * 60 },
    );
    return {
      accessToken,
      expiresIn: smin * 60,
      user,
      emb,
      partner: key.partner,
    };
  }
}
