import type { OverlayId, OverlayState } from "./basemaps.ts";
import { ZONE_SWATCHES, zoneLabel } from "./basemaps.ts";

export type ZoneClassId = (typeof ZONE_SWATCHES)[number]["id"] | "unknown";

export type RuleEffect = "container" | "avoid" | "snap" | "dim" | "prefer";

export type RuleHit = {
  id: string;
  effect: RuleEffect;
  title: string;
  detail: string;
  local: boolean;
};

export type SceneSample = {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
  zoneClass: string | null;
  zoneLabel: string;
  quakes: number;
  transit: number;
  wildlife: number;
};

/** OpenMapTiles landuse/cover is not in the globe tiles until city/regional zoom. */
export const DISTRICT_ZOOM = 8;
export const DISTRICT_ALTITUDE_KM = 40;

export function needsDistrictScale(zoom: number | null | undefined): boolean {
  return (zoom ?? 0) < DISTRICT_ZOOM;
}

export type RuleContext = {
  overlays: OverlayState;
  scene: SceneSample | null;
};

const AVOID_WILDLIFE = new Set(["industrial", "military", "garages"]);
const PREFER_TRAILS = new Set(["residential", "civic", "cemetery", "park", "wood", "grass"]);
const PREFER_STOCK = new Set(["industrial"]);

export function zoneClassOf(raw: string | null | undefined): ZoneClassId {
  if (!raw) return "unknown";
  const hit = ZONE_SWATCHES.find(
    (swatch) => swatch.id === raw || swatch.classes.includes(raw),
  );
  return hit?.id ?? "unknown";
}

/** Turning a layer on pulls the overlays it must coordinate with.
 *  Turning one off leaves companions — the user still owns those toggles. */
export function coordinateToggle(state: OverlayState, id: OverlayId): OverlayState {
  const next: OverlayState = { ...state, [id]: !state[id] };
  if (!next[id]) return next;
  if (id === "transit" || id === "rail") next.streets = true;
  if (id === "wildlife" || id === "livestock" || id === "trails") next.zoning = true;
  if (id === "plots") next.zoning = true;
  if (id === "zoning" || id === "wildlife" || id === "quakes") next.metric = false;
  return next;
}

export function evaluateRules(ctx: RuleContext): RuleHit[] {
  const { overlays, scene } = ctx;
  const hits: RuleHit[] = [];
  const klass = zoneClassOf(scene?.zoneClass);
  const labeled = scene?.zoneLabel || zoneLabel(klass, "Unknown land use");
  const tooHigh = needsDistrictScale(scene?.zoom);
  const zoned = overlays.zoning || klass !== "unknown";

  if (overlays.zoning && tooHigh) {
    hits.push({
      id: "need-scale",
      effect: "container",
      title: "Drop closer to read districts",
      detail:
        "Land-use tiles load below about 40 km. Drop in to Albuquerque, then walk the street.",
      local: false,
    });
  } else if (zoned && klass !== "unknown") {
    hits.push({
      id: "container",
      effect: "container",
      title: `${labeled} contains the view`,
      detail:
        "Zoning is the coordinating container. Other feeds snap, avoid, or dim inside this district.",
      local: true,
    });
  } else if (overlays.zoning && klass === "unknown") {
    hits.push({
      id: "empty-zone",
      effect: "container",
      title: "No district at this look-at",
      detail:
        "OpenStreetMap has no land-use polygon under the crosshair. Pan to a block or drop into a city.",
      local: false,
    });
  }

  if (overlays.wildlife && AVOID_WILDLIFE.has(klass)) {
    hits.push({
      id: "wild-industry",
      effect: "avoid",
      title: "Wildlife avoids this district",
      detail: `Migration corridors detour around ${labeled.toLowerCase()} ground.`,
      local: true,
    });
  }

  if (overlays.wildlife && overlays.quakes) {
    const local = (scene?.quakes ?? 0) > 0;
    hits.push({
      id: "wild-seismic",
      effect: "avoid",
      title: local ? "Wildlife detours seismic" : "Wildlife watches seismic",
      detail: local
        ? "Quakes in view — corridors treat this as unstable ground."
        : "Seismic feed is on. Animals avoid recent rupture when it appears.",
      local,
    });
  }

  if (overlays.transit) {
    hits.push({
      id: "transit-snap",
      effect: "snap",
      title: "Transit snapped to streets",
      detail: "Vehicles stay on the road/rail network, not as free dots on the globe.",
      local: (scene?.transit ?? 0) > 0,
    });
  }

  if (overlays.rail && overlays.transit) {
    hits.push({
      id: "rail-snap",
      effect: "snap",
      title: "Rail constrains heavy transit",
      detail: "Where tracks exist they are the snap target for rail vehicles.",
      local: true,
    });
  }

  if (overlays.radar) {
    hits.push({
      id: "weather-dim",
      effect: "dim",
      title: "Weather cuts visibility",
      detail: "Radar is the atmosphere layer — live dots dim so precipitation stays readable.",
      local: true,
    });
  }

  if (overlays.trails && klass !== "unknown") {
    const prefer = PREFER_TRAILS.has(klass);
    hits.push({
      id: "trail-terrain",
      effect: prefer ? "prefer" : "avoid",
      title: prefer ? "Trails fit this land use" : "Trails fight this land use",
      detail: prefer
        ? `${labeled} is walkable terrain for the hiking network.`
        : `${labeled} is a poor hiking container — paths will be sparse.`,
      local: true,
    });
  }

  if (overlays.livestock && PREFER_STOCK.has(klass)) {
    hits.push({
      id: "stock-industry",
      effect: "avoid",
      title: "Livestock avoid industrial",
      detail: "Herding and pasture sit outside industrial land-use.",
      local: true,
    });
  }

  if (overlays.wildlife && overlays.trails) {
    hits.push({
      id: "wild-trails",
      effect: "prefer",
      title: "Animals share hiking terrain",
      detail: "Wildlife density is read against human trail networks, not instead of them.",
      local: (scene?.wildlife ?? 0) > 0,
    });
  }

  return hits;
}

export function radarDimFactor(overlays: OverlayState): number {
  return overlays.radar ? 0.42 : 1;
}
