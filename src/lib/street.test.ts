import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cropWindow, nearestShot, shotsFromPanoramax } from "./street.ts";

describe("street photos", () => {
  it("reads a panorama and the next photo along the drive", () => {
    const shots = shotsFromPanoramax({
      features: [
        {
          id: "pic-a",
          geometry: { type: "Point", coordinates: [2.35, 48.85] },
          assets: { sd: { href: "https://example.test/a.jpg" } },
          properties: { "view:azimuth": 90, datetime: "2024-05-01T12:00:00Z", "geovisio:producer": "IGN" },
          links: [{ rel: "next", id: "pic-b" }],
        },
      ],
    });
    assert.equal(shots.length, 1);
    assert.equal(shots[0]?.azimuth, 90);
    assert.equal(shots[0]?.nextId, "pic-b");
    assert.equal(shots[0]?.producer, "IGN");
  });

  it("picks the capture closest to where you are standing", () => {
    const near = nearestShot(
      [
        { id: "far", lng: 2.4, lat: 48.9, azimuth: 0, image: "a", when: "", producer: "", nextId: null, prevId: null },
        { id: "here", lng: 2.351, lat: 48.851, azimuth: 0, image: "b", when: "", producer: "", nextId: null, prevId: null },
      ],
      2.35,
      48.85,
    );
    assert.equal(near?.id, "here");
  });

  it("turns the window around a 360 photo", () => {
    const ahead = cropWindow(0, 0, 90, 3600, 1800);
    const side = cropWindow(90, 0, 90, 3600, 1800);
    assert.ok(side.x > ahead.x);
    assert.equal(side.w, ahead.w);
    assert.ok(side.y >= 0 && side.y + side.h <= 1800);
  });
});
