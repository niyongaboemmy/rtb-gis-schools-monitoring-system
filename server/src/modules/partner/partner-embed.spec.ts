import {
  applyEmbedClaims,
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
