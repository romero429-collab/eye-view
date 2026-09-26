import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fluFilter, isoWeek, outbreakParts, samePlace, sicknessLabel, sicknessLoad, virusFacts } from "./health.ts";
import { aircraftIdentity } from "./aircraft.ts";
import { craftKind } from "./craft.ts";

describe("health readout", () => {
  it("names the viruses that were actually detected", () => {
    const facts = virusFacts({ ISO_YEAR: 2026, ISO_WEEK: 38, INF_A: 42, RSV: 7, RHINO: 0, HUMAN_CORONA: 3 });
    assert.deepEqual(
      facts.map((fact) => fact.label),
      ["Flu A", "RSV", "Coronavirus", "Flu week"],
    );
    assert.equal(facts.find((fact) => fact.label === "Flu A")?.value, "42");
  });

  it("reads the country off a WHO outbreak title", () => {
    const parts = outbreakParts("Ebola disease caused by Bundibugyo virus - Democratic Republic of the Congo");
    assert.equal(parts?.disease, "Ebola disease caused by Bundibugyo virus");
    assert.equal(samePlace(parts?.place ?? "", "Democratic Republic of the Congo"), true);
    assert.equal(samePlace("Mexico", "Democratic Republic of the Congo"), false);
  });

  it("does not crash when flu activity is a number, and ranks a busy country higher", () => {
    const facts = virusFacts({ ILI_ACTIVITY: 2 as unknown as string, INF_A: 10 });
    assert.equal(facts.find((fact) => fact.label === "ILI")?.value, "2");
    const busy = sicknessLoad(400, 20000, true);
    const quiet = sicknessLoad(0, 50, false);
    assert.equal(sicknessLabel(busy), "Peak");
    assert.ok(busy > quiet);
  });

  it("asks FluNet for this week and the one before", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    assert.equal(isoWeek(now).week, 39);
    assert.match(fluFilter(now), /ISO_WEEK eq 39/);
    assert.match(fluFilter(now), /ISO_WEEK eq 38/);
  });
});

describe("aircraft names", () => {
  it("turns the type code into a make and model", () => {
    assert.deepEqual(
      { make: aircraftIdentity("B738")?.make, model: aircraftIdentity("B738")?.model, wake: aircraftIdentity("B738")?.wake },
      { make: "Boeing", model: "737-800", wake: "Medium" },
    );
    assert.equal(aircraftIdentity("E170")?.model, "ERJ-170-100");
    assert.equal(aircraftIdentity("R44")?.vehicle, "Helicopter");
    assert.equal(aircraftIdentity("EC35")?.make, "Airbus Helicopters");
    assert.equal(aircraftIdentity("A388")?.wake, "Super");
    assert.equal(aircraftIdentity("A388")?.wtc, "J");
    assert.match(aircraftIdentity("B738")?.spacing ?? "", /5 NM/);
    assert.match(aircraftIdentity("C172")?.mass ?? "", /7 t/);
  });
});

describe("aircraft shape", () => {
  it("uses a rotor silhouette for category A7 and known helicopter types", () => {
    assert.equal(craftKind("A7", "B738"), "heli");
    assert.equal(craftKind("A3", "R44"), "heli");
    assert.equal(craftKind("A3", "B738"), "plane");
  });
});
