import { describe, expect, it } from "vitest";
import { formatDaysAgo, formatTrendPct } from "./issueReportMetrics";

describe("issue report display helpers", () => {
  it("formatDaysAgo counts Kigali calendar days", () => {
    const now = new Date("2026-10-21T06:00:00Z"); // 08:00 in Kigali
    // 23:00 Kigali the previous evening — less than 24 h ago, but yesterday.
    expect(formatDaysAgo("2026-10-20T21:00:00Z", now)).toBe("Yesterday");
    expect(formatDaysAgo("2026-10-21T00:30:00Z", now)).toBe("Today");
    expect(formatDaysAgo("2026-10-17T10:00:00Z", now)).toBe("4d ago");
    expect(formatDaysAgo(null, now)).toBe("—");
  });
  it("formatTrendPct shows a dash when there is no baseline", () => {
    expect(formatTrendPct(null)).toBe("—");
    expect(formatTrendPct(12.5)).toBe("+12.5% vs last month");
  });
});
