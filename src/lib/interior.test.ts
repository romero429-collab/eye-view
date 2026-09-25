import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { frameFromRing, houseAt, pickFootprint, pointInRing } from "./interior.ts";
import { haversineMeters } from "./spatial.ts";

function floorSpan(lng: number, lat: number, frame?: { lng: number; lat: number; bearing: number; width: number; depth: number }) {
  const house = houseAt(lng, lat, frame);
  const floor = house.features.features.find((f) => f.properties?.title === "Living");
  const ring = floor?.geometry.type === "Polygon" ? floor.geometry.coordinates[0] : [];
  let max = 0;
  for (const p of ring ?? []) {
    max = Math.max(max, haversineMeters(house.lng, house.lat, p[0], p[1]));
  }
  return { house, max };
}

describe("interior instance", () => {
  it("opens the same rooms at the same look-at", () => {
    const a = houseAt(-104.9449, 34.7801);
    const b = houseAt(-104.9449, 34.7801);
    assert.deepEqual(a.rooms, ["Living", "Kitchen", "Bedroom", "Bath"]);
    assert.equal(a.bearing, b.bearing);
    assert.equal(a.fitted, false);
    assert.equal(a.features.features.length, b.features.features.length);
    assert.ok(a.features.features.some((f) => f.properties?.part === "wall"));
    assert.ok(a.features.features.some((f) => f.properties?.title === "Sofa"));
  });

  it("fits the plan to a footprint instead of a random angle", () => {
    const ring: [number, number][] = [
      [-104.9452, 34.78],
      [-104.9446, 34.78],
      [-104.9446, 34.78035],
      [-104.9452, 34.78035],
      [-104.9452, 34.78],
    ];
    assert.equal(pointInRing(-104.9449, 34.78015, ring), true);
    const frame = frameFromRing(ring);
    assert.ok(frame);
    assert.ok((frame?.width ?? 0) > (frame?.depth ?? 0));
    const picked = pickFootprint([ring], -104.9449, 34.78015);
    assert.equal(picked?.bearing, frame?.bearing);
    const loose = floorSpan(-104.9449, 34.78015);
    const fitted = floorSpan(-104.9449, 34.78015, frame ?? undefined);
    assert.equal(fitted.house.fitted, true);
    assert.ok(fitted.max > loose.max);
    assert.match(String(fitted.house.features.features[0]?.properties?.detail), /footprint/);
  });

  it("does not snap to a building that is far away", () => {
    const ring: [number, number][] = [
      [139.7, 35.6],
      [139.701, 35.6],
      [139.701, 35.601],
      [139.7, 35.601],
      [139.7, 35.6],
    ];
    assert.equal(pickFootprint([ring], -104.94, 34.78), null);
  });
});
