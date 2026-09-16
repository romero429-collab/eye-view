import type { PlaceKind } from "@/lib/places";

export const KIND_ZOOM: Record<PlaceKind, number> = {
  country: 1.2,
  state: 2.45,
  county: 4.0,
  city: 5.5,
  plot: 7.0,
};

export const TIER_ORDER: PlaceKind[] = [
  "country",
  "state",
  "county",
  "city",
  "plot",
];

export function scaleTier(k: number): PlaceKind {
  if (k >= 6.2) return "plot";
  if (k >= 4.55) return "city";
  if (k >= 3.15) return "county";
  if (k >= 1.75) return "state";
  return "country";
}

export function kindVisible(kind: PlaceKind, tier: PlaceKind): boolean {
  const i = TIER_ORDER.indexOf(kind);
  const t = TIER_ORDER.indexOf(tier);
  return i <= t && i >= t - 1;
}

export const TIER_HINT: Record<PlaceKind, string> = {
  country: "Countries",
  state: "States & regions",
  county: "Counties",
  city: "Cities & towns",
  plot: "Land plots",
};
