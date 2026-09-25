import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assembleOverlays, parseMapQuery } from "./map-query.ts";

describe("parseMapQuery", () => {
  it("asks how transit moves through the look-at, not for a timetable", () => {
    const intent = parseMapQuery("how does transit move here");
    assert.equal(intent.kind, "ask");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("transit"));
    assert.ok(intent.overlays.includes("zoning"));
    assert.ok(intent.overlays.includes("streets"));
  });

  it("plugs IoT into IOM instead of treating sensors as a separate map", () => {
    const intent = parseMapQuery("what's changing here");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("iot"));
    assert.ok(intent.overlays.includes("zoning"));
    assert.ok(intent.overlays.includes("transit"));
  });

  it("asks the network what it learned, not for a dump of layers", () => {
    const intent = parseMapQuery("what did we learn here");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("iot"));
    assert.ok(intent.overlays.includes("zoning"));
  });

  it("reads animal terrain at the look-at", () => {
    const intent = parseMapQuery("what's the terrain like here for animals");
    assert.equal(intent.kind, "ask");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("wildlife"));
    assert.ok(intent.overlays.includes("trails"));
    assert.ok(intent.overlays.includes("zoning"));
  });

  it("opens our interior instance instead of a street walk", () => {
    const intent = parseMapQuery("walk inside");
    assert.equal(intent.kind, "walk");
    assert.equal(intent.walk, true);
    assert.equal(intent.indoors, true);
    assert.equal(intent.locationText, null);
    assert.match(intent.summary, /Interior instance/);
  });

  it("drops into ground walk", () => {
    const intent = parseMapQuery("walk this street");
    assert.equal(intent.kind, "walk");
    assert.equal(intent.walk, true);
    assert.ok(intent.overlays.includes("streets"));
    assert.ok(intent.overlays.includes("plots"));
    assert.ok(intent.overlays.includes("plants"));
    assert.ok(intent.overlays.includes("ground"));
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

  it("reads a ground reclass as an edit, not a country hunt", () => {
    const intent = parseMapQuery("this is residential");
    assert.equal(intent.kind, "ask");
    assert.equal(intent.edit, "reclass");
    assert.equal(intent.zoneClass, "residential");
    assert.equal(intent.here, true);
  });

  it("reads vegetation as a queryable layer, not a label", () => {
    const intent = parseMapQuery("what's growing here");
    assert.equal(intent.kind, "ask");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("plants"));
    assert.ok(intent.overlays.includes("zoning"));
  });

  it("asks for rocks and lithology at the look-at", () => {
    const intent = parseMapQuery("what rocks are here");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("ground"));
  });

  it("asks for insects as a taxon, not scenery", () => {
    const intent = parseMapQuery("what bugs are here");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("bugs"));
  });

  it("asks for lidar as ground, not a separate globe", () => {
    const intent = parseMapQuery("lidar here");
    assert.equal(intent.here, true);
    assert.ok(intent.overlays.includes("ground"));
  });

  it("splits the district under the look-at", () => {
    const intent = parseMapQuery("split this zone");
    assert.equal(intent.edit, "split");
    assert.equal(intent.here, true);
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
