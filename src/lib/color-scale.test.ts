import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChoroplethScale } from "./color-scale.ts";
import { countriesWithMetric } from "./countries.ts";
import { countryValue } from "./metrics.ts";

describe("createChoroplethScale", () => {
  it("legend endpoints are the actual GDP min and max, not inner quantile edges", () => {
    const scale = createChoroplethScale("gdpPerCapita");
    const values = countriesWithMetric("gdpPerCapita").map(
      (c) => countryValue(c, "gdpPerCapita")!,
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    assert.equal(scale.stops[0]?.min, min);
    assert.equal(scale.stops[scale.stops.length - 1]?.max, max);
    assert.ok(max > 50_000, "top of the scale must include high-income countries");
    const us = countriesWithMetric("gdpPerCapita").find((c) => c.name === "United States");
    const usVal = us ? countryValue(us, "gdpPerCapita") : null;
    assert.ok(usVal != null && usVal <= max);
  });
});
