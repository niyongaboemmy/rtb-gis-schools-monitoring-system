import { describe, expect, it } from "vitest";
import type { User } from "../../store/authStore";
import {
  changedFields,
  profileFormOf,
  profilePatch,
  roleNameOf,
  scopeLabelOf,
  setupChecklist,
  validateProfile,
} from "./profile-utils";

const user = (over: Partial<User> = {}): User => ({
  id: "u1",
  firstName: "System",
  lastName: "Administrator",
  email: "admin@rtb.gov.rw",
  role: { id: "r1", name: "super_admin", permissions: [], accessLevel: { id: "a1", name: "National" } },
  ...over,
});

describe("profile form", () => {
  it("diffs on trimmed values and patches only what changed", () => {
    const saved = profileFormOf(user());
    expect(changedFields(saved, { ...saved, firstName: " System " })).toEqual([]);
    const draft = { ...saved, phone: " +250 788 123 456 ", department: "IT" };
    expect(changedFields(saved, draft)).toEqual(["phone", "department"]);
    expect(profilePatch(saved, draft)).toEqual({ phone: "+250 788 123 456", department: "IT" });
  });

  it("validates required names, phone shape and server length limits", () => {
    const ok = profileFormOf(user());
    expect(validateProfile(ok)).toEqual({});
    expect(validateProfile({ ...ok, firstName: "  " }).firstName).toMatch(/required/);
    expect(validateProfile({ ...ok, phone: "call me" }).phone).toBeTruthy();
    expect(validateProfile({ ...ok, phone: "+250 (788) 123-456" })).toEqual({});
    expect(validateProfile({ ...ok, department: "x".repeat(151) }).department).toMatch(/150/);
  });
});

describe("labels", () => {
  it("title-cases every underscore of the role, not just the first", () => {
    expect(roleNameOf(user({ role: "district_officer_assistant" }))).toBe("District Officer Assistant");
  });
  it("picks the most specific area", () => {
    expect(scopeLabelOf(user({ location: { province: "Kigali", district: "Gasabo" } }))).toBe("Gasabo, Kigali");
    expect(scopeLabelOf(user({ location: { schoolName: "IPRC Kigali", district: "Kicukiro" } }))).toBe("IPRC Kigali");
    expect(scopeLabelOf(user())).toBeNull();
  });
});

describe("setupChecklist", () => {
  it("reflects the saved profile and 2FA state", () => {
    const items = setupChecklist(user({ phone: "+250788", totpEnabled: false, mfaRequired: true }));
    expect(items.map((i) => [i.id, i.done])).toEqual([
      ["name", true],
      ["phone", true],
      ["department", false],
      ["mfa", false],
    ]);
    expect(items.find((i) => i.id === "mfa")?.hint).toMatch(/Required/);
  });
});
