import { describe, expect, it } from "vitest";
import {
  infraKeyLabel,
  infraValueLabel,
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

  it("recognises TDMP accounts", () => {
    expect(isTdmpUser({ authSource: "tdmp" })).toBe(true);
    expect(isTdmpUser({ authSource: "local" })).toBe(false);
    expect(isTdmpUser(null)).toBe(false);
  });
});

describe("infrastructure labels", () => {
  it("reads keys as sentence-case text", () => {
    expect(infraKeyLabel("classroomDesks")).toBe("Classroom desks");
    expect(infraKeyLabel("workshopLabs")).toBe("Workshops & labs");
    expect(infraKeyLabel("hasGridElectricity")).toBe("Grid electricity");
  });

  it("formats values", () => {
    expect(infraValueLabel(true)).toBe("Yes");
    expect(infraValueLabel(false)).toBe("No");
    expect(infraValueLabel(null)).toBe("—");
    expect(infraValueLabel(1200)).toBe("1,200");
    expect(infraValueLabel("Fiber")).toBe("Fiber");
  });
});

describe("profile checklist for TDMP accounts", () => {
  it("drops the 2FA step, which TDMP manages", () => {
    const base = { id: "u", firstName: "A", lastName: "B", email: "a@rtb.gov.rw", role: "viewer" };
    expect(setupChecklist({ ...base, authSource: "tdmp" }).some((i) => i.id === "mfa")).toBe(false);
    expect(setupChecklist({ ...base, authSource: "local" }).some((i) => i.id === "mfa")).toBe(true);
  });
});
