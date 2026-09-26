import type { ExpressionSpecification } from "maplibre-gl";

/** heatmap-density runs 0–1. Stops are ranks, not counts. Health is yellow to red so it is not the teal HUD. */

export type HeatStop = { t: number; color: string; label: string };

export type HeatRampId = "wildlife" | "livestock" | "plants" | "quakes" | "health" | "flights" | "stations" | "air";

export const HEAT_RAMPS: Record<HeatRampId, HeatStop[]> = {
  wildlife: [
    { t: 0, color: "rgba(0,0,0,0)", label: "None" },
    { t: 0.15, color: "rgba(196,184,154,0.55)", label: "Trace" },
    { t: 0.35, color: "#c4b89a", label: "Sparse" },
    { t: 0.55, color: "#d4a054", label: "Present" },
    { t: 0.78, color: "#c45c2a", label: "Busy" },
    { t: 1, color: "#8f2d3a", label: "Dense" },
  ],
  livestock: [
    { t: 0, color: "rgba(0,0,0,0)", label: "None" },
    { t: 0.2, color: "rgba(111,143,134,0.75)", label: "Sparse" },
    { t: 0.48, color: "#c4b89a", label: "Present" },
    { t: 0.72, color: "#d4a054", label: "Busy" },
    { t: 1, color: "#6b4423", label: "Dense" },
  ],
  plants: [
    { t: 0, color: "rgba(0,0,0,0)", label: "None" },
    { t: 0.18, color: "#3d5c48", label: "Sparse" },
    { t: 0.42, color: "#3d9e72", label: "Present" },
    { t: 0.68, color: "#6fbfa8", label: "Busy" },
    { t: 1, color: "#c5e3c8", label: "Dense" },
  ],
  quakes: [
    { t: 0, color: "rgba(0,0,0,0)", label: "Quiet" },
    { t: 0.2, color: "rgba(253,224,71,0.8)", label: "M 2.5" },
    { t: 0.45, color: "#f59e0b", label: "M 4" },
    { t: 0.7, color: "#dc2626", label: "M 6" },
    { t: 1, color: "#7f1d1d", label: "M 7+" },
  ],
  health: [
    { t: 0, color: "rgba(0,0,0,0)", label: "Quiet" },
    { t: 0.16, color: "rgba(253,224,71,0.75)", label: "Low" },
    { t: 0.38, color: "#f59e0b", label: "Guarded" },
    { t: 0.58, color: "#ea580c", label: "Moderate" },
    { t: 0.78, color: "#dc2626", label: "High" },
    { t: 1, color: "#7f1d1d", label: "Peak" },
  ],
  flights: [
    { t: 0, color: "rgba(0,0,0,0)", label: "None" },
    { t: 0.14, color: "rgba(178,24,43,0.9)", label: "Ground" },
    { t: 0.34, color: "#ef8a62", label: "5,000 ft" },
    { t: 0.52, color: "#f7f7f7", label: "15,000 ft" },
    { t: 0.72, color: "#67a9cf", label: "28,000 ft" },
    { t: 1, color: "#2166ac", label: "Cruise" },
  ],
  stations: [
    { t: 0, color: "rgba(0,0,0,0)", label: "None" },
    { t: 0.25, color: "#2166ac", label: "Cold" },
    { t: 0.5, color: "#67a9cf", label: "Cool" },
    { t: 0.75, color: "#ef8a62", label: "Warm" },
    { t: 1, color: "#b2182b", label: "Hot" },
  ],
  air: [
    { t: 0, color: "rgba(0,0,0,0)", label: "None" },
    { t: 0.16, color: "#00e400", label: "Good" },
    { t: 0.33, color: "#ffff00", label: "Moderate" },
    { t: 0.5, color: "#ff7e00", label: "Sensitive" },
    { t: 0.66, color: "#ff0000", label: "Unhealthy" },
    { t: 0.82, color: "#8f3f97", label: "Very" },
    { t: 1, color: "#7e0023", label: "Hazardous" },
  ],
};

export type ZoneSwatch = {
  id: string;
  label: string;
  color: string;
  classes: string[];
  group: "landuse" | "cover";
};

