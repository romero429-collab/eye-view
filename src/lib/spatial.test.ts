import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { destination, haversineMeters, stemPolygon, wrapBearing } from "./spatial.ts";

describe("spatial", () => {
  it("moves north roughly 111 km per degree", () => {
    const end = destination(-106.65, 35, 0, 111320);
    assert.ok(Math.abs(end.lat - 36) < 0.02);
    assert.ok(Math.abs(end.lng + 106.65) < 0.02);
  });

  it("wraps bearing and measures Albuquerque-scale distances", () => {
    assert.equal(wrapBearing(-90), 270);
    const d = haversineMeters(-106.65, 35.08, -106.64, 35.08);
    assert.ok(d > 800 && d < 1100);
  });

  it("builds a stem polygon that contains its center", () => {
    const stem = stemPolygon(-106.522, 35.0875, 4, { height: 12 });
    const ring = stem.geometry.coordinates[0];
    assert.ok(ring.length >= 8);
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    assert.ok(Math.min(...lons) < -106.522 && Math.max(...lons) > -106.522);
    assert.ok(Math.min(...lats) < 35.0875 && Math.max(...lats) > 35.0875);
    assert.equal(stem.properties.height, 12);
  });
});
