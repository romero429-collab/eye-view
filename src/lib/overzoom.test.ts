import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksEmpty } from "./overzoom.ts";

describe("overzoom", () => {
  it("treats the flat gray placeholder as empty and a photo as real", () => {
    assert.equal(looksEmpty(205, 29), true);
    assert.equal(looksEmpty(72, 1786), false);
  });
});
