import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OVERLAYS } from "./basemaps.ts";
import {
  coordinateToggle,
  evaluateRules,
  radarDimFactor,
  zoneClassOf,
} from "./zoning-rules.ts";

describe("zoneClassOf", () => {
  it("maps OSM landuse and landcover classes onto HUD swatches", () => {
    assert.equal(zoneClassOf("garages"), "industrial");
    assert.equal(zoneClassOf("hospital"), "civic");
    assert.equal(zoneClassOf("stadium"), "recreation");
    assert.equal(zoneClassOf("quarry"), "extractive");
    assert.equal(zoneClassOf("meadow"), "pasture");
    assert.equal(zoneClassOf("wood"), "park");
    assert.equal(zoneClassOf("farmland"), "farmland");
    assert.equal(zoneClassOf("nope"), "unknown");
  });
});

describe("coordinateToggle", () => {
  it("pulls streets when transit comes on, and zoning when wildlife does", () => {
    const withTransit = coordinateToggle(DEFAULT_OVERLAYS, "transit");
    assert.equal(withTransit.transit, true);
    assert.equal(withTransit.streets, true);
    const withWild = coordinateToggle(DEFAULT_OVERLAYS, "wildlife");
    assert.equal(withWild.wildlife, true);
    assert.equal(withWild.zoning, true);
    assert.equal(withWild.metric, false);
    const withPlants = coordinateToggle(DEFAULT_OVERLAYS, "plants");
    assert.equal(withPlants.plants, true);
    assert.equal(withPlants.zoning, true);
    assert.equal(withPlants.metric, false);
  });
});

describe("evaluateRules", () => {
  it("treats zoning as the container and flags wildlife in industrial", () => {
    const hits = evaluateRules({
      overlays: { ...DEFAULT_OVERLAYS, wildlife: true, zoning: true, transit: true, streets: true },
      scene: {
        lng: -106.65,
        lat: 35.08,
        zoom: 14,
        bearing: 0,
        pitch: 0,
        zoneClass: "industrial",
        zoneLabel: "Industrial",
        quakes: 0,
        transit: 2,
        wildlife: 1,
        events: 0,
        alerts: 0,
      },
    });
    assert.ok(hits.some((h) => h.id === "container"));
    assert.ok(hits.some((h) => h.id === "wild-industry" && h.effect === "avoid"));
    assert.ok(hits.some((h) => h.id === "transit-snap"));
  });

  it("asks you to drop closer instead of claiming an empty district contains the view", () => {
    const hits = evaluateRules({
      overlays: { ...DEFAULT_OVERLAYS, wildlife: true, zoning: true, quakes: true },
      scene: {
        lng: -104.95,
        lat: 34.75,
        zoom: 6.2,
        bearing: 0,
        pitch: 0,
        zoneClass: null,
        zoneLabel: "No zone in view",
        quakes: 0,
        transit: 0,
        wildlife: 1,
        events: 0,
        alerts: 0,
      },
    });
    assert.ok(hits.some((h) => h.id === "need-scale"));
    assert.equal(hits.some((h) => h.id === "container"), false);
    assert.ok(!hits.some((h) => h.title.toLowerCase().includes("no zone in view contains")));
  });

  it("still asks to drop when a landcover class leaks at orbit altitude", () => {
    const hits = evaluateRules({
      overlays: { ...DEFAULT_OVERLAYS, zoning: true },
      scene: {
        lng: -104.95,
        lat: 34.75,
        zoom: 6.2,
        bearing: 0,
        pitch: 0,
        zoneClass: "farmland",
        zoneLabel: "Farmland",
        quakes: 0,
        transit: 0,
        wildlife: 0,
        events: 0,
        alerts: 0,
      },
    });
    assert.ok(hits.some((h) => h.id === "need-scale"));
    assert.equal(hits.some((h) => h.id === "container"), false);
  });

  it("never treats a No zone label as a containing district", () => {
    const hits = evaluateRules({
      overlays: { ...DEFAULT_OVERLAYS, zoning: true },
      scene: {
        lng: -106.65,
        lat: 35.08,
        zoom: 14,
        bearing: 0,
        pitch: 0,
        zoneClass: null,
        zoneLabel: "No zone in view",
        quakes: 0,
        transit: 0,
        wildlife: 0,
        events: 0,
        alerts: 0,
      },
    });
    assert.ok(hits.some((h) => h.id === "empty-zone"));
    assert.equal(hits.some((h) => h.id === "container"), false);
    assert.ok(!hits.some((h) => /contains the view/i.test(h.title)));
  });

  it("dims live events inside the district and learns a wildlife mismatch", () => {
    const hits = evaluateRules({
      overlays: { ...DEFAULT_OVERLAYS, zoning: true, wildlife: true, events: true },
      scene: {
        lng: -106.65,
        lat: 35.08,
        zoom: 14,
        bearing: 0,
        pitch: 0,
        zoneClass: "industrial",
        zoneLabel: "Industrial",
        quakes: 0,
        transit: 0,
        wildlife: 2,
        events: 1,
        alerts: 0,
      },
      patches: [
        {
          id: "z-test",
          lng: -106.65,
          lat: 35.08,
          radiusM: 90,
          action: "reclass",
          class: "park",
          note: "Wildlife using industrial ground",
          source: "live",
          status: "proposed",
          weight: 1,
          t: 1,
          parentId: null,
          generation: 0,
        },
      ],
    });
    assert.ok(hits.some((h) => h.id === "event-zone"));
    assert.ok(hits.some((h) => h.patchId === "z-test"));
  });

  it("treats plants as structure that can fight paved zoning", () => {
    const hits = evaluateRules({
      overlays: { ...DEFAULT_OVERLAYS, plants: true, wildlife: true, zoning: true, transit: true },
      scene: {
        lng: -106.65,
        lat: 35.08,
        zoom: 14,
        bearing: 0,
        pitch: 0,
        zoneClass: "commercial",
        zoneLabel: "Commercial",
        quakes: 0,
        transit: 1,
        wildlife: 1,
        plants: 3,
        events: 0,
        alerts: 0,
      },
    });
    assert.ok(hits.some((h) => h.id === "plants-paved" && h.effect === "avoid"));
    assert.ok(hits.some((h) => h.id === "wild-plants" && h.effect === "prefer"));
    assert.ok(hits.some((h) => h.id === "plants-transit"));
  });
});
