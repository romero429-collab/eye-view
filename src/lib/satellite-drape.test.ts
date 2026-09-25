import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { meshFromPolys, polysFromFeatures, texFrameForRing } from "./satellite-drape.ts";

describe("satellite drape", () => {
  it("builds a roof and walls whose UVs sit inside the imagery frame", () => {
    const ring: [number, number][] = [
      [-104.945, 34.78],
      [-104.9448, 34.78],
      [-104.9448, 34.78012],
      [-104.945, 34.78012],
      [-104.945, 34.78],
    ];
    const mesh = meshFromPolys([{ ring, height: 8, base: 0, ground: 1600 }], 17);
    assert.ok(mesh);
    assert.ok(mesh.idx.length >= 6 + 24);
    for (let i = 0; i < mesh.uv.length; i += 2) {
      assert.ok(mesh.uv[i]! >= -0.05 && mesh.uv[i]! <= 1.05);
      assert.ok(mesh.uv[i + 1]! >= -0.05 && mesh.uv[i + 1]! <= 1.05);
    }
    const frame = texFrameForRing(ring, 17);
    assert.ok(frame.z >= 13 && frame.z <= 17);
    assert.ok(frame.x1 >= frame.x0);
  });

  it("reads extrusion height off the feature instead of a flat color", () => {
    const polys = polysFromFeatures(
      [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [0, 0],
              [0.001, 0],
              [0.001, 0.001],
              [0, 0.001],
              [0, 0],
            ]],
          },
          properties: { height: 12, base: 1 },
        },
      ],
      6,
    );
    assert.equal(polys.length, 1);
    assert.equal(polys[0]?.height, 12);
    assert.equal(polys[0]?.base, 1);
  });
});
