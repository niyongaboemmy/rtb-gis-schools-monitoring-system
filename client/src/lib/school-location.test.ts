import { describe, expect, it } from "vitest";
import { checkPoint, locationSourceLabel, schoolPoint } from "./school-location";

describe("school location", () => {
  it("reads decimal strings and drops 0,0, swapped or foreign points", () => {
    expect(schoolPoint({ latitude: "-1.9626354", longitude: "30.5533304" })).toEqual({ lat: -1.9626354, lng: 30.5533304 });
    expect(schoolPoint({ latitude: 0, longitude: 0 })).toBeNull();
    expect(schoolPoint({ latitude: 30.55, longitude: -1.96 })).toBeNull();
    expect(schoolPoint({ latitude: 48.85, longitude: 2.35 })).toBeNull();
    expect(schoolPoint(null)).toBeNull();
  });

  it("explains a bad point in the same words as the server", () => {
    expect(checkPoint("-1.94", "30.06")).toBeNull();
    expect(checkPoint(30.06, -1.94)).toMatch(/swapped/);
    expect(checkPoint(5, 5)).toMatch(/outside Rwanda/);
  });

  it("names where a location came from", () => {
    expect(locationSourceLabel("kmz")).toBe("From the site map (KMZ)");
    expect(locationSourceLabel(null)).toBeNull();
  });
});
