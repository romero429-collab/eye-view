import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  absorbLive,
  confirmPatch,
  mergeAt,
  resolveZone,
  writePatch,
  PROMOTE_WEIGHT,
  RIPPLE_GAP_M,
} from "./zone-memory.ts";
import { destination as dest } from "./spatial.ts";

describe("zone memory", () => {
  it("lets a walk reclass override OSM at the look-at", () => {
    let patches = writePatch([], {
      lng: -106.65,
      lat: 35.084,
      action: "reclass",
      class: "residential",
      note: "This is housing",
      source: "walk",
    });
    const resolved = resolveZone(patches, -106.65, 35.084, "industrial", "Industrial");
    assert.equal(resolved.class, "residential");
    assert.equal(resolved.immediate, true);
    assert.match(resolved.label, /residential/i);
    const far = resolveZone(patches, -106.8, 35.2, "industrial", "Industrial");
    assert.equal(far.class, "industrial");
  });

  it("applies the local block immediately and queues neighbors", () => {
    const lng = -106.65;
    const lat = 35.084;
    const patches = writePatch([], {
      lng,
      lat,
      action: "reclass",
      class: "residential",
      source: "walk",
    });
    const here = resolveZone(patches, lng, lat, "industrial", "Industrial");
    assert.equal(here.immediate, true);
    assert.equal(here.class, "residential");
    assert.equal(here.queued, 4);
    const north = dest(lng, lat, 0, RIPPLE_GAP_M);
    const neighbor = resolveZone(patches, north.lng, north.lat, "industrial", "Industrial");
    assert.equal(neighbor.class, "industrial");
    assert.equal(neighbor.immediate, false);
    assert.equal(neighbor.flags[0]?.source, "ripple");
    const confirmed = confirmPatch(patches, neighbor.flags[0].id);
    const after = resolveZone(confirmed, north.lng, north.lat, "industrial", "Industrial");
    assert.equal(after.class, "residential");
    assert.equal(after.immediate, true);
    const extra = confirmed.filter((p) => p.source === "ripple" && p.generation === 1);
    assert.ok(extra.length <= 4);
  });

  it("merges two accepted cells into one larger district", () => {
    let patches = writePatch([], {
      lng: -106.65,
      lat: 35.084,
      action: "reclass",
      class: "commercial",
      source: "walk",
    });
    patches = writePatch(patches, {
      lng: -106.6504,
      lat: 35.0842,
      action: "split",
      class: "retail",
      source: "walk",
    });
    patches = mergeAt(patches, -106.65, 35.084, "commercial");
    const resolved = resolveZone(patches, -106.65, 35.084, "industrial", "Industrial");
    assert.equal(resolved.class, "commercial");
    assert.equal(resolved.patch?.action, "merge");
  });

  it("promotes a live flag after enough confirming evidence", () => {
    const scene = {
      lng: -106.652,
      lat: 35.068,
      zoom: 14,
      zoneClass: "industrial",
      wildlife: 3,
      transit: 0,
      events: 0,
      alerts: 0,
      quakes: 0,
    };
    let patches = absorbLive([], scene, { wildlife: true });
    assert.equal(patches.find((p) => p.source === "live")?.status, "proposed");
    patches = absorbLive(patches, scene, { wildlife: true });
    patches = absorbLive(patches, scene, { wildlife: true });
    const promoted = patches.find((p) => p.action === "reclass" && p.source === "live");
    assert.ok(promoted);
    assert.ok(promoted.weight >= PROMOTE_WEIGHT);
    assert.equal(promoted.status, "accepted");
    const confirmed = confirmPatch(patches, promoted.id);
    assert.equal(confirmed.find((p) => p.id === promoted.id)?.status, "accepted");
  });
});
