import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OVERLAYS } from "./basemaps.ts";
import { writePatch } from "./zone-memory.ts";
import { isPaperRoute, perceiveMovement, rememberCorridor } from "./transit-sense.ts";

const scene = (zoneClass: string, extra: Partial<{ events: number; alerts: number; quakes: number; transit: number }> = {}) => ({
  lng: -106.65,
  lat: 35.08,
  zoneClass,
  zoneLabel: zoneClass[0]!.toUpperCase() + zoneClass.slice(1),
  transit: extra.transit ?? 2,
  events: extra.events ?? 0,
  alerts: extra.alerts ?? 0,
  quakes: extra.quakes ?? 0,
});

describe("transit sense", () => {
  it("treats residential as a corridor that would carry movement", () => {
    const sense = perceiveMovement({
      scene: scene("residential"),
      overlays: { ...DEFAULT_OVERLAYS, transit: true, zoning: true },
    });
    assert.equal(sense.mood, "flowing");
    assert.match(sense.title, /moving through|would carry/i);
  });

  it("constrains industrial instead of snapping a paper route", () => {
    const sense = perceiveMovement({
      scene: scene("industrial"),
      overlays: { ...DEFAULT_OVERLAYS, transit: true, zoning: true },
    });
    assert.equal(sense.mood, "constrained");
  });

  it("reroutes when a hazard sits in the district", () => {
    const sense = perceiveMovement({
      scene: scene("residential", { events: 1 }),
      overlays: { ...DEFAULT_OVERLAYS, transit: true, zoning: true, events: true },
    });
    assert.equal(sense.mood, "reroute");
    assert.match(sense.title, /hazard/i);
  });

  it("orphans a route after a learned reclass off the corridor", () => {
    const patches = writePatch([], {
      lng: -106.65,
      lat: 35.08,
      action: "reclass",
      class: "park",
      source: "walk",
    });
    const sense = perceiveMovement({
      scene: scene("commercial"),
      overlays: { ...DEFAULT_OVERLAYS, transit: true, zoning: true },
      patches,
    });
    assert.equal(sense.mood, "orphan");
    assert.equal(sense.learned, true);
  });

  it("marks a corridor as paper after enough blocked evidence", () => {
    let book = rememberCorridor({}, "industrial", "constrained", 2);
    book = rememberCorridor(book, "industrial", "constrained", 2);
    assert.equal(isPaperRoute(book, "industrial"), true);
    assert.equal(isPaperRoute(book, "residential"), false);
  });
});
