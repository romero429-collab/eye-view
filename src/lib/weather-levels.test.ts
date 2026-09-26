import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { daysAgo, weatherLevels } from "./weather-levels.ts";

describe("weather levels", () => {
  it("dates a worldwide precip mosaic and keeps radar as the dish product", () => {
    const now = Date.parse("2026-09-25T23:00:00Z");
    assert.equal(daysAgo(1, now), "2026-09-24");
    const levels = weatherLevels(now);
    assert.equal(levels[0]?.id, "radar");
    assert.equal(levels[0]?.tiles, null);
    const precip = levels.find((level) => level.id === "precip");
    assert.match(precip?.tiles ?? "", /IMERG_Precipitation_Rate/);
    assert.match(precip?.tiles ?? "", /2026-09-23/);
    assert.equal(levels.length, 6);
  });
});
