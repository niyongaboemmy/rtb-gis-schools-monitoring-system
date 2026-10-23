import { describe, expect, it } from "vitest";
import { existing3dModel } from "./school-model";

describe("existing3dModel", () => {
  it("finds the model on the school (current uploads)", () => {
    expect(existing3dModel({ kmzFilePath: "/files/schools/a/3d/site.glb", buildings: [] })).toBe("/files/schools/a/3d/site.glb");
  });
  it("falls back to a legacy building row", () => {
    expect(existing3dModel({ kmzFilePath: null, buildings: [{ modelPath: "/files/x/old.GLB" }] })).toBe("/files/x/old.GLB");
  });
  it("is null without a GLB (a KMZ path is not a 3D model)", () => {
    expect(existing3dModel({ kmzFilePath: "/files/schools/a/kmz/site.kmz", buildings: [{ modelPath: null }] })).toBeNull();
  });
});
