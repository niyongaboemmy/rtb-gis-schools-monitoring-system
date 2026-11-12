import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { TdmpSyncRun } from './entities/tdmp-sync-run.entity';
import { TdmpConfig } from './tdmp.config';
import { TdmpApiClient, type TdmpEndpointCheck } from './tdmp-api.client';
import type { TdmpListMeta, TdmpSchool } from './tdmp.types';

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

export interface ConnectionReport {
  checkedAt: string;
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
    @InjectRepository(TdmpSyncRun)
    private readonly runs: Repository<TdmpSyncRun>,
    private readonly dataSource: DataSource,
  ) {}

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

    return {
      checkedAt: new Date().toISOString(),
      configured,
      reachable: endpoints.some((e) => e.status > 0),
      authorised: !!list && list.status === 200,
      latencyMs: list?.ms ?? null,
      tdmpMaterialisedAt: listBody?.meta?.lastMaterialisedAt ?? null,
      tvetSchools: listBody?.meta?.page?.total ?? null,
      endpoints,
      requests: await this.requests(
        endpoints,
        rows,
        discovery,
        configured.oauthClient,
        {
          unfetched,
          sample: allRows,
        },
      ),
    };
  }

  private async requests(
    endpoints: EndpointStatus[],
    rows: TdmpSchool[],
    discovery: Record<string, unknown> | null,
    oauthClient: boolean,
    quality: { unfetched: number | null; sample: TdmpSchool[] },
  ): Promise<RequestStatus[]> {
    const ok = (key: string) =>
      endpoints.find((e) => e.key === key)?.ok ?? false;
    const claims = Array.isArray(discovery?.claims_supported)
      ? (discovery.claims_supported as string[])
      : [];
    const prompts = Array.isArray(discovery?.prompt_values_supported)
      ? (discovery.prompt_values_supported as string[])
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

    // R13: schools TDMP has no GPS for, as the latest real sync saw them.
    const lastSync = await this.runs
      .findOne({
        where: { status: 'completed', dryRun: false },
        order: { startedAt: 'DESC' },
      })
      .catch(() => null);
    const noGps = lastSync?.report?.needsLocation?.length ?? null;

    // R14–R16: TDMP using what RTB GIS offers (partner keys, embed views).
    const partner = await this.dataSource
      .query(
        `SELECT
           count(*) FILTER (WHERE "revokedAt" IS NULL AND 'coordinates:read' = ANY(scopes))::int AS coord_keys,
           count(*) FILTER (WHERE "revokedAt" IS NULL AND 'coordinates:read' = ANY(scopes) AND "lastUsedAt" IS NOT NULL)::int AS coord_used,
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
        title: 'OAuth client for RTB 3D GIS',
        priority: 'P1',
        state: state(oauthClient && prompts.includes('none'), oauthClient),
        evidence: [
          oauthClient
            ? 'Client id and secret configured'
            : 'TDMP_OAUTH_CLIENT_ID / SECRET not set',
          prompts.includes('none')
            ? 'prompt=none supported'
            : 'prompt=none not advertised',
          discovery?.end_session_endpoint
            ? 'end-session endpoint present'
            : 'no end-session endpoint',
        ].join(' · '),
      },
      {
        id: 'R7',
        title: 'TDMP role catalogue and mapping',
        priority: 'P1',
        state: mappedRoles > 0 ? 'done' : 'waiting',
        evidence:
          mappedRoles > 0
            ? `${mappedRoles} role(s) mapped to TDMP roles (Settings ▸ Roles)`
            : 'No role mapped to a TDMP role yet',
      },
      {
        id: 'R8',
        title: 'Province / district / school in the access scope',
        priority: 'P1',
        state:
          claims.includes('roles') || claims.includes('access_scope')
            ? 'done'
            : 'waiting',
        evidence:
          'Until then province- and district-scoped users without an anchor school are refused',
      },
      {
        id: 'R9',
        title: 'amr claim (MFA done in TDMP)',
        priority: 'P3',
        state: claims.includes('amr') ? 'done' : 'waiting',
        evidence: claims.length
          ? `Claims advertised: ${claims.join(', ')}`
          : 'Discovery not readable',
      },
      {
        id: 'R10',
        title: 'Staging environment and test accounts',
        priority: 'P2',
        state: 'manual',
        evidence: 'Confirm with TDMP',
      },
      {
        id: 'R13',
        title: 'GPS for TVET schools that have none in TDMP',
        priority: 'P2',
        state: noGps === null ? 'waiting' : state(noGps === 0),
        evidence:
          noGps === null
            ? 'Run a sync to check'
            : noGps === 0
              ? 'Every TDMP school had usable GPS in the last sync'
              : `${noGps} schools had no GPS inside Rwanda in the last sync`,
      },
      {
        id: 'R14',
        title: 'TDMP reads school coordinates from RTB GIS',
        priority: 'P2',
        state: !partner
          ? 'waiting'
          : state(partner.coord_used > 0, partner.coord_keys > 0),
        evidence: !partner
          ? 'Partner keys not available'
          : partner.coord_used > 0
            ? 'TDMP has used its partner key'
            : partner.coord_keys > 0
              ? 'Key issued; not used yet'
              : 'No partner key with coordinates access yet (Shared with TDMP ▸ Manage keys)',
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
