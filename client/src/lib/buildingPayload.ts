/**
 * Building form → API fields, shared by the 2D and 3D viewers. A blank input
 * is sent as null ("not recorded") — never 0, the current year or a default
 * condition: those used to turn an unassessed stub into a "perfect, brand-new"
 * building in the School Condition Score.
 */
export interface BuildingFormFields {
  buildingName: string;
  buildingCode?: string | null;
  buildingFunction?: string | null;
  buildingFloors?: string | number | null;
  buildingArea?: string | number | null;
  buildingYearBuilt?: string | number | null;
  buildingCondition?: string | null;
  buildingRoofCondition?: string | null;
  buildingStructuralScore?: string | number | null;
  buildingNotes?: string | null;
}

const text = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
const number = (v: string | number | null | undefined, int = false) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = int ? parseInt(String(v), 10) : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export function buildingPayloadFields(d: BuildingFormFields) {
  return {
    name: d.buildingName,
    code: text(d.buildingCode),
    function: text(d.buildingFunction),
    floors: number(d.buildingFloors, true),
    area: number(d.buildingArea),
    yearBuilt: number(d.buildingYearBuilt, true),
    condition: text(d.buildingCondition),
    roofCondition: text(d.buildingRoofCondition),
    structuralScore: number(d.buildingStructuralScore),
    notes: text(d.buildingNotes),
  };
}
