import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { TdmpConfig } from './tdmp.config';
import { TdmpApiClient, type TdmpEndpointCheck } from './tdmp-api.client';
import type { TdmpListMeta, TdmpSchool } from './tdmp.types';
import { TdmpOAuthClient } from './tdmp-oauth.client';

/** One TDMP endpoint and whether our key may read it. */
export interface EndpointStatus {
  key: string;
  label: string;
  path: string;
  /** HTTP status; 0 = TDMP not reachable. */
  status: number;
  ms: number;
  ok: boolean;
  /** The request in docs/TDMP_INTEGRATION_REQUESTS.md that unlocks it. */
  request?: string;
}

export type RequestState = 'done' | 'partial' | 'waiting' | 'manual';

/** Where one request to the TDMP team stands, as far as we can tell. */
export interface RequestStatus {
  id: string;
  title: string;
  priority: 'P1' | 'P2' | 'P3';
  state: RequestState;
  evidence: string;
}

/** Whether "Sign in with TDMP" can work with what is configured. */
export interface SignInReadiness {
  authMode: string;
  accessSource: 'local' | 'tdmp';
  clientConfigured: boolean;
  /** TDMP's answer to our client ID + secret; null = not configured. */
  credentials: 'accepted' | 'rejected' | 'unreachable' | null;
  /** RS256 keys published for ID tokens; null = not readable. */
  signingKeys: number | null;
  /** Discovery `issuer` equals TDMP_ISSUER / TDMP_BASE_URL. */
  issuerMatches: boolean | null;
  redirectUri: string;
  launchUrl: string;
  sessionMaxHours: number;
}

export interface ConnectionReport {
  checkedAt: string;
  signIn: SignInReadiness;
  configured: { apiKey: boolean; oauthClient: boolean; baseUrl: string };
  reachable: boolean;
  /** Key accepted on the school list. */
  authorised: boolean;
  latencyMs: number | null;
  tdmpMaterialisedAt: string | null;
  tvetSchools: number | null;
  endpoints: EndpointStatus[];
  requests: RequestStatus[];
}

const CACHE_MS = 5 * 60_000;

/** Endpoints the integration uses or waits for. `request` = what unlocks it. */
const ENDPOINTS: Array<
  Omit<EndpointStatus, 'status' | 'ms' | 'ok'> & {
    query?: Record<string, string>;
  }
> = [
  {
    key: 'schools',
    label: 'School list',
    path: '/schools',
    query: { limit: '1', categoryGroup: 'TVET' },
  },
  {
    key: 'tradesStudents',
    label: 'Learners per programme',
    path: '/reports/trades/students',
    request: 'R1',
  },
  {
    key: 'trades',
    label: 'Programme names',
    path: '/trades',
    query: { limit: '1' },
    request: 'R1',
  },
  {
    key: 'locations',
    label: 'Administrative units',
    path: '/locations/provinces',
    request: 'R1',
  },
  {
    key: 'discovery',
    label: 'Sign-in discovery (OIDC)',
    path: '/oauth/.well-known/openid-configuration',
  },
];

/** Checks TDMP: reachability, our key, and which pending requests are met. */
@Injectable()
export class TdmpConnectionService {
  private cache: { at: number; report: ConnectionReport } | null = null;

  constructor(
    private readonly config: TdmpConfig,
    private readonly api: TdmpApiClient,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly dataSource: DataSource,
    private readonly oauth: TdmpOAuthClient,
  ) {}

  private async signInReadiness(
    discovery: Record<string, unknown> | null,
    clientConfigured: boolean,
  ): Promise<SignInReadiness> {
    const [credentials, signingKeys] = await Promise.all([
      clientConfigured ? this.oauth.checkClientCredentials() : null,
      this.oauth.signingKeyCount(),
    ]);
    const strip = (v: unknown) =>
      typeof v === 'string' ? v.replace(/\/+$/, '') : '';
    return {
      authMode: this.config.authMode,
      accessSource: this.config.accessSource,
      clientConfigured,
      credentials,
      signingKeys,
      issuerMatches: discovery?.issuer
        ? strip(discovery.issuer) === strip(this.config.issuer)
        : null,
      redirectUri: this.config.redirectUri,
      launchUrl: `${this.config.appPublicUrl}/sso/tdmp`,
      sessionMaxHours: Math.round(this.config.sessionMaxMs / 3_600_000),
    };
  }

  async check(refresh = false): Promise<ConnectionReport> {
    if (!refresh && this.cache && Date.now() - this.cache.at < CACHE_MS)
      return this.cache.report;
    const report = await this.run();
    this.cache = { at: Date.now(), report };
    return report;
  }

