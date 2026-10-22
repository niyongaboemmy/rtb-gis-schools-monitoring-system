import { describe, expect, it } from "vitest";
import { buildingPayloadFields } from "./buildingPayload";

describe("buildingPayloadFields", () => {
  it("sends blanks as null, never 0 / a default condition", () => {
    expect(
      buildingPayloadFields({
        buildingName: "Block A",
        buildingCode: "",
        buildingFloors: "",
        buildingArea: "",
        buildingYearBuilt: "",
        buildingCondition: "",
        buildingRoofCondition: "",
        buildingStructuralScore: "",
        buildingNotes: "  ",
      }),
    ).toEqual({
      name: "Block A",
      code: null,
      function: null,
      floors: null,
      area: null,
      yearBuilt: null,
      condition: null,
      roofCondition: null,
      structuralScore: null,
      notes: null,
    });
  });
  it("keeps recorded values", () => {
    const p = buildingPayloadFields({
      buildingName: "B",
      buildingFloors: "2",
      buildingArea: "120.5",
      buildingYearBuilt: "1998",
      buildingCondition: "poor",
      buildingStructuralScore: "0",
    });
    expect(p).toMatchObject({ floors: 2, area: 120.5, yearBuilt: 1998, condition: "poor", structuralScore: 0 });
  });
});
