import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { destination, haversineMeters, wrapBearing } from "./spatial.ts";

describe("spatial", () => {
  it("moves north roughly 111 km per degree", () => {
    const end = destination(-106.65, 35, 0, 111320);
    assert.ok(Math.abs(end.lat - 36) < 0.02);
    assert.ok(Math.abs(end.lng + 106.65) < 0.02);
  });

  it("wraps bearing and measures Albuquerque-scale distances", () => {
    assert.equal(wrapBearing(-90), 270);
    const d = haversineMeters(-106.65, 35.08, -106.64, 35.08);
    assert.ok(d > 800 && d < 1100);
  });
});
