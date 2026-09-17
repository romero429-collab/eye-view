import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NDVI_EXPLAIN, lidarCoverageLine, pickElevation, stemsFromPlants, terrainExaggeration } from "./ground.ts";

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
    assert.ok(stems.features.length >= 2);
    assert.ok(stems.features.every((f) => f.geometry.type === "Polygon"));
    assert.ok(stems.features.some((f) => f.properties?.kind === "trunk"));
    assert.ok(stems.features.some((f) => f.properties?.kind === "crown"));
    assert.ok(Number(stems.features.find((f) => f.properties?.kind === "crown")?.properties?.height) >= 6);
  });

  it("exaggerates terrain more in walk mode", () => {
    assert.ok(terrainExaggeration(true) > terrainExaggeration(false));
  });

  it("never treats a missing USGS answer as no height", () => {
    const tokyo = pickElevation(0, 12);
    assert.equal(tokyo?.meters, 12);
    assert.equal(tokyo?.source, "Open-Meteo DEM");
    assert.match(lidarCoverageLine({ icesat: [315] }), /ICESat-2 tracks 315/);
  });
});