/** Saturated enough to read on satellite; distinct from each other. */
export const LANDUSE_SWATCHES: ZoneSwatch[] = [
  { id: "residential", label: "Residential", color: "#3aa8b5", classes: ["residential"], group: "landuse" },
  { id: "commercial", label: "Commercial", color: "#d4a054", classes: ["commercial"], group: "landuse" },
  { id: "retail", label: "Retail", color: "#e0b56a", classes: ["retail"], group: "landuse" },
  {
    id: "industrial",
    label: "Industrial",
    color: "#8b90a0",
    classes: ["industrial", "garages"],
    group: "landuse",
  },
  {
    id: "civic",
    label: "Civic",
    color: "#6fbfa8",
    classes: ["school", "university", "hospital", "kindergarten", "college", "library"],
    group: "landuse",
  },
  {
    id: "recreation",
    label: "Recreation",
    color: "#3d9e72",
    classes: ["stadium", "pitch", "playground", "recreation_ground", "golf_course", "sports_centre"],
    group: "landuse",
  },
  {
    id: "construction",
    label: "Construction",
    color: "#c47a3a",
    classes: ["construction", "brownfield"],
    group: "landuse",
  },
  {
    id: "extractive",
    label: "Quarry / landfill",
    color: "#7a6458",
    classes: ["quarry", "landfill"],
    group: "landuse",
  },
  { id: "military", label: "Military", color: "#6b5344", classes: ["military"], group: "landuse" },
  { id: "cemetery", label: "Cemetery", color: "#6e6b5c", classes: ["cemetery", "railway"], group: "landuse" },
];

export const COVER_SWATCHES: ZoneSwatch[] = [
  {
    id: "park",
    label: "Park / wood",
    color: "#2f8a4b",
    classes: ["wood", "grass", "park", "garden"],
    group: "cover",
  },
  {
    id: "farmland",
    label: "Farmland",
    color: "#c4a35a",
    classes: ["farmland", "farm", "orchard", "vineyard"],
    group: "cover",
  },
  {
    id: "pasture",
    label: "Pasture",
    color: "#9aaa4a",
    classes: ["meadow"],
    group: "cover",
  },
  { id: "wetland", label: "Wetland", color: "#3d7a6e", classes: ["wetland"], group: "cover" },
  { id: "sand", label: "Bare / sand", color: "#c4b89a", classes: ["sand", "rock"], group: "cover" },
  { id: "ice", label: "Ice", color: "#c9d6dc", classes: ["ice"], group: "cover" },
];

export const ZONE_SWATCHES: ZoneSwatch[] = [...LANDUSE_SWATCHES, ...COVER_SWATCHES];

export const ZONE_LABEL: Record<string, string> = Object.fromEntries(
  ZONE_SWATCHES.flatMap((swatch) => swatch.classes.map((klass) => [klass, swatch.label])),
);

export const LANDUSE_CLASS_FILTER = LANDUSE_SWATCHES.flatMap((swatch) => swatch.classes);
export const COVER_CLASS_FILTER = COVER_SWATCHES.flatMap((swatch) => swatch.classes);
export const ZONE_CLASS_FILTER = ZONE_SWATCHES.flatMap((swatch) => swatch.classes);

function matchFrom(swatches: ZoneSwatch[], fallback: string): ExpressionSpecification {
  const args: unknown[] = ["match", ["get", "class"]];
  for (const swatch of swatches) {
    args.push(swatch.classes.length === 1 ? swatch.classes[0]! : swatch.classes, swatch.color);
  }
  args.push(fallback);
  return args as ExpressionSpecification;
}

export const ZONE_FILL_COLOR = matchFrom(LANDUSE_SWATCHES, "#5a6a62");
export const COVER_FILL_COLOR = matchFrom(COVER_SWATCHES, "#3d5c48");
/** Learned patches can be land-use or cover — one match so a park reclass is green, not gray. */
export const ZONE_MEMORY_COLOR = matchFrom(ZONE_SWATCHES, "#5a6a62");

export function zoneLabel(klass: string, fallback = "Land-use zone"): string {
  return ZONE_LABEL[klass] ?? (klass ? klass.replace(/_/g, " ") : fallback);
}

export function heatmapColorExpr(ramp: HeatRampId): ExpressionSpecification {
  const stops = HEAT_RAMPS[ramp];
  const args: unknown[] = ["interpolate", ["linear"], ["heatmap-density"]];
  for (const stop of stops) args.push(stop.t, stop.color);
  return args as ExpressionSpecification;
}

export function quakeCircleColor(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "mag"], 0],
    2.5,
    "#c4b89a",
    4.2,
    "#d4a054",
    5.8,
    "#c45c2a",
    7.2,
    "#8f2d3a",
  ];
}

export type DensityKind = "wildlife" | "livestock" | "plants" | "quakes" | "bugs" | "ndvi";

