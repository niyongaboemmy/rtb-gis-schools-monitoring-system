import {
  apiPath,
  applyEmbedClaims,
  embedRouteAllowed,
  areaLocation,
  clamp,
  EMBED_LINK_TTL,
  EMBED_READ_METHODS,
  embedPath,
  isSchoolView,
  schoolLocation,
  type EmbedClaims,
} from './partner-embed';
import { coordinateQuality } from './partner-schools.service';
import { readPartnerKey } from './partner-api-key.guard';

describe('embed views', () => {
  it('maps each view to its web-app path', () => {
    expect(embedPath('school-dashboard', 'abc')).toBe(
      '/embed/schools/abc/dashboard',
    );
    expect(embedPath('school-map-2d', 'abc')).toBe('/embed/schools/abc/map-2d');
    expect(embedPath('school-map-3d', 'abc')).toBe('/embed/schools/abc/map-3d');
    expect(embedPath('national-map')).toBe('/embed/map');
    expect(isSchoolView('national-map')).toBe(false);
    expect(isSchoolView('school-map-3d')).toBe(true);
  });

  it('builds the scope of a school view and of the national map', () => {
    expect(
      schoolLocation({
        id: 's1',
        name: 'ACEJ',
        province: 'Southern Province',
        district: 'Muhanga',
        sector: null,
      }),
    ).toEqual({
      tier: 'school',
      province: 'Southern Province',
      district: 'Muhanga',
      sector: undefined,
      schoolId: 's1',
      schoolName: 'ACEJ',
    });
    expect(areaLocation()).toEqual({ tier: 'national' });
    expect(areaLocation({ province: ' Kigali City ' })).toEqual({
      tier: 'province',
      province: 'Kigali City',
    });
    expect(
      areaLocation({ province: 'Kigali City', district: 'Gasabo' }),
    ).toEqual({
      tier: 'district',
      province: 'Kigali City',
      district: 'Gasabo',
    });
  });

  it('clamps lifetimes to the allowed range', () => {
    expect(clamp(undefined, EMBED_LINK_TTL)).toBe(300);
    expect(clamp(5, EMBED_LINK_TTL)).toBe(60);
    expect(clamp(99999, EMBED_LINK_TTL)).toBe(3600);
    expect(clamp('900', EMBED_LINK_TTL)).toBe(900);
  });

  it('only reads are allowed in an embed session', () => {
    expect([...EMBED_READ_METHODS].sort()).toEqual(['GET', 'HEAD', 'OPTIONS']);
  });
});

describe('applyEmbedClaims', () => {
  const emb: EmbedClaims = {
    pk: 'k1',
    view: 'school-dashboard',
    sid: 's1',
    loc: { tier: 'school', district: 'Muhanga', schoolId: 's1' },
  };

  it('narrows a partner account to the link scope', () => {
    const user = {
      id: 'u',
      authSource: 'partner',
      location: { tier: 'national' },
    };
    const v = applyEmbedClaims(user, emb);
    expect(v?.location).toEqual(emb.loc);
    expect(v?.embed).toBe(emb);
  });

  it('refuses any other account, so a stolen claim cannot widen a real user', () => {
    expect(
      applyEmbedClaims({ authSource: 'local', location: {} }, emb),
    ).toBeNull();
    expect(
      applyEmbedClaims({ authSource: 'tdmp', location: {} }, emb),
    ).toBeNull();
  });
});

describe('partner helpers', () => {
  it('reads the key from Authorization: ApiKey or X-API-Key', () => {
    expect(
      readPartnerKey({
        headers: { authorization: 'ApiKey rtbgis_pk_abc' },
      } as never),
    ).toBe('rtbgis_pk_abc');
    expect(
      readPartnerKey({
        headers: { authorization: 'apikey  rtbgis_pk_abc ' },
      } as never),
    ).toBe('rtbgis_pk_abc');
    expect(
      readPartnerKey({ headers: { 'x-api-key': 'rtbgis_pk_xyz' } } as never),
    ).toBe('rtbgis_pk_xyz');
    expect(
      readPartnerKey({ headers: { authorization: 'Bearer eyJ…' } } as never),
    ).toBeNull();
  });

  it('rates coordinate quality by source', () => {
    expect(coordinateQuality('kmz')).toBe('surveyed');
    expect(coordinateQuality('glb')).toBe('surveyed');
    expect(coordinateQuality('manual')).toBe('manual');
    expect(coordinateQuality('tdmp')).toBe('tdmp');
    expect(coordinateQuality('seed')).toBe('unverified');
    expect(coordinateQuality(null)).toBe('unverified');
  });
});

