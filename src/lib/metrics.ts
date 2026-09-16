export const METRIC_IDS = [
  "gdpPerCapita",
  "population",
  "hdi",
  "lifeExpectancy",
  "co2PerCapita",
  "urbanization",
] as const;

export type MetricId = (typeof METRIC_IDS)[number];

export type CountryRecord = {
  id: string;
  iso3: string;
  name: string;
  region: string;
  capital: string;
  gdpPerCapita: number | null;
  population: number | null;
  hdi: number | null;
  lifeExpectancy: number | null;
  co2PerCapita: number | null;
  urbanization: number | null;
};

export type MetricDef = {
  id: MetricId;
  label: string;
  shortLabel: string;
  description: string;
  unit: string;
  higherIsBetter: boolean;
  format: (value: number) => string;
  formatShort: (value: number) => string;
};

function compactNumber(value: number, digits = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 10_000) return `${Math.round(value / 1000)}k`;
  if (abs >= 1_000) return `${(value / 1000).toFixed(digits)}k`;
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export const METRICS: Record<MetricId, MetricDef> = {
  gdpPerCapita: {
    id: "gdpPerCapita",
    label: "GDP per capita",
    shortLabel: "GDP / capita",
    description: "Nominal gross domestic product per person, in US dollars.",
    unit: "USD",
    higherIsBetter: true,
    format: (v) =>
      v >= 1000
        ? `$${Math.round(v).toLocaleString("en-US")}`
        : `$${v.toFixed(0)}`,
    formatShort: (v) => `$${compactNumber(v)}`,
  },
  population: {
    id: "population",
    label: "Population",
    shortLabel: "Population",
    description: "Estimated mid-year population.",
    unit: "people",
    higherIsBetter: true,
    format: (v) => Math.round(v).toLocaleString("en-US"),
    formatShort: (v) => compactNumber(v),
  },
  hdi: {
    id: "hdi",
    label: "Human Development Index",
    shortLabel: "HDI",
    description: "UNDP composite of life expectancy, education, and income.",
    unit: "index",
    higherIsBetter: true,
    format: (v) => v.toFixed(3),
    formatShort: (v) => v.toFixed(2),
  },
  lifeExpectancy: {
    id: "lifeExpectancy",
    label: "Life expectancy",
    shortLabel: "Life exp.",
    description: "Expected years of life at birth.",
    unit: "years",
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)} yr`,
    formatShort: (v) => v.toFixed(1),
  },
  co2PerCapita: {
    id: "co2PerCapita",
    label: "CO₂ per capita",
    shortLabel: "CO₂ / capita",
    description: "Annual carbon dioxide emissions per person, in tonnes.",
    unit: "t",
    higherIsBetter: false,
    format: (v) => `${v.toFixed(v >= 10 ? 1 : 2)} t`,
    formatShort: (v) => `${compactNumber(v)} t`,
  },
  urbanization: {
    id: "urbanization",
    label: "Urban population",
    shortLabel: "Urban",
    description: "Share of people living in urban areas.",
    unit: "%",
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
    formatShort: (v) => `${Math.round(v)}%`,
  },
};

export const METRIC_LIST = METRIC_IDS.map((id) => METRICS[id]);

export const CHOROPLETH_BINS = [
  "var(--color-choropleth-1)",
  "var(--color-choropleth-2)",
  "var(--color-choropleth-3)",
  "var(--color-choropleth-4)",
  "var(--color-choropleth-5)",
  "var(--color-choropleth-6)",
  "var(--color-choropleth-7)",
] as const;

export function countryValue(
  country: CountryRecord,
  metric: MetricId,
): number | null {
  const value = country[metric];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
