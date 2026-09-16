import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OVERLAYS } from "./basemaps.ts";
import { densityObject } from "./heat.ts";
import { buildPerception, formatDecimal, groundOwnsInspector } from "./perception.ts";

describe("perception frame", () => {
  it("treats the country as ground context, not the inspected object", () => {
    const object = {
      ...densityObject("wildlife", -106.6504, 35.0844),
      ground: "United States",
      facts: [
        { label: "Ground", value: "United States" },
        { label: "Layer", value: "Wild" },
      ],
    };
    const frame = buildPerception({
      scene: {
        lng: -106.6504,
        lat: 35.0844,
        zoom: 12,
        bearing: 0,
        pitch: 0,
        zoneClass: "residential",
        zoneLabel: "Residential",
        quakes: 0,
        transit: 0,
        wildlife: 1,
      },
      overlays: { ...DEFAULT_OVERLAYS, wildlife: true, zoning: true, metric: false },
      object,
      rules: [
        {
          id: "container",
          effect: "container",
          title: "Residential contains the view",
          detail: "",
          local: true,
        },
      ],
      attention: { wildlife: 2 },
      now: 1,
    });
    assert.equal(frame.focus?.kind, "sighting");
    assert.equal(frame.focus?.layer, "Wild");
    assert.equal(frame.country, "United States");
    assert.equal(frame.zone?.class, "residential");
    assert.ok(frame.overlays.includes("wildlife"));
    assert.equal(frame.look.lng, -106.6504);
    assert.match(formatDecimal(-106.6504, 35.0844), /35\.08440/);
  });

  it("gives the inspector to ground overlays so a heat cell cannot open GDP", () => {
    assert.equal(groundOwnsInspector({ ...DEFAULT_OVERLAYS, wildlife: true }, 4), true);
    assert.equal(groundOwnsInspector(DEFAULT_OVERLAYS, 2), false);
    assert.equal(groundOwnsInspector(DEFAULT_OVERLAYS, 6), true);
  });
});
