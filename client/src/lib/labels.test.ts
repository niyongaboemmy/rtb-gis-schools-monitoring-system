import { describe, expect, it } from "vitest";
import { LABELS, label, labelOptions, titleCase } from "./labels";

describe("labels", () => {
  it("maps report statuses to the glossary wording", () => {
    expect(label("reportStatus", "NEED_INTERVENTION")).toBe("Needs action");
    expect(label("reportStatus", "SOLVED")).toBe("Fixed");
    expect(label("reportStatus", "PENDING")).toBe("Waiting");
    expect(label("reportStatus", "FAILED")).toBe("Not valid");
  });

  it("maps report types", () => {
    expect(label("reportType", "issue")).toBe("Problem report");
    expect(label("reportType", "data_change_request")).toBe("Change request");
    expect(label("reportType", "DATA_CHANGE_REQUEST")).toBe("Change request");
  });

  it("maps every known enum", () => {
    expect(label("schoolStatus", "under_renovation")).toBe("Under Renovation");
    expect(label("priority", "critical")).toBe("Critical");
    expect(label("buildingCondition", "fair")).toBe("Fair");
    expect(label("roofCondition", "needs_repair")).toBe("Needs Repair");
    expect(label("compliance", "non_compliant")).toBe("Doesn't meet");
    expect(label("compliance", "partial")).toBe("Partly meets");
    expect(label("schoolTypeShort", "INTEGRATED")).toBe("Integrated");
    expect(label("accessTier", "district")).toBe("District");
    expect(label("surveyStatus", "in_progress")).toBe("In Progress");
  });

  it("is case-insensitive", () => {
    expect(label("priority", "CRITICAL")).toBe("Critical");
    expect(label("reportStatus", "need_intervention")).toBe("Needs action");
  });

  it("falls back to title case, never raw SCREAMING_CASE", () => {
    expect(label("reportStatus", "AWAITING_FUNDS")).toBe("Awaiting Funds");
    expect(label("schoolType", "tvet-center")).toBe("TVET Center");
    expect(titleCase("someCamelValue")).toBe("Some Camel Value");
  });

  it("renders a dash for empty values", () => {
    expect(label("priority", null)).toBe("—");
    expect(label("priority", undefined)).toBe("—");
    expect(label("priority", "")).toBe("—");
  });

  it("no label is itself SCREAMING_CASE or snake_case", () => {
    for (const map of Object.values(LABELS)) {
      for (const l of Object.values(map)) {
        expect(l).not.toMatch(/_/);
        expect(l).not.toMatch(/^[A-Z]{4,}$/);
      }
    }
  });

  it("labelOptions de-duplicates aliases", () => {
    const opts = labelOptions("reportStatus");
    expect(opts.filter((o) => o.label === "Fixed")).toHaveLength(1);
  });
});