  private async run(): Promise<ConnectionReport> {
    const configured = {
      apiKey: !!this.config.apiKey,
      oauthClient: !!this.config.clientId && !!this.config.clientSecret,
      baseUrl: this.config.baseUrl,
    };
    const results = new Map<string, TdmpEndpointCheck>();
    if (configured.apiKey) {
      const checks = await Promise.all(
        ENDPOINTS.map((e) => this.api.check(e.path, e.query)),
      );
      ENDPOINTS.forEach((e, i) => results.set(e.key, checks[i]));
    } else {
      results.set(
        'discovery',
        await this.api.check('/oauth/.well-known/openid-configuration'),
      );
    }
    // R3 (extra list fields) is judged on a page of the filtered list; R4
    // (data quality) on the whole list: placeholder rows have no TVET
    // category, so they never show up in the filtered one.
    const [sample, unfetchedRows, wholeList] = configured.apiKey
      ? await Promise.all([
          this.api.check('/schools', { limit: '100', categoryGroup: 'TVET' }),
          this.api.check('/schools', {
            limit: '1',
            schoolCategory: 'unfetched',
          }),
          this.api.check('/schools', { limit: '100' }),
        ])
      : [null, null, null];

    const endpoints: EndpointStatus[] = ENDPOINTS.filter((e) =>
      results.has(e.key),
    ).map((e) => {
      const r = results.get(e.key)!;
      return {
        key: e.key,
        label: e.label,
        path: e.path,
        status: r.status,
        ms: r.ms,
        ok: r.status >= 200 && r.status < 300,
        request: e.request,
      };
    });

    const list = results.get('schools');
    const listBody = list?.body as { meta?: TdmpListMeta } | null;
    const discovery = (results.get('discovery')?.body ?? null) as Record<
      string,
      unknown
    > | null;
    const rows = (sample?.body as { data?: TdmpSchool[] } | null)?.data ?? [];
    const allRows =
      (wholeList?.body as { data?: TdmpSchool[] } | null)?.data ?? [];
    const unfetched =
      unfetchedRows?.status === 200
        ? ((unfetchedRows.body as { meta?: TdmpListMeta })?.meta?.page?.total ??
          null)
        : null;

    const signIn = await this.signInReadiness(
      discovery,
      configured.oauthClient,
    );
    return {
      checkedAt: new Date().toISOString(),
      signIn,
      configured,
      reachable: endpoints.some((e) => e.status > 0),
      authorised: !!list && list.status === 200,
      latencyMs: list?.ms ?? null,
      tdmpMaterialisedAt: listBody?.meta?.lastMaterialisedAt ?? null,
      tvetSchools: listBody?.meta?.page?.total ?? null,
      endpoints,
      requests: await this.requests(endpoints, rows, discovery, signIn, {
        unfetched,
        sample: allRows,
      }),
    };
  }

