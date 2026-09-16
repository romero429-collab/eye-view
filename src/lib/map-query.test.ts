import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assembleOverlays, parseMapQuery } from "./map-query.ts";

describe("parseMapQuery", () => {
  it("assembles transit inside a named zone instead of a toggle hunt", () => {
    const intent = parseMapQuery("show me all transit routes in industrial");
    assert.equal(intent.kind, "ask");
    assert.ok(intent.overlays.includes("transit"));
    assert.ok(intent.overlays.includes("zoning"));
    assert.ok(intent.overlays.includes("streets"));
    assert.equal(intent.zoneClass, "industrial");
  });

  it("reads animal terrain at the look-at", () => {
    const intent = parseMapQuery("what's the terrain like here for animals");
    assert.equal(intent.kind, "ask");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("wildlife"));
    assert.ok(intent.overlays.includes("trails"));
    assert.ok(intent.overlays.includes("zoning"));
  });

  it("drops into ground walk", () => {
    const intent = parseMapQuery("walk this street");
    assert.equal(intent.kind, "walk");
    assert.equal(intent.walk, true);
    assert.ok(intent.overlays.includes("streets"));
    assert.ok(intent.overlays.includes("plots"));
  });

  it("treats this zone as the look-at, not a named district class", () => {
    const intent = parseMapQuery("transit in this zone");
    assert.equal(intent.kind, "ask");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("transit"));
    assert.ok(intent.overlays.includes("zoning"));
    assert.equal(intent.zoneClass, null);
  });

  it("names recreation as a district class", () => {
    const intent = parseMapQuery("recreation here");
    assert.equal(intent.kind, "ask");
    assert.equal(intent.here, true);
    assert.equal(intent.zoneClass, "recreation");
    assert.ok(intent.overlays.includes("zoning"));
  });
});

describe("assembleOverlays", () => {
  it("turns on just the coordinated set", () => {
    const next = assembleOverlays(parseMapQuery("transit in residential"));
    assert.equal(next.transit, true);
    assert.equal(next.streets, true);
    assert.equal(next.zoning, true);
    assert.equal(next.flights, false);
    assert.equal(next.metric, false);
  });
});
