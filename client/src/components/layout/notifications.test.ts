import { beforeEach, describe, expect, it } from "vitest";
import {
  describeAssignment,
  describeStatusChange,
  useNotifications,
} from "./notifications";

describe("notifications", () => {
  beforeEach(() => {
    localStorage.clear();
    useNotifications.getState().bind("u1");
  });

  it("describes a status change in plain language with a deep link", () => {
    const n = describeStatusChange(
      { reportId: "r1", schoolId: "s1", newStatus: "SOLVED" },
      "/reporting",
    );
    expect(n.title).toBe("Report resolved");
    expect(n.body).toMatch(/resolved/);
    expect(n.href).toBe("/reporting?report=r1");
    expect(n.body).not.toMatch(/SOLVED|NEED_INTERVENTION/);
  });

  it("describes a change-request assignment", () => {
    const n = describeAssignment(
      { reportId: "r2", schoolId: "s1", fields: ["latitude", "headTeacher"] },
      "/reports",
    );
    expect(n.body).toContain("latitude, head teacher");
  });

  it("persists per user, counts unread and marks all read", () => {
    const s = useNotifications.getState();
    s.add({ title: "a", body: "b", tone: "info" });
    s.add({ id: "x", title: "c", body: "d", tone: "info" });
    s.add({ id: "x", title: "dup", body: "dup", tone: "info" });
    expect(useNotifications.getState().items).toHaveLength(2);
    useNotifications.getState().markAllRead();
    expect(useNotifications.getState().items.every((i) => i.read)).toBe(true);

    useNotifications.getState().bind("u2");
    expect(useNotifications.getState().items).toHaveLength(0);
    useNotifications.getState().bind("u1");
    expect(useNotifications.getState().items).toHaveLength(2);
  });
});
