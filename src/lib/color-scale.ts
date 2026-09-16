import { scaleQuantile } from "d3-scale";
import { CHOROPLETH_BINS, METRICS, countryValue, type MetricId } from "./metrics.ts";
import { countriesWithMetric } from "./countries.ts";

export type LegendStop = {
  color: string;
  label: string;
  min: number;
  max: number;
};

export type ChoroplethScale = {
  colorFor: (value: number | null) => string;
  stops: LegendStop[];
};

export function createChoroplethScale(metricId: MetricId): ChoroplethScale {
  const metric = METRICS[metricId];
  const values = countriesWithMetric(metricId)
    .map((c) => countryValue(c, metricId)!)
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return {
      colorFor: () => "var(--color-nodata)",
      stops: [],
    };
  }

  const unique = Array.from(new Set(values));
  const binCount = Math.max(3, Math.min(CHOROPLETH_BINS.length, unique.length));
  const range = [...CHOROPLETH_BINS.slice(0, binCount)];

  const quantile = scaleQuantile<string, string>().domain(values).range(range);
  const thresholds = quantile.quantiles();

  const stops: LegendStop[] = range.map((color, i) => {
    const min = i === 0 ? values[0]! : thresholds[i - 1]!;
    const max = i === range.length - 1 ? values[values.length - 1]! : thresholds[i]!;
    const label =
      i === 0
        ? `< ${metric.formatShort(max)}`
        : i === range.length - 1
          ? `≥ ${metric.formatShort(min)}`
          : `${metric.formatShort(min)} – ${metric.formatShort(max)}`;
    return { color, label, min, max };
  });

  return {
    colorFor: (value) => {
      if (value == null) return "var(--color-nodata)";
      return quantile(value);
    },
    stops,
  };
}
