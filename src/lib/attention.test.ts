import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notice, noticeMany, rankQueries, scoreQuery, salience } from "./attention.ts";

describe("attention", () => {
  it("bumps the inspected key and decays the rest", () => {
    let map = notice({}, "wildlife");
    assert.ok(salience(map, "wildlife") >= 1);
    map = notice(map, "quakes");
    assert.ok(salience(map, "quakes") > salience(map, "wildlife"));
  });

  it("ranks animal queries first after a wildlife inspection", () => {
    const map = noticeMany({}, ["wildlife", "sighting"]);
    const ranked = rankQueries(
      ["transit in industrial", "terrain for animals here", "walk this street"],
      map,
    );
    assert.equal(ranked[0], "terrain for animals here");
    assert.ok(scoreQuery("terrain for animals here", map) > scoreQuery("walk this street", map));
  });
});
