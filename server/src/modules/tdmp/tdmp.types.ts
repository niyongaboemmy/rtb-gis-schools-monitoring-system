/**
 * Shapes of the TDMP API responses we use, taken from the OpenAPI document at
 * https://tdmp.rtb.gov.rw/api/v1/docs/api.json. Every field is treated as
 * optional/nullable when read: TDMP data comes from several upstream sources.
 */

export interface TdmpLocation {
  villageId?: number | null;
  villageName?: string | null;
  cellId?: number | null;
  cellName?: string | null;
  sectorId?: number | null;
  sectorName?: string | null;
  districtId?: number | null;
  districtName?: string | null;
  provinceId?: number | null;
  provinceName?: string | null;
}

/** GET /schools (list item) and GET /schools/{schoolCode} (detail). */
export interface TdmpSchool {
  id: number;
  schoolCode: string;
  tmisSchoolCode?: string | null;
  schoolName: string;
  institutionType?: string | null;
  schoolCategory?: string | null;
  schoolStatus?: string | null;
  /** "ACTIVE" | "INACTIVE" */
  isActive?: string | null;
  location?: TdmpLocation | null;
  counts?: {
    teachers?: number;
    students?: number;
    trades?: number;
    levels?: number;
    modules?: number;
  } | null;
  tradeNames?: string[] | null;
  ownership?: string | null;
  enrollmentActive?: boolean | null;
  // Detail only
  schoolShortName?: string | null;
  establishmentDate?: string | null;
  deactivatedDate?: string | null;
  academicYear?: string | null;
  currentAcademicYear?: string | null;
  gpsLong?: number | null;
  gpsLat?: number | null;
  updatedAt?: string;
  lastMaterialisedAt?: string;
  /** Not on list rows yet (requested from TDMP, R3); read when present. */
  categoryBand?: string | null;
  authoritativeSource?: string | null;
}

/** `meta` of the TDMP list endpoints. */
export interface TdmpListMeta {
  lastMaterialisedAt?: string | null;
  authoritativeSource?: string | null;
  page?: { current?: number; limit?: number; total?: number };
}

/** OIDC userinfo (GET /oauth/userinfo). */
export interface TdmpUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
}

/** `data` of GET /auth/me/access-scope. */
export interface TdmpAccessScope {
  userId: number;
  email?: string | null;
  roleNames?: string[];
  teacher?: {
    id: number;
    names?: string | null;
    email?: string | null;
    tdmpSchoolId?: number | null;
  } | null;
  anchorSchool?: {
    id: number;
    schoolCode: string;
    schoolName?: string;
    provinceId?: number | null;
    provinceName?: string | null;
    districtId?: number | null;
    districtName?: string | null;
  } | null;
  /**
   * `kind`: unrestricted | province | district | school | deny. The other
   * fields are not in the published schema yet; read when present.
   */
  accessScope: {
    kind: string;
    provinceId?: number | null;
    provinceName?: string | null;
    districtId?: number | null;
    districtName?: string | null;
    schoolCode?: string | null;
  };
}

/** POST /oauth/token response. */
export interface TdmpTokenSet {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}
