import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COVER_SWATCHES,
  HEAT_RAMPS,
  LANDUSE_SWATCHES,
  densityObject,
  heatmapColorExpr,
  zoneLabel,
} from "./heat.ts";

describe("heat ramps", () => {
  it("keeps wildlife and quake ramps sequential and labeled", () => {
    for (const id of ["wildlife", "quakes", "livestock", "health"] as const) {
      const ramp = HEAT_RAMPS[id];
      assert.ok(ramp.length >= 4);
      assert.equal(ramp[0]?.t, 0);
      assert.equal(ramp[ramp.length - 1]?.t, 1);
      for (let i = 1; i < ramp.length; i++) {
        assert.ok(ramp[i]!.t > ramp[i - 1]!.t);
      }
    }
  });

  it("builds a MapLibre heatmap-color expression from the ramp", () => {
    const expr = heatmapColorExpr("wildlife");
    assert.equal(expr[0], "interpolate");
    assert.ok(expr.includes("#d4a054"));
  });
});

describe("zoning swatches", () => {
  it("covers urban landuse and rural landcover so fills are not a single wash", () => {
    const ids = new Set([...LANDUSE_SWATCHES, ...COVER_SWATCHES].map((s) => s.id));
    assert.ok(ids.has("residential"));
    assert.ok(ids.has("industrial"));
    assert.ok(ids.has("recreation"));
    assert.ok(ids.has("extractive"));
    assert.ok(ids.has("pasture"));
    const colors = [...LANDUSE_SWATCHES, ...COVER_SWATCHES].map((s) => s.color);
    assert.equal(new Set(colors).size, colors.length);
    assert.equal(zoneLabel("wood"), "Park / wood");
    assert.equal(zoneLabel("garages"), "Industrial");
    assert.equal(zoneLabel("stadium"), "Recreation");
    assert.equal(zoneLabel("quarry"), "Quarry / landfill");
    assert.equal(zoneLabel("meadow"), "Pasture");
  });
});

describe("densityObject", () => {
  it("names a wildlife heat cell so it cannot be read as a country", () => {
    const obj = densityObject("wildlife", -106.65, 35.08);
    assert.equal(obj.kind, "sighting");
    assert.equal(obj.layer, "Wild");
    assert.match(obj.title, /wildlife/i);
    assert.match(obj.detail, /not a country/i);
    assert.equal(obj.lng, -106.65);
  });
});
