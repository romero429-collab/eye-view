import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OVERLAYS } from "./basemaps.ts";
import { orchestrate } from "./iom.ts";
import { writePatch } from "./zone-memory.ts";

const scene = {
  lng: -106.65,
  lat: 35.08,
  zoneClass: "residential" as string | null,
  zoneLabel: "Residential",
  transit: 0,
  wildlife: 0,
  plants: 0,
  events: 0,
  alerts: 0,
  quakes: 0,
  sensors: 1,
  precip: 0,
  temp: 18,
  wind: 8,
};

describe("IOM", () => {
  it("reroutes transit when IoT precip hits the district", () => {
    const cons = orchestrate({
      scene: { ...scene, precip: 2.4 },
      overlays: { ...DEFAULT_OVERLAYS, iot: true, transit: true, zoning: true },
    });
    assert.ok(cons.some((c) => c.id === "iom-weather" && c.action === "reroute" && c.target === "transit"));
  });

  it("updates perception and adapts transit after a ground reclass", () => {
    const patches = writePatch([], {
      lng: -106.65,
      lat: 35.08,
      action: "reclass",
      class: "park",
      source: "walk",
    });
    const cons = orchestrate({
      scene,
      overlays: { ...DEFAULT_OVERLAYS, zoning: true, transit: true },
      patches,
    });
    assert.ok(cons.some((c) => c.id === "iom-walk" && c.action === "update"));
    assert.ok(cons.some((c) => c.id === "iom-zone-transit" && c.action === "adapt"));
  });

  it("anticipates wildlife on vegetated cover", () => {
    const cons = orchestrate({
      scene: { ...scene, plants: 4, wildlife: 1 },
      overlays: { ...DEFAULT_OVERLAYS, plants: true, wildlife: true, zoning: true },
    });
    assert.ok(cons.some((c) => c.id === "iom-migrate" && c.action === "anticipate"));
  });

  it("treats plants as a structural GIS skill other minds can draw", () => {
    const cons = orchestrate({
      scene: { ...scene, plants: 3, zoneClass: "commercial", zoneLabel: "Commercial" },
      overlays: { ...DEFAULT_OVERLAYS, plants: true, zoning: true },
    });
    assert.ok(cons.some((c) => c.id === "iom-plants" && c.target === "plants"));
    assert.ok(cons.some((c) => c.id === "iom-plants-zone" && c.action === "adapt" && c.target === "zone"));
  });

  it("shows the nerve as live even in fair weather", () => {
    const cons = orchestrate({
      scene: { ...scene, sensors: 2, precip: 0 },
      overlays: { ...DEFAULT_OVERLAYS, iot: true, zoning: true },
    });
    assert.ok(cons.some((c) => c.id === "iom-wired"));
  });
});
