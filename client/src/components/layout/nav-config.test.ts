import { describe, expect, it } from "vitest";
import { Permission, type PermissionType } from "../../lib/permissions";
import {
  FOOTER_NAV,
  PRIMARY_NAV,
  activeNavPath,
  badgeText,
  leavesOf,
  resolveNav,
  tourId,
  type NavGroup,
} from "./nav-config";

const accessWith = (perms: PermissionType[], isSchoolLevel = false) => ({
  isSchoolLevel,
  isAuthorized: (p: PermissionType) => perms.includes(p),
  isAnyAuthorized: (ps: PermissionType[]) => ps.some((p) => perms.includes(p)),
});

const ALL = Object.values(Permission) as PermissionType[];

describe("resolveNav", () => {
  it("groups map + directory and the three report pages for a national admin", () => {
    const nav = resolveNav(PRIMARY_NAV, accessWith(ALL));
    const groups = nav.filter((e): e is NavGroup => e.kind === "group");
    expect(groups.map((g) => [g.id, g.items.map((i) => i.path)])).toEqual([
      ["explore", ["/map", "/schools"]],
      ["reporting", ["/reporting", "/reports", "/reports/validate"]],
    ]);
    // School dashboard is for school-level accounts only.
    expect(leavesOf(nav).some((l) => l.path === "/school-dashboard")).toBe(false);
  });

  it("shows a group left with one page as that plain page", () => {
    const nav = resolveNav(
      PRIMARY_NAV,
      accessWith([Permission.SCHOOL_LEVEL_DASHBOARD, Permission.CREATE_REPORT] as PermissionType[], true),
    );
    expect(nav.map((e) => (e.kind === "item" ? e.path : e.id))).toEqual(["/school-dashboard", "/reporting"]);
  });

  it("drops a group with no permitted page and hides settings without admin rights", () => {
    const nav = resolveNav(PRIMARY_NAV, accessWith([Permission.VIEW_DASHBOARD] as PermissionType[]));
    expect(nav.map((e) => e.kind)).toEqual(["item"]);
    expect(resolveNav(FOOTER_NAV, accessWith([]))).toEqual([]);
  });
});

describe("activeNavPath", () => {
  const leaves = leavesOf(resolveNav([...PRIMARY_NAV, ...FOOTER_NAV], accessWith(ALL)));
  it.each([
    ["/", "/"],
    ["/reports/validate", "/reports/validate"],
    ["/reports", "/reports"],
    ["/reports/abc", "/reports"],
    ["/schools/42/3d-explorer", "/schools"],
    ["/analytics/population", "/analytics"],
    ["/settings", "/settings"],
    ["/profile", null],
  ])("%s → %s", (path, expected) => {
    expect(activeNavPath(path, leaves)).toBe(expected);
  });
});

describe("helpers", () => {
  it("keeps the tour ids the guided tour relies on", () => {
    expect(tourId("/")).toBe("nav-dashboard");
    expect(tourId("/reporting")).toBe("nav-reporting");
    expect(tourId("/school-dashboard")).toBe("nav-school-dashboard");
  });
  it("formats badges", () => {
    expect(badgeText(null)).toBeNull();
    expect(badgeText(0)).toBeNull();
    expect(badgeText(7)).toBe("7");
    expect(badgeText(140)).toBe("99+");
  });
});
