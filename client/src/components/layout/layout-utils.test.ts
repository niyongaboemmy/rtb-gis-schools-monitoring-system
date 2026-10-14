import { describe, expect, it } from "vitest";
import { crumbsFor, switchSchoolPath, tourSeen, markTourSeen } from "./layout-utils";
import { homePathFor, isSchoolLevelUser } from "../../hooks/useScope";

describe("crumbsFor", () => {
  it("maps school sub-pages and exposes the school id", () => {
    const r = crumbsFor("/schools/abc/3dview");
    expect(r.schoolId).toBe("abc");
    expect(r.schoolSub).toBe("2D / 3D viewer");
    expect(r.crumbs[0]).toEqual({ label: "Schools", to: "/schools" });
  });
  it("labels top-level and nested routes", () => {
    expect(crumbsFor("/map").crumbs).toEqual([{ label: "National map" }]);
    expect(crumbsFor("/").crumbs[0].label).toBe("National dashboard");
    expect(crumbsFor("/analytics/population").crumbs.map((c) => c.label)).toEqual([
      "Decision & analytics",
      "Population",
    ]);
  });
});

describe("switchSchoolPath", () => {
  it("keeps the current sub-page", () => {
    expect(switchSchoolPath("/schools/a/kmz", "b")).toBe("/schools/b/kmz");
    expect(switchSchoolPath("/schools/a", "b")).toBe("/schools/b/decision");
    expect(switchSchoolPath("/map", "b")).toBe("/schools/b/decision");
  });
});

describe("role-based home", () => {
  const leader = {
    role: {
      name: "school_leader",
      permissions: ["SCHOOL_LEVEL_DASHBOARD", "VIEW_SCHOOLS"],
      accessLevel: { slug: "school", name: "School" },
    },
    location: { schoolId: "s1" },
  };
  it("sends school leaders to their school dashboard", () => {
    expect(isSchoolLevelUser(leader)).toBe(true);
    expect(homePathFor(leader)).toBe("/school-dashboard");
  });
  it("sends national roles to the national dashboard", () => {
    expect(
      homePathFor({ role: { name: "admin", permissions: ["VIEW_DASHBOARD"], accessLevel: { slug: "national" } } }),
    ).toBe("/");
    expect(homePathFor({ role: { name: "super_admin", permissions: [] } })).toBe("/");
  });
  it("falls back to welcome without dashboard access", () => {
    expect(homePathFor({ role: { name: "x", permissions: [] } })).toBe("/welcome");
    expect(homePathFor({ ...leader, location: null })).toBe("/welcome");
  });
});

describe("tour persistence", () => {
  it("is shown once per user and variant", () => {
    localStorage.clear();
    expect(tourSeen("u1", "national")).toBe(false);
    markTourSeen("u1", "national");
    expect(tourSeen("u1", "national")).toBe(true);
    expect(tourSeen("u1", "school")).toBe(false);
  });
});
