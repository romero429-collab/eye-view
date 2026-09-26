import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readRadarPixel, tileOf } from "./radar.ts";

describe("radar echo", () => {
  it("lands the New Jersey storm on the tile that holds it", () => {
    const tile = tileOf(-73.56, 39.38, 6);
    assert.equal(tile.z, 6);
    assert.equal(tile.x, 18);
    assert.equal(tile.y, 24);
    assert.equal(tile.px, 236);
    assert.equal(tile.py, 95);
  });

  it("reads RainViewer blue, yellow, and red as three bands", () => {
    assert.equal(readRadarPixel(0, 0, 0, 0).band, "none");
    assert.equal(readRadarPixel(0, 80, 128, 230).title, "Light rain");
    assert.equal(readRadarPixel(240, 224, 0, 230).title, "Moderate rain");
    assert.equal(readRadarPixel(255, 68, 0, 255).title, "Heavy rain");
  });
});
