import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { houseAt } from "./interior.ts";

describe("interior instance", () => {
  it("opens the same rooms at the same look-at", () => {
    const a = houseAt(-104.9449, 34.7801);
    const b = houseAt(-104.9449, 34.7801);
    assert.deepEqual(a.rooms, ["Living", "Kitchen", "Bedroom", "Bath"]);
    assert.equal(a.bearing, b.bearing);
    assert.equal(a.features.features.length, b.features.features.length);
    assert.ok(a.features.features.some((f) => f.properties?.part === "floor"));
    assert.ok(a.features.features.filter((f) => f.properties?.part === "wall").length >= 8);
    assert.ok(a.features.features.some((f) => f.properties?.title === "Sofa"));
  });

  it("does not pretend two look-ats are the same house", () => {
    const here = houseAt(-104.9449, 34.7801);
    const there = houseAt(139.76, 35.68);
    assert.notEqual(here.bearing, there.bearing);
  });

  it("labels itself as our instance, not a listing scan", () => {
    const house = houseAt(-106.52, 35.08);
    const floor = house.features.features.find((f) => f.properties?.part === "floor");
    assert.match(String(floor?.properties?.detail), /Not a listing scan/);
    assert.ok(Number.isFinite(house.door.lng));
  });
});