  private async requests(
    endpoints: EndpointStatus[],
    rows: TdmpSchool[],
    discovery: Record<string, unknown> | null,
    signIn: SignInReadiness,
    quality: { unfetched: number | null; sample: TdmpSchool[] },
  ): Promise<RequestStatus[]> {
    const ok = (key: string) =>
      endpoints.find((e) => e.key === key)?.ok ?? false;
    const claims = Array.isArray(discovery?.claims_supported)
      ? (discovery.claims_supported as string[])
      : [];

    const r1 = ['tradesStudents', 'trades', 'locations'];
    const r1ok = r1.filter(ok).length;

    const r3fields = ['categoryBand', 'updatedAt'] as const;
    const r3have = r3fields.filter((f) => rows.some((r) => f in (r ?? {})));

    const unfetched = quality.unfetched;
    const mixedCase = quality.sample.filter(
      (r) =>
        typeof r.schoolStatus === 'string' &&
        r.schoolStatus !== r.schoolStatus.toUpperCase(),
    ).length;

    const mappedRoles = await this.roles
      .createQueryBuilder('r')
      .where('cardinality(r."tdmpRoleNames") > 0')
      .getCount()
      .catch(() => 0);

    // R15–R16: TDMP using the embedded views RTB GIS offers.
    const partner = await this.dataSource
      .query(
        `SELECT
           count(*) FILTER (WHERE "revokedAt" IS NULL AND 'embed:create' = ANY(scopes))::int AS embed_keys,
           (SELECT count(*)::int FROM audit_logs WHERE action = 'partner.embed_session') AS embed_sessions
         FROM partner_api_keys`,
      )
      .then((r: Array<Record<string, number>>) => r[0])
      .catch(() => null);

    const state = (done: boolean, partial = false): RequestState =>
      done ? 'done' : partial ? 'partial' : 'waiting';

    return [
      {
        id: 'R1',
        title:
          'Aggregate reports (learners per programme, programme names, units)',
        priority: 'P2',
        state: state(r1ok === r1.length, r1ok > 0),
        evidence: `${r1ok} of ${r1.length} endpoints readable with our key`,
      },
      {
        id: 'R2',
        title: 'Seat capacity per programme',
        priority: 'P1',
        state: 'waiting',
        evidence: 'No capacity field in the TDMP API yet',
      },
      {
        id: 'R3',
        title: 'Extra fields on the school list',
        priority: 'P2',
        state: rows.length
          ? state(r3have.length === r3fields.length, r3have.length > 0)
          : 'waiting',
        evidence: rows.length
          ? r3have.length
            ? `Present: ${r3have.join(', ')}`
            : 'categoryBand, updatedAt not on list rows'
          : 'School list not readable',
      },
      {
        id: 'R4',
        title: 'Data quality on the school list',
        priority: 'P2',
        state:
          unfetched === null
            ? 'waiting'
            : state(unfetched === 0 && mixedCase === 0),
        evidence:
          unfetched === null
            ? 'School list not readable'
            : `${unfetched} schools with category "unfetched" in TDMP; ${mixedCase} mixed-case status in the first ${quality.sample.length} rows`,
      },
      {
        id: 'R5',
        title: 'Change feed (updatedSince / webhook)',
        priority: 'P3',
        state: 'manual',
        evidence: 'Confirm with TDMP; the hourly probe covers it meanwhile',
      },
      {
        id: 'R6',
        title: 'Register RTB 3D GIS for "Sign in with TDMP"',
        priority: 'P1',
        // The TDMP SSO guide (§3) is a registration, not a POST we make;
        // done once TDMP accepts the client id and secret on our server.
        state: state(
          signIn.credentials === 'accepted' && (signIn.signingKeys ?? 0) > 0,
          signIn.clientConfigured,
        ),
        evidence: [
          !signIn.clientConfigured
            ? 'TDMP_OAUTH_CLIENT_ID / SECRET not set'
            : signIn.credentials === 'accepted'
              ? 'Client id and secret accepted by TDMP'
              : signIn.credentials === 'rejected'
                ? 'TDMP refuses the client id / secret (invalid_client)'
                : 'Client configured; TDMP not reachable to confirm it',
          signIn.signingKeys
            ? `${signIn.signingKeys} ID-token signing key(s) published`
            : 'ID-token signing keys not readable',
          signIn.issuerMatches === false
            ? 'issuer differs from TDMP_BASE_URL (set TDMP_ISSUER)'
            : null,
          `redirect URI ${signIn.redirectUri}`,
          `launch URL ${signIn.launchUrl}`,
        ]
          .filter(Boolean)
          .join(' · '),
      },
      {
        id: 'R7',
        title: 'Role at sign-in (to agree)',
        priority: 'P2',
        state: claims.includes('roles') ? 'done' : 'waiting',
        evidence: claims.includes('roles')
          ? 'TDMP advertises a roles claim'
          : `Not blocking: roles are set in RTB GIS until TDMP provides them${mappedRoles > 0 ? ` (${mappedRoles} role(s) already mapped for later)` : ''}`,
      },
      {
        id: 'R8',
        title: 'Area (province / district / school) at sign-in (to agree)',
        priority: 'P2',
        state: claims.includes('access_scope') ? 'done' : 'waiting',
        evidence: claims.includes('access_scope')
          ? 'TDMP advertises an access_scope claim'
          : 'Not blocking: areas are set in RTB GIS until TDMP provides them',
      },
      {
        id: 'R9',
        title: 'amr claim (MFA done in TDMP)',
        priority: 'P3',
        state: claims.includes('amr') ? 'done' : 'waiting',
        evidence: claims.length
          ? `Claims advertised: ${claims.join(', ')}. Our 2FA stays on for privileged roles until amr is there`
          : 'Discovery not readable',
      },
      {
        id: 'R10',
        title: 'Test environment and test accounts',
        priority: 'P2',
        state: 'manual',
        evidence:
          'TDMP has a test environment (guide §4): ask for a test registration',
      },
      {
        id: 'R17',
        title: 'Tell connected systems when an account is deactivated',
        priority: 'P2',
        state: 'manual',
        evidence:
          'To agree (guide §12). Meanwhile TDMP sessions end after TDMP_SESSION_MAX_HOURS',
      },
      {
        id: 'R18',
        title: 'Open a specific school from the TDMP launcher',
        priority: 'P3',
        state: 'manual',
        evidence: 'To agree (guide §12). Our /sso/tdmp?school= is ready',
      },
      {
        id: 'R15',
        title: 'TDMP embeds RTB GIS dashboards and maps',
        priority: 'P2',
        state: !partner
          ? 'waiting'
          : state(partner.embed_sessions > 0, partner.embed_keys > 0),
        evidence: !partner
          ? 'Partner keys not available'
          : partner.embed_sessions > 0
            ? `${partner.embed_sessions} embedded view(s) opened so far`
            : partner.embed_keys > 0
              ? 'Key issued; no embedded view opened yet'
              : 'No partner key with embed access yet',
      },
      {
        id: 'R16',
        title: 'TDMP sites allowed to show embedded views',
        priority: 'P2',
        state: 'manual',
        evidence:
          'Confirm the TDMP origins; they go in the partner key and the frame-ancestors rule',
      },
      {
        id: 'R12',
        title: 'Rotate the API key; separate keys per environment',
        priority: 'P1',
        state: 'manual',
        evidence: 'Confirm after the production key is installed',
      },
    ];
  }
}
