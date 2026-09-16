import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OVERLAYS } from "./basemaps.ts";
import { writePatch } from "./zone-memory.ts";
import { calibrate, draw, publish, resetMindsForTests, shareLook, skillId } from "./minds.ts";

const scene = {
  lng: -106.65,
  lat: 35.08,
  zoneClass: "residential" as string | null,
  zoneLabel: "Residential",
  wildlife: 0,
  plants: 0,
  events: 0,
  alerts: 0,
  quakes: 0,
  sensors: 1,
  precip: 0,
};

describe("Internet of Minds", () => {
  it("shares a walk reclass so other minds can draw it", () => {
    const patches = writePatch([], {
      lng: -106.65,
      lat: 35.08,
      action: "reclass",
      class: "park",
      source: "walk",
    });
    const pool = shareLook({ pool: [], scene, patches, now: 1 });
    assert.ok(pool.some((s) => s.mind === "walk" && s.klass === "park"));
    const drawn = draw(pool, "transit", "park");
    assert.ok(drawn.some((s) => s.mind === "walk"));
  });

  it("raises evidence on a skill without duplicating it", () => {
    const first = publish([], {
      id: skillId("walk", "district:park"),
      mind: "walk",
      name: "this is park",
      klass: "park",
      lng: 0,
      lat: 0,
      t: 1,
    });
    const second = publish(first, {
      id: skillId("walk", "district:park"),
      mind: "walk",
      name: "this is park",
      klass: "park",
      lng: 1,
      lat: 1,
      t: 20_000,
    });
    assert.equal(second.length, 1);
    assert.equal(second[0].evidence, 2);
  });

  it("live-calibrates: mismatch drops the score, a learned district lifts it", () => {
    resetMindsForTests();
    const low = calibrate({
      scene: { ...scene, zoneClass: "industrial", zoneLabel: "Industrial", wildlife: 4 },
      overlays: { ...DEFAULT_OVERLAYS, wildlife: true, zoning: true },
      now: 1,
    });
    resetMindsForTests();
    const patches = writePatch([], {
      lng: -106.65,
      lat: 35.08,
      action: "reclass",
      class: "residential",
      source: "walk",
    });
    const high = calibrate({
      scene: { ...scene, sensors: 2 },
      overlays: { ...DEFAULT_OVERLAYS, iot: true, zoning: true, transit: true },
      patches,
      now: 2,
    });
    assert.ok(low.score < high.score);
    assert.ok(low.matter.some((m) => /wildlife/i.test(m)));
    assert.ok(high.matter.some((m) => /learned|sensors/i.test(m)));
  });
});
