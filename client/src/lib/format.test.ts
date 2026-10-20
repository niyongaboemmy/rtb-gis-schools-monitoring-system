import { describe, expect, it } from "vitest";
import {
  formatArea, formatCurrency, formatDate, formatDateTime, formatHectares,
  formatLength, formatPercent, formatRatio, formatRelative, formatScore,
} from "./format";

describe("format", () => {
  it("lengths use honest precision per source", () => {
    expect(formatLength(12.3456)).toBe("12.3 m");
    expect(formatLength(12.3456, "3d")).toBe("12.35 m");
    expect(formatLength(1250)).toBe("1.25 km");
    expect(formatLength(null)).toBe("—");
    expect(formatLength(Number.NaN)).toBe("—");
  });

  it("areas switch to hectares at 1 ha", () => {
    expect(formatArea(450.55)).toBe("450.6 m²");
    expect(formatArea(12500)).toBe("1.25 ha (12,500 m²)");
  });

  it("land is ha, never h", () => {
    expect(formatHectares(2.5)).toBe("2.50 ha");
  });

  it("percent, score, ratio, currency", () => {
    expect(formatPercent(72.4)).toBe("72%");
    expect(formatPercent(0.5, { ratio: true })).toBe("50%");
    expect(formatScore(71.6)).toBe("72");
    expect(formatScore(undefined)).toBe("—");
    expect(formatRatio(640, 20)).toBe("32:1");
    expect(formatRatio(5, 0)).toBe("—");
    expect(formatCurrency(1250000)).toBe("RWF 1,250,000");
  });

  it("dates render in Kigali time (UTC+2)", () => {
    expect(formatDate("2026-10-13T23:30:00Z")).toBe("14 Oct 2026");
    expect(formatDateTime("2026-10-13T12:05:00Z")).toBe("13 Oct 2026, 14:05");
    expect(formatDate("not a date")).toBe("—");
  });

  it("relative times", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(formatRelative(new Date("2026-10-13T11:55:00Z"), now)).toBe("5 minutes ago");
    expect(formatRelative(new Date("2026-08-01T00:00:00Z"), now)).toBe("1 Aug 2026");
  });
});
