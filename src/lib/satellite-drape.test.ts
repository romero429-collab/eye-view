import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paintSatelliteColors } from "./satellite-drape.ts";

describe("satellite paint", () => {
  it("keeps the existing feature when the imagery cannot be sampled", async () => {
    const painted = await paintSatelliteColors(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [[
                [-104.945, 34.78],
                [-104.9448, 34.78],
                [-104.9448, 34.7801],
                [-104.945, 34.7801],
                [-104.945, 34.78],
              ]],
            },
            properties: { height: 8, color: "#1e4a32" },
          },
        ],
      },
      16,
    );
    assert.equal(painted.features.length, 1);
    assert.equal(painted.features[0]?.geometry.type, "Polygon");
    assert.equal(painted.features[0]?.properties?.height, 8);
  });
});
