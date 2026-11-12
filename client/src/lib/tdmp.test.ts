import { describe, expect, it } from "vitest";
import {
  areaCoverage,
  overallCoverage,
  TDMP_COVERAGE,
  schoolSource,
  fieldsLabel,
  progressLabel,
  totalsSummary,
  triggerLabel,
  isTdmpLinked,
  isTdmpOwnedField,
  isTdmpUser,
  safeNextPath,
  ssoErrorMessage,
  SSO_ERROR_MESSAGES,
  tdmpStartUrl,
} from "./tdmp";
import { setupChecklist } from "../components/profile/profile-utils";

describe("safeNextPath", () => {
  it.each([
    ["/schools/42", "/schools/42"],
    ["/", "/"],
    [null, "/"],
    ["", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["schools", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("tdmpStartUrl", () => {
  it("points at the server start route with the school code", () => {
    expect(tdmpStartUrl({ school: "575775" })).toBe("/api/v1/auth/tdmp/start?school=575775");
    expect(tdmpStartUrl()).toBe("/api/v1/auth/tdmp/start");
  });

  it("never forwards an off-site next path", () => {
    expect(tdmpStartUrl({ next: "//evil.example" })).toBe("/api/v1/auth/tdmp/start?next=%2F");
  });
});

describe("ssoErrorMessage", () => {
  it("maps known codes and falls back for unknown ones", () => {
    expect(ssoErrorMessage("not_allowed")).toBe(SSO_ERROR_MESSAGES.not_allowed);
    expect(ssoErrorMessage("something_new")).toBe(SSO_ERROR_MESSAGES.failed);
    expect(ssoErrorMessage(null)).toBeNull();
  });
});

describe("TDMP ownership", () => {
  it("treats a school with a TDMP code as linked", () => {
    expect(isTdmpLinked({ tdmpSchoolCode: "575775" })).toBe(true);
    expect(isTdmpLinked({ tdmpSchoolCode: "  " })).toBe(false);
    expect(isTdmpLinked({ tdmpSchoolCode: null })).toBe(false);
    expect(isTdmpLinked(undefined)).toBe(false);
  });

  it("keeps GPS out of the TDMP-owned fields", () => {
    expect(isTdmpOwnedField("name")).toBe(true);
    expect(isTdmpOwnedField("district")).toBe(true);
    expect(isTdmpOwnedField("latitude")).toBe(false);
    expect(isTdmpOwnedField("longitude")).toBe(false);
    expect(isTdmpOwnedField("elevation")).toBe(false);
  });

  it("leaves fields TDMP does not send yet editable", () => {
    for (const f of ["maleStudents", "femaleStudents", "maleTeachers", "femaleTeachers", "headTeacher"])
      expect(isTdmpOwnedField(f)).toBe(false);
    expect(isTdmpOwnedField("ownership")).toBe(true);
    expect(isTdmpOwnedField("totalStudents")).toBe(true);
  });

  it("recognises TDMP accounts", () => {
    expect(isTdmpUser({ authSource: "tdmp" })).toBe(true);
    expect(isTdmpUser({ authSource: "local" })).toBe(false);
    expect(isTdmpUser(null)).toBe(false);
  });
});


describe("profile checklist for TDMP accounts", () => {
  it("drops the 2FA step, which TDMP manages", () => {
    const base = { id: "u", firstName: "A", lastName: "B", email: "a@rtb.gov.rw", role: "viewer" };
    expect(setupChecklist({ ...base, authSource: "tdmp" }).some((i) => i.id === "mfa")).toBe(false);
    expect(setupChecklist({ ...base, authSource: "local" }).some((i) => i.id === "mfa")).toBe(true);
  });
});

describe("sync run wording", () => {
  const totals = { fetched: 391, created: 0, linked: 12, updated: 3, unchanged: 370, skippedNoGps: 2, skipped: 4, failed: 0, missing: 1, deactivated: 0, details: 20 };

  it("summarises only what happened, in past or future tense", () => {
    expect(totalsSummary(totals)).toBe("12 linked · 3 updated · 370 unchanged · 2 need a location · 1 missing from TDMP · 4 skipped");
    expect(totalsSummary(totals, true)).toMatch(/^12 to link · 3 to update/);
    expect(totalsSummary({})).toBe("No changes");
  });

  it("names triggers and dry runs", () => {
    expect(triggerLabel({ trigger: "probe", dryRun: false })).toBe("TDMP data changed");
    expect(triggerLabel({ trigger: "manual", dryRun: true })).toBe("Manual · dry run");
  });

  it("describes progress", () => {
    expect(progressLabel(null)).toBe("Starting…");
    expect(progressLabel({ phase: "schools", done: 40, total: 391 })).toBe("Updating schools · 40 of 391");
    expect(progressLabel({ phase: "list", done: 0, total: 0 })).toBe("Reading the school list");
  });

  it("says field names plainly", () => {
    expect(fieldsLabel(["name", "totalStudents", "establishedYear"])).toBe("name, learners, year established");
    expect(fieldsLabel(undefined)).toBe("");
  });
});

describe("schoolSource", () => {
  it("tells TDMP-linked, missing and local schools apart", () => {
    expect(schoolSource({ tdmpSchoolCode: "270501" })).toBe("tdmp");
    expect(schoolSource({ tdmpSchoolCode: "270501", tdmpData: { missingFromTdmp: true } })).toBe("missing");
    expect(schoolSource({ tdmpSchoolCode: null })).toBe("local");
  });
});

describe("data coverage", () => {
  const waiting = [
    { id: "R1", state: "waiting" as const },
    { id: "R6", state: "partial" as const },
  ];
  it("counts fields live with today's access, and those a met request unlocks", () => {
    const profile = TDMP_COVERAGE.find((a) => a.id === "profile")!;
    expect(areaCoverage(profile, waiting)).toMatchObject({ live: 6, total: 6 });
    const enrolment = TDMP_COVERAGE.find((a) => a.id === "enrolment")!;
    expect(areaCoverage(enrolment, waiting)).toMatchObject({ live: 2, total: 6 });
    expect(areaCoverage(enrolment, [{ id: "R1", state: "done" }])).toMatchObject({ live: 5 });
  });
  it("treats a partly met sign-in request as live where allowed", () => {
    const identity = TDMP_COVERAGE.find((a) => a.id === "identity")!;
    expect(areaCoverage(identity, waiting).fields[0]).toMatchObject({ label: "Sign-in client", live: true });
  });
  it("gives an overall percentage", () => {
    const pct = overallCoverage(waiting);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
    expect(overallCoverage(["R1", "R2", "R3", "R6", "R7", "R8", "R9"].map((id) => ({ id, state: "done" as const })))).toBe(100);
  });
});
