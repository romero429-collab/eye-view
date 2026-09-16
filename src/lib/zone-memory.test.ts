import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  absorbLive,
  confirmPatch,
  mergeAt,
  resolveZone,
  writePatch,
  PROMOTE_WEIGHT,
} from "./zone-memory.ts";

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
    assert.match(resolved.label, /residential/i);
    const far = resolveZone(patches, -106.8, 35.2, "industrial", "Industrial");
    assert.equal(far.class, "industrial");
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
    assert.equal(patches[0]?.status, "proposed");
    patches = absorbLive(patches, scene, { wildlife: true });
    patches = absorbLive(patches, scene, { wildlife: true });
    const promoted = patches.find((p) => p.action === "reclass");
    assert.ok(promoted);
    assert.ok(promoted.weight >= PROMOTE_WEIGHT);
    assert.equal(promoted.status, "accepted");
    const confirmed = confirmPatch(patches, promoted.id);
    assert.equal(confirmed.find((p) => p.id === promoted.id)?.status, "accepted");
  });
});
