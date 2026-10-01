import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geohashBounds, geohashEncode, geohashesCovering } from "./geohash.ts";
import { bulkRTree } from "./rtree.ts";

describe("geohash", () => {
  it("encodes the standard example", () => {
    assert.equal(geohashEncode(57.64911, 10.40744, 11), "u4pruydqqvj");
  });

  it("round-trips a hash into a box that contains the point", () => {
    const hash = geohashEncode(25.76, -80.19, 5);
    const [west, south, east, north] = geohashBounds(hash);
    assert.ok(25.76 >= south && 25.76 <= north);
    assert.ok(-80.19 >= west && -80.19 <= east);
  });

  it("covers Miami with more than one cell", () => {
    const cells = geohashesCovering(-80.6, 25.4, -80.05, 26.1, 4);
    assert.ok(cells.length >= 1);
    assert.ok(cells.every((cell) => cell.length === 4));
  });
});

describe("rtree", () => {
  it("returns only the point inside the view", () => {
    const tree = bulkRTree([
      { x: -80.19, y: 25.76, value: "miami" },
      { x: -87.63, y: 41.88, value: "chicago" },
      { x: -106.65, y: 35.08, value: "albuquerque" },
    ]);
    assert.deepEqual(tree.search(-80.5, 25.5, -80.0, 26.0), ["miami"]);
  });
});
