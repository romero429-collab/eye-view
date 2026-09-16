import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FeatureCollection, Geometry, Polygon } from "geojson";
import {
  countryAtLngLat,
  countryContainsLngLat,
  pointInBbox,
} from "./spatial-index.ts";

function square(
  id: string,
  name: string,
  west: number,
  south: number,
  east: number,
  north: number,
) {
  const ring: Polygon["coordinates"] = [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ];
  return {
    type: "Feature" as const,
    id,
    properties: { name, iso: id },
    geometry: { type: "Polygon" as const, coordinates: ring },
  };
}

const FIXTURE: FeatureCollection<Geometry> = {
  type: "FeatureCollection",
  features: [
    square("840", "United States", -125, 24, -66, 50),
    square("442", "Luxembourg", 5.7, 49.4, 6.6, 50.2),
  ],
};

describe("spatial index (GiST analogue)", () => {
  it("point-in-bbox rejects the far side of the globe", () => {
    assert.equal(pointInBbox(-106.65, 35.08, [[-125, 24], [-66, 50]]), true);
    assert.equal(pointInBbox(-106.65, 35.08, [[5.7, 49.4], [6.6, 50.2]]), false);
  });

  it("picks the United States for an Albuquerque tap, never Luxembourg", () => {
    const hit = countryAtLngLat(FIXTURE, -106.6504, 35.0844);
    assert.ok(hit);
    assert.equal(hit.id, "840");
    assert.equal(hit.name, "United States");
    const lux = FIXTURE.features[1]!;
    assert.equal(countryContainsLngLat(lux, -106.65, 35.08), false);
    assert.equal(countryContainsLngLat(lux, 6.13, 49.61), true);
  });

  it("returns null over ocean", () => {
    assert.equal(countryAtLngLat(FIXTURE, -40, 30), null);
  });
});
