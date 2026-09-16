import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NDVI_EXPLAIN, stemsFromPlants, terrainExaggeration } from "./ground.ts";

describe("ground GIS", () => {
  it("explains NDVI as a greenness metric, not a tint", () => {
    assert.match(NDVI_EXPLAIN.detail, /near-infrared/i);
    assert.match(NDVI_EXPLAIN.title, /NDVI/i);
  });

  it("extrudes trees and skips grass points", () => {
    const stems = stemsFromPlants({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-106.52, 35.08] },
          properties: { title: "Rio Grande cottonwood", kind: "plant" },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-106.53, 35.09] },
          properties: { title: "Grass", kind: "plant" },
        },
      ],
    });
    assert.equal(stems.features.length, 1);
    assert.equal(stems.features[0]?.geometry.type, "Polygon");
    assert.ok(Number(stems.features[0]?.properties?.height) >= 10);
  });

  it("exaggerates terrain more in walk mode", () => {
    assert.ok(terrainExaggeration(true) > terrainExaggeration(false));
  });
});
