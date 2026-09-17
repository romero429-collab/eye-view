import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assetsFromGround, assetsFromPlants, mulberry32, treeAt } from "./proc-assets.ts";

describe("low-poly GIS assets", () => {
  it("grows the same tree at the same coordinate", () => {
    const a = treeAt(-106.522, 35.0875, "Rio Grande cottonwood", "tree");
    const b = treeAt(-106.522, 35.0875, "Rio Grande cottonwood", "tree");
    assert.equal(a.length, b.length);
    assert.ok(a.some((f) => f.properties?.kind === "trunk"));
    assert.ok(a.some((f) => f.properties?.kind === "crown"));
    const ha = a.find((f) => f.properties?.kind === "crown")?.properties?.height;
    const hb = b.find((f) => f.properties?.kind === "crown")?.properties?.height;
    assert.equal(ha, hb);
  });

  it("skips grass and keeps a cottonwood at its lng/lat", () => {
    const fc = assetsFromPlants({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-106.522, 35.0875] },
          properties: { title: "Rio Grande cottonwood", kind: "plant" },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-106.53, 35.09] },
          properties: { title: "Grass", kind: "plant" },
        },
      ],
    });
    assert.ok(fc.features.length >= 2);
    assert.ok(fc.features.every((f) => f.geometry.type === "Polygon"));
    assert.ok(fc.features.some((f) => Number(f.properties?.lng) === -106.522));
    assert.ok(!fc.features.some((f) => /grass/i.test(String(f.properties?.title))));
  });

  it("turns ground points into faceted rocks, not ditches", () => {
    const fc = assetsFromGround({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [139.76, 35.68] },
          properties: { kind: "rock", title: "basalt" },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [139.77, 35.69] },
          properties: { kind: "ditch", title: "drain" },
        },
      ],
    });
    assert.equal(fc.features.length, 1);
    assert.equal(fc.features[0]?.properties?.kind, "rock");
    assert.ok(Number(fc.features[0]?.properties?.height) > 0.5);
  });

  it("is a seeded generator, not Math.random", () => {
    const rng = mulberry32(42);
    assert.equal(rng().toFixed(6), mulberry32(42)().toFixed(6));
  });
});
