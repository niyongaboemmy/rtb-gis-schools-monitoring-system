import { beforeEach, describe, expect, it, vi } from "vitest";
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
  returnToTdmpIfSessionLost,
  shouldAutoReturnToTdmp,
  signInReady,
  TDMP_AUTO_RETURN_KEY,
  TDMP_AUTO_RETURN_WINDOW_MS,
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
  const base = { id: "u", firstName: "A", lastName: "B", email: "a@rtb.gov.rw", role: "viewer" };
  it("asks for 2FA only when the TDMP user's role requires it", () => {
    expect(setupChecklist({ ...base, authSource: "tdmp" }).some((i) => i.id === "mfa")).toBe(false);
    expect(setupChecklist({ ...base, authSource: "tdmp", mfaRequired: true }).some((i) => i.id === "mfa")).toBe(true);
    expect(setupChecklist({ ...base, authSource: "local" }).some((i) => i.id === "mfa")).toBe(true);
  });
});

describe("automatic return to TDMP", () => {
  const tdmpUser = { authSource: "tdmp" };
  const ok = { user: tdmpUser, tdmpSignIn: true, pathname: "/schools/1", embed: false, lastReturnAt: null };

  it("sends a TDMP user back through TDMP", () => {
    expect(shouldAutoReturnToTdmp(ok)).toBe(true);
  });

  it.each([
    ["a local user", { user: { authSource: "local" } }],
    ["after an explicit sign-out (profile already cleared)", { user: null }],
    ["when TDMP sign-in is off", { tdmpSignIn: false }],
    ["inside an embedded view", { embed: true }],
    ["on the login page", { pathname: "/login" }],
    ["on the sign-in return page", { pathname: "/sso/tdmp/complete" }],
  ])("does nothing for %s", (_label, over) => {
    expect(shouldAutoReturnToTdmp({ ...ok, ...over })).toBe(false);
  });

  it("returns at most once every two minutes", () => {
    const now = 1_000_000;
    expect(shouldAutoReturnToTdmp({ ...ok, lastReturnAt: now - 60_000, now })).toBe(false);
    expect(shouldAutoReturnToTdmp({ ...ok, lastReturnAt: now - TDMP_AUTO_RETURN_WINDOW_MS - 1, now })).toBe(true);
  });

  describe("returnToTdmpIfSessionLost", () => {
    beforeEach(() => sessionStorage.clear());
    const providers = vi.fn(async () => ({ tdmp: true }));

    it("opens TDMP sign-in with the current page as next, then not again right away", async () => {
      const go = vi.fn();
      await expect(
        returnToTdmpIfSessionLost(tdmpUser, "/schools/7?tab=map", { embed: false, getProviders: providers, go }),
      ).resolves.toBe(true);
      expect(go).toHaveBeenCalledWith("/api/v1/auth/tdmp/start?next=%2Fschools%2F7%3Ftab%3Dmap");
      expect(sessionStorage.getItem(TDMP_AUTO_RETURN_KEY)).not.toBeNull();

      const again = vi.fn();
      await expect(
        returnToTdmpIfSessionLost(tdmpUser, "/schools/7", { embed: false, getProviders: providers, go: again }),
      ).resolves.toBe(false);
      expect(again).not.toHaveBeenCalled();
    });

    it("never asks the server for a local user or after sign-out", async () => {
      const getProviders = vi.fn(async () => ({ tdmp: true }));
      const go = vi.fn();
      await expect(returnToTdmpIfSessionLost({ authSource: "local" }, "/", { embed: false, getProviders, go })).resolves.toBe(false);
      await expect(returnToTdmpIfSessionLost(null, "/", { embed: false, getProviders, go })).resolves.toBe(false);
      expect(getProviders).not.toHaveBeenCalled();
      expect(go).not.toHaveBeenCalled();
    });

    it("stays on the normal path when TDMP sign-in is off", async () => {
      const go = vi.fn();
      await expect(
        returnToTdmpIfSessionLost(tdmpUser, "/", { embed: false, getProviders: async () => ({ tdmp: false }), go }),
      ).resolves.toBe(false);
      expect(go).not.toHaveBeenCalled();
    });
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
    expect(areaCoverage(identity, waiting).fields[0]).toMatchObject({ label: "Sign-in registration", live: true });
  });
  it("gives an overall percentage", () => {
    const pct = overallCoverage(waiting);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
    expect(overallCoverage(["R1", "R2", "R3", "R6", "R7", "R8", "R9"].map((id) => ({ id, state: "done" as const })))).toBe(100);
  });
});

describe("signInReady", () => {
  const base = {
    authMode: "both" as const,
    accessSource: "local" as const,
    clientConfigured: true,
    credentials: "accepted" as const,
    signingKeys: 1,
    issuerMatches: true,
    redirectUri: "https://gis/api/v1/auth/tdmp/callback",
    launchUrl: "https://gis/sso/tdmp",
    sessionMaxHours: 24,
  };
  it("needs accepted credentials, published keys and a matching issuer", () => {
    expect(signInReady(base)).toBe(true);
    expect(signInReady({ ...base, credentials: "rejected" })).toBe(false);
    expect(signInReady({ ...base, credentials: null, clientConfigured: false })).toBe(false);
    expect(signInReady({ ...base, signingKeys: 0 })).toBe(false);
    expect(signInReady({ ...base, issuerMatches: false })).toBe(false);
    expect(signInReady(undefined)).toBe(false);
  });
});