export function densityObject(
  kind: DensityKind,
  lng: number,
  lat: number,
): {
  kind: "sighting" | "quake" | "farm" | "plant" | "bug";
  title: string;
  detail: string;
  source: string;
  layer: string;
  facts: Array<{ label: string; value: string }>;
  lng: number;
  lat: number;
} {
  if (kind === "quakes") {
    return {
      kind: "quake",
      title: "Seismic heat",
      detail: "This cell is colored by nearby USGS earthquakes, not a country. Magnitude rings sit on top of the heat.",
      source: "USGS last 24 hours",
      layer: "Quakes",
      facts: [
        { label: "Layer", value: "Quakes" },
        { label: "Readout", value: "Heat cell · magnitude rings" },
        { label: "Look-at", value: `${lat.toFixed(5)}°, ${lng.toFixed(5)}°` },
      ],
      lng,
      lat,
    };
  }
  if (kind === "livestock") {
    return {
      kind: "farm",
      title: "Livestock density",
      detail: "GBIF domestic-animal occurrences. This is a heat cell, not a country statistic.",
      source: "GBIF occurrence density",
      layer: "Domestic",
      facts: [
        { label: "Layer", value: "Domestic" },
        { label: "Readout", value: "Heat cell · livestock" },
        { label: "Look-at", value: `${lat.toFixed(5)}°, ${lng.toFixed(5)}°` },
      ],
      lng,
      lat,
    };
  }
  if (kind === "plants") {
    return {
      kind: "plant",
      title: "Plant density",
      detail:
        "Vegetation GIS at this look-at: GBIF Plantae heat, NASA NDVI, iNaturalist, OSM trees and cover. Structural data — not scenery, not a country.",
      source: "GBIF · NASA GIBS NDVI · iNaturalist · OSM",
      layer: "Plants",
      facts: [
        { label: "Layer", value: "Plants" },
        { label: "Readout", value: "Heat cell · vegetation" },
        { label: "Taxa", value: "Plantae · trees · crops · NDVI" },
        { label: "Look-at", value: `${lat.toFixed(5)}°, ${lng.toFixed(5)}°` },
      ],
      lng,
      lat,
    };
  }
  if (kind === "ndvi") {
    return {
      kind: "plant",
      title: "NDVI greenness",
      detail:
        "NASA MODIS 8-day Normalized Difference Vegetation Index. Live plants bounce near-infrared; pavement and rock do not. Bright green is dense canopy. This is structure, not a tint and not a country.",
      source: "NASA GIBS MODIS Terra NDVI 8-day",
      layer: "Plants",
      facts: [
        { label: "Layer", value: "Plants" },
        { label: "Metric", value: "NDVI (NIR − red) / (NIR + red)" },
        { label: "Look-at", value: `${lat.toFixed(5)}°, ${lng.toFixed(5)}°` },
      ],
      lng,
      lat,
    };
  }
  if (kind === "bugs") {
    return {
      kind: "bug",
      title: "Insect density",
      detail: "GBIF Insecta occurrence heat. Named beetles, bees, and the rest load next to the cell.",
      source: "GBIF occurrence density (Insecta)",
      layer: "Bugs",
      facts: [
        { label: "Layer", value: "Bugs" },
        { label: "Taxa", value: "Insecta" },
        { label: "Look-at", value: `${lat.toFixed(5)}°, ${lng.toFixed(5)}°` },
      ],
      lng,
      lat,
    };
  }
  return {
    kind: "sighting",
    title: "Wildlife density",
    detail:
      "GBIF mammal, bird, amphibian, and squamate occurrence heat. The amber cell is animal density, not a plane and not a country. Nearby named records — common name, family, IUCN — load next to this cell.",
    source: "GBIF occurrence density (Mammalia + Aves)",
    layer: "Wild",
    facts: [
      { label: "Layer", value: "Wild" },
      { label: "Readout", value: "Heat cell · wildlife" },
      { label: "Taxa", value: "Mammals and birds" },
      { label: "Look-at", value: `${lat.toFixed(5)}°, ${lng.toFixed(5)}°` },
    ],
    lng,
    lat,
  };
}

export const OVERLAY_INK: Partial<Record<string, string>> = {
  wildlife: "#d4a054",
  livestock: "#c4b89a",
  plants: "#3d9e72",
  quakes: "#c45c2a",
  zoning: "#3aa8b5",
  flights: "#e7eaed",
  transit: "#7ecad4",
  iot: "#6fbfa8",
  health: "#7ecad4",
  plots: "#7ecad4",
  rail: "#e7eaed",
};
