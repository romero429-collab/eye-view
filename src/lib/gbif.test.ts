import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lidarSummary,
  occurrenceFacts,
  occurrenceTitle,
  photoUrl,
  pickVernacular,
} from "./gbif.ts";

describe("GBIF species helpers", () => {
  it("prefers the common English name over subspecies labels", () => {
    const name = pickVernacular([
      { vernacularName: "Black-tailed Deer", language: "eng" },
      { vernacularName: "Black-tailed Deer", language: "eng" },
      { vernacularName: "Mule Deer", language: "eng" },
      { vernacularName: "Mule Deer", language: "eng" },
      { vernacularName: "Mule Deer", language: "eng" },
      { vernacularName: "venado bura", language: "spa" },
    ]);
    assert.equal(name, "Mule Deer");
  });

  it("prefers English over unlabeled Spanish", () => {
    const name = pickVernacular([
      { vernacularName: "Mapache", language: "" },
      { vernacularName: "Raccoon", language: "eng" },
      { vernacularName: "Raccoon", language: "eng" },
    ]);
    assert.equal(name, "Raccoon");
  });

  it("titles an occurrence with the vernacular when we have it", () => {
    const rec = { species: "Odocoileus hemionus", scientificName: "Odocoileus hemionus (Rafinesque, 1817)" };
    assert.equal(occurrenceTitle(rec, "Mule Deer"), "Mule Deer");
    assert.equal(occurrenceTitle(rec, null), "Odocoileus hemionus");
  });

  it("keeps family, IUCN, and a https photo", () => {
    const rec = {
      scientificName: "Odocoileus hemionus (Rafinesque, 1817)",
      family: "Cervidae",
      class: "Mammalia",
      iucnRedListCategory: "LC",
      media: [{ type: "StillImage", identifier: "https://inaturalist-open-data.s3.amazonaws.com/photos/1/original.jpg" }],
    };
    const facts = occurrenceFacts(rec, "Mule Deer");
    assert.ok(facts.some((f) => f.label === "Common" && f.value === "Mule Deer"));
    assert.ok(facts.some((f) => f.label === "Family" && f.value === "Cervidae"));
    assert.ok(facts.some((f) => f.label === "IUCN" && f.value === "LC"));
    assert.match(photoUrl(rec) ?? "", /medium\.jpg$/);
  });
});

describe("lidar inventory", () => {
  it("summarizes a USGS 3DEP workunit without dumping the LAZ", () => {
    const line = lidarSummary({
      workunit: "NM_MRCOG_B1_2018",
      ql: "QL 2",
      gsd: 0.61,
      points: 14_379_346_433,
      year: 2018,
      ept: true,
    });
    assert.match(line, /NM_MRCOG_B1_2018/);
    assert.match(line, /QL 2/);
    assert.match(line, /14\.4B pts/);
    assert.match(line, /EPT/);
  });
});
