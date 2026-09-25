import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { frameFromRing, houseAt, pickFootprint, planFromSurvey, pointInRing, shellFromRing } from "./interior.ts";
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
  it("opens the same schematic only when asked, and says so", () => {
    const a = houseAt(-104.9449, 34.7801);
    const b = houseAt(-104.9449, 34.7801);
    assert.deepEqual(a.rooms, ["Living", "Kitchen", "Bedroom", "Bath"]);
    assert.equal(a.bearing, b.bearing);
    assert.match(String(a.features.features[0]?.properties?.detail), /Not a measured floor plan/);
  });

  it("fits a schematic to a footprint instead of a random angle", () => {
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
    const picked = pickFootprint([ring], -104.9449, 34.78015);
    assert.equal(picked?.frame.bearing, frame?.bearing);
    assert.equal(picked?.ring.length, ring.length);
    const loose = floorSpan(-104.9449, 34.78015);
    const fitted = floorSpan(-104.9449, 34.78015, frame ?? undefined);
    assert.ok(fitted.max > loose.max);
  });

  it("shells the real footprint and does not invent rooms", () => {
    const ring: [number, number][] = [
      [-104.94505, 34.78005],
      [-104.94485, 34.78005],
      [-104.94485, 34.78018],
      [-104.94505, 34.78018],
      [-104.94505, 34.78005],
    ];
    const shell = shellFromRing(ring, { title: "1035", levels: "1" });
    const floors = shell.features.filter((f) => f.properties?.part === "floor");
    assert.equal(floors.length, 1);
    assert.equal(floors[0]?.properties?.title, "1035");
    assert.match(String(floors[0]?.properties?.detail), /not invented/);
    assert.ok(shell.features.filter((f) => f.properties?.part === "wall").length >= 4);
  });

  it("uses mapped room names and cuts a door", () => {
    const plan = planFromSurvey(
      [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [-104.945, 34.78],
              [-104.9449, 34.78],
              [-104.9449, 34.78008],
              [-104.945, 34.78008],
              [-104.945, 34.78],
            ]],
          },
          properties: { title: "Kitchen", level: "0" },
        },
      ],
      [[-104.94495, 34.78]],
    );
    assert.equal(plan.measured, true);
    assert.deepEqual(plan.levels, ["0"]);
    const floor = plan.features.features.find((f) => f.properties?.part === "floor");
    assert.equal(floor?.properties?.title, "Kitchen");
    assert.equal(floor?.properties?.color, "#d4c2a0");
    assert.match(String(floor?.properties?.detail), /Measured room geometry/);
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
