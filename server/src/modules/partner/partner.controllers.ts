import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { ScopeGuard } from '../../common/scope/scope.guard';
import { RequireNationalScope } from '../../common/scope/scope.decorator';
import { AuditService } from '../audit/audit.service';
import {
  PARTNER_SCOPES,
  type PartnerApiKey,
} from './entities/partner-api-key.entity';
import { PartnerKeysService } from './partner-keys.service';
import { PartnerSchoolsService } from './partner-schools.service';
import {
  CurrentPartner,
  PartnerApiKeyGuard,
  PartnerScopes,
} from './partner-api-key.guard';
import { EMBED_VIEWS, applyEmbedClaims, type EmbedView } from './partner-embed';

class EmbedLinkDto {
  @IsIn(EMBED_VIEWS as unknown as string[])
  view: EmbedView;

  /** TDMP / SDMS school code (school views). */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  schoolCode?: string;

  /** National map only: limit it to one province / district. */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  province?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  district?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  ttlSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  sessionMinutes?: number;
}

class CreatePartnerKeyDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsString()
  @Length(2, 60)
  partner: string;

  @IsOptional()
  @IsArray()
  @IsIn(PARTNER_SCOPES as unknown as string[], { each: true })
  scopes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  allowedOrigins?: string[];
}

class EmbedSessionDto {
  @IsString()
  @Length(20, 4096)
  token: string;
}

const listQueries = [
  ApiQuery({
    name: 'updatedSince',
    required: false,
    description: 'ISO date-time: only rows changed after it',
  }),
  ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'under_renovation'],
  }),
  ApiQuery({ name: 'district', required: false }),
  ApiQuery({ name: 'page', required: false, type: Number }),
  ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '1–1000, default 100',
  }),
];
const applyAll =
  (...ds: MethodDecorator[]): MethodDecorator =>
  (t, k, d) => {
    for (const dec of ds) dec(t, k, d);
  };

/**
 * The partner API (TDMP and other platforms): authenticated with a partner
 * key, read-only, plus signed embed links. Documented at /developers.
 */
@ApiTags('partner')
@ApiSecurity('partner-key')
@ApiHeader({
  name: 'Authorization',
  description: 'ApiKey rtbgis_pk_…  (or X-API-Key: rtbgis_pk_…)',
})
@Controller('partner')
@UseGuards(PartnerApiKeyGuard)
@Throttle({ default: { ttl: 60_000, limit: 120 } })
export class PartnerApiController {
  constructor(
    private readonly schools: PartnerSchoolsService,
    private readonly keys: PartnerKeysService,
  ) {}

  @Get('ping')
  @ApiOperation({
    summary: 'Check a partner key: who you are and what it may do',
  })
  ping(@CurrentPartner() key: PartnerApiKey) {
    return {
      partner: key.partner,
      keyName: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      time: new Date().toISOString(),
    };
  }

  @Get('schools/coordinates')
  @PartnerScopes('coordinates:read')
  @ApiOperation({
    summary: 'School coordinates (WGS84) — the feed to update partner GPS from',
  })
  @applyAll(
    ...listQueries,
    ApiQuery({ name: 'format', required: false, enum: ['json', 'geojson'] }),
  )
  coordinates(@Query() q: Record<string, string>) {
    const query = {
      updatedSince: q.updatedSince,
      status: q.status,
      district: q.district,
      page: Number(q.page),
      limit: Number(q.limit),
    };
    return q.format === 'geojson'
      ? this.schools.coordinatesGeoJson(query)
      : this.schools.coordinates(query);
  }

  @Get('schools')
  @PartnerScopes('schools:read')
  @ApiOperation({
    summary:
      'Schools in RTB GIS, with location quality and which views can be embedded',
  })
  @applyAll(...listQueries)
  list(@Query() q: Record<string, string>) {
    return this.schools.list({
      updatedSince: q.updatedSince,
      status: q.status,
      district: q.district,
      page: Number(q.page),
      limit: Number(q.limit),
    });
  }

  @Get('schools/:code')
  @PartnerScopes('schools:read')
  @ApiOperation({
    summary:
      'One school by TDMP / SDMS code, with its campus boundary (GeoJSON)',
  })
  detail(@Param('code') code: string) {
    return this.schools.detail(code.trim());
  }

  @Post('embed-links')
  @HttpCode(201)
  @PartnerScopes('embed:create')
  @ApiOperation({
    summary: 'A signed, short-lived link to a dashboard or map, for an iframe',
  })
  embedLink(@CurrentPartner() key: PartnerApiKey, @Body() dto: EmbedLinkDto) {
    return this.keys.createEmbedLink(key, dto);
  }
}

/** Admin: partner keys (create, list, revoke). National integration admins only. */
@ApiTags('partner')
@ApiBearerAuth()
@Controller('partner-keys')
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
export class PartnerKeysController {
  constructor(private readonly keys: PartnerKeysService) {}

  @Get()
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'Partner API keys (never the key itself)' })
  list() {
    return this.keys.list();
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'Create a partner API key (shown once)' })
  async create(
    @Body() dto: CreatePartnerKeyDto,
    @Request() req: { user?: { email?: string } },
  ) {
    const { key, rawKey } = await this.keys.create(
      dto,
      req.user?.email ?? null,
    );
    return { ...key, apiKey: rawKey };
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({
    summary: 'Revoke a partner key; its embed sessions end at once',
  })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user?: { email?: string } },
  ) {
    return this.keys.revoke(id, req.user?.email ?? null);
  }
}

/** The iframe page exchanges a signed embed link for a read-only session. */
@ApiTags('partner')
@Controller('embed')
export class EmbedController {
  constructor(
    private readonly keys: PartnerKeysService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Post('session')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Open a read-only embed session from a signed embed link',
  })
  async openSession(@Body() dto: EmbedSessionDto) {
    const s = await this.keys.openEmbedSession(dto.token);
    const viewer = applyEmbedClaims(s.user, s.emb)!;
    this.audit.record({
      action: 'partner.embed_session',
      outcome: 'success',
      targetType: 'school',
      targetId: s.emb.sid,
      meta: {
        partner: s.partner,
        view: s.emb.view,
        scope: s.emb.loc,
        keyId: s.emb.pk,
      },
    });
    return {
      accessToken: s.accessToken,
      expiresIn: s.expiresIn,
      view: s.emb.view,
      schoolId: s.emb.sid ?? null,
      partner: s.partner,
      user: this.auth.publicUser(viewer),
    };
  }
}