describe('embedRouteAllowed: one view, nothing else', () => {
  const S = '0b5c1d2e-1111-4222-8333-444455556666';
  const OTHER = '9f9f9f9f-1111-4222-8333-444455556666';
  const ok = (
    view: Parameters<typeof embedRouteAllowed>[0],
    url: string,
    method = 'GET',
    sid: string | undefined = S,
  ) => embedRouteAllowed(view, sid, method, url);

  it('school dashboard: dashboard figures only', () => {
    expect(ok('school-dashboard', `/api/v1/schools/${S}`)).toBe(true);
    expect(
      ok('school-dashboard', `/api/v1/analytics/schools/${S}/metrics`),
    ).toBe(true);
    expect(ok('school-dashboard', '/api/v1/reports?schoolId=x')).toBe(true);
    expect(ok('school-dashboard', `/api/v1/schools/${S}/kmz/2d/manifest`)).toBe(
      false,
    );
    expect(ok('school-dashboard', `/api/v1/schools/${S}/viewer-state`)).toBe(
      false,
    );
    expect(ok('school-dashboard', '/api/v1/schools')).toBe(false);
    expect(ok('school-dashboard', '/api/v1/analytics/overview')).toBe(false);
  });

  it('2D map: map data only', () => {
    expect(ok('school-map-2d', `/api/v1/schools/${S}/kmz/2d/manifest`)).toBe(
      true,
    );
    expect(ok('school-map-2d', `/api/v1/schools/${S}/buildings/`)).toBe(true);
    expect(ok('school-map-2d', `/api/v1/analytics/schools/${S}/metrics`)).toBe(
      false,
    );
    expect(ok('school-map-2d', `/api/v1/schools/${S}/viewer-state`)).toBe(
      false,
    );
    expect(
      ok('school-map-2d', `/api/v1/schools/${S}/site-features/export.csv`),
    ).toBe(false);
  });

  it('3D model: model data only', () => {
    expect(ok('school-map-3d', `/api/v1/schools/${S}/viewer-state`)).toBe(true);
    expect(ok('school-map-3d', `/api/v1/schools/${S}/kmz/status`)).toBe(true);
    expect(ok('school-map-3d', `/api/v1/schools/${S}/kmz/2d/manifest`)).toBe(
      false,
    );
    expect(ok('school-map-3d', '/api/v1/reports')).toBe(false);
  });

  it('a school view never reaches another school, even on an allowed route', () => {
    expect(ok('school-map-2d', `/api/v1/schools/${OTHER}/buildings`)).toBe(
      false,
    );
    expect(
      ok('school-dashboard', `/api/v1/analytics/schools/${OTHER}/metrics`),
    ).toBe(false);
    expect(
      embedRouteAllowed(
        'school-dashboard',
        undefined,
        'GET',
        `/api/v1/schools/${S}`,
      ),
    ).toBe(false);
  });

  it('national map and national dashboard: overview, hierarchy and the school list', () => {
    for (const v of ['national-map', 'national-dashboard'] as const) {
      expect(ok(v, '/api/v1/schools?page=1&limit=1000', 'GET', undefined)).toBe(
        true,
      );
      expect(ok(v, '/api/v1/analytics/overview', 'GET', undefined)).toBe(true);
      expect(ok(v, `/api/v1/schools/${S}`, 'GET', undefined)).toBe(false);
      expect(ok(v, '/api/v1/analytics/export', 'GET', undefined)).toBe(false);
    }
  });

  it('never a write', () => {
    expect(ok('school-dashboard', `/api/v1/schools/${S}`, 'PATCH')).toBe(false);
    expect(ok('national-map', '/api/v1/schools', 'POST', undefined)).toBe(
      false,
    );
  });

  it('normalises the path', () => {
    expect(apiPath('/api/v1/schools/x/?a=1#h')).toBe('/schools/x');
    expect(apiPath('/api/v1')).toBe('/');
    expect(apiPath('/api/v10/schools')).toBe('/api/v10/schools');
  });

  it('knows the national dashboard view', () => {
    expect(embedPath('national-dashboard')).toBe('/embed/dashboard');
    expect(isSchoolView('national-dashboard')).toBe(false);
  });
});
