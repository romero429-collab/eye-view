import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  occurrenceFacts,
  occurrenceTitle,
  photoUrl,
  pickVernacular,
} from "./gbif.ts";
import { lidarCoverageLine, pickElevation } from "./ground.ts";

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

  it("falls back to a local vernacular when English is missing", () => {
    const name = pickVernacular([{ vernacularName: "ホンドタヌキ", language: "jpn" }]);
    assert.equal(name, "ホンドタヌキ");
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
  it("names ICESat-2 worldwide even without a US workunit", () => {
    const tokyo = lidarCoverageLine({ icesat: [315, 673, 757] });
    assert.match(tokyo, /ICESat-2/);
    assert.doesNotMatch(tokyo, /NM_/);
  });

  it("keeps the US workunit next to the tracks when both exist", () => {
    const line = lidarCoverageLine({
      workunit: "NM_MRCOG_B1_2018",
      ql: "QL 2",
      gsd: 0.61,
      points: 14_379_346_433,
      year: 2018,
      ept: true,
      icesat: [94],
    });
    assert.match(line, /ICESat-2/);
    assert.match(line, /NM_MRCOG_B1_2018/);
    assert.match(line, /14\.4B pts/);
  });
});

describe("height accuracy", () => {
  it("prefers USGS 3DEP inside the US and Open-Meteo everywhere else", () => {
    const abq = pickElevation(1682, 1682);
    assert.equal(abq?.source, "USGS 3DEP EPQS");
    const tokyo = pickElevation(Number.NaN, 12);
    assert.equal(tokyo?.meters, 12);
    assert.equal(tokyo?.source, "Open-Meteo DEM");
    const ocean = pickElevation(null, 0);
    assert.equal(ocean?.meters, 0);
  });
});
