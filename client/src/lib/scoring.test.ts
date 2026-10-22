import { describe, expect, it } from "vitest";
import { FALLBACK_SCORING_MODEL, bandOf, bandRanges, weightLabel } from "./scoring";

describe("client scoring model", () => {
  it("bands follow the served model", () => {
    expect(bandOf(34)).toBe("critical");
    expect(bandOf(35)).toBe("high");
    expect(bandOf(54.9)).toBe("high");
    expect(bandOf(55)).toBe("medium");
    expect(bandOf(75)).toBe("low");
    const custom = {
      ...FALLBACK_SCORING_MODEL,
      bands: { ...FALLBACK_SCORING_MODEL.bands, low: { min: 80, max: 100 } },
    };
    expect(bandOf(78, custom)).toBe("medium");
  });
  it("weights sum to 100 % and render as labels", () => {
    const sum = Object.values(FALLBACK_SCORING_MODEL.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
    expect(weightLabel("resolution")).toBe("5%");
    expect(bandRanges()[0]).toEqual({ key: "critical", range: "0–34" });
  });
});
