import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatKm, hitsFromCollection, nearbyHits } from "./nearby.ts";

describe("nearby", () => {
  it("puts the closer quake first and drops the one across the country", () => {
    const sources = hitsFromCollection(
      {
        features: [
          { type: "Feature", geometry: { type: "Point", coordinates: [-106.5, 35.1] }, properties: { mag: 3.2, place: "near Albuquerque" } },
          { type: "Feature", geometry: { type: "Point", coordinates: [-73.5, 40.7] }, properties: { title: "M 4.1 - New York" } },
        ],
      },
      "Quake",
    );
    const hits = nearbyHits(sources, -106.65, 35.08, 400, 5);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.layer, "Quake");
    assert.match(hits[0]?.title ?? "", /3\.2/);
    assert.ok((hits[0]?.km ?? 99) < 30);
    assert.equal(formatKm(0.4), "400 m");
    assert.equal(formatKm(12.4), "12 km");
  });
});
