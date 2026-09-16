import type { OverlayId, OverlayState } from "./basemaps.ts";
import { ZONE_SWATCHES, zoneLabel } from "./basemaps.ts";
import { resolveZone, lastMutation, type ZonePatch } from "./zone-memory.ts";
import { perceiveMovement } from "./transit-sense.ts";
import { consequenceToEffect, orchestrate } from "./iom.ts";

export type ZoneClassId = (typeof ZONE_SWATCHES)[number]["id"] | "unknown";

export type RuleEffect = "container" | "avoid" | "snap" | "dim" | "prefer" | "queue" | "adapt";

export type RuleHit = {
  id: string;
  effect: RuleEffect;
  title: string;
  detail: string;
  local: boolean;
  patchId?: string;
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
  plants?: number;
  events: number;
  alerts: number;
  sensors?: number;
  precip?: number;
  temp?: number;
  wind?: number;
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
  zoneFilter?: string | null;
  patches?: ZonePatch[];
};

const AVOID_WILDLIFE = new Set(["industrial", "military", "garages", "extractive", "construction"]);
const PREFER_TRAILS = new Set(["residential", "civic", "cemetery", "park", "wood", "grass", "recreation", "pasture"]);
const PREFER_STOCK = new Set(["industrial", "pasture", "farmland"]);
const PAVED = new Set(["commercial", "industrial", "retail", "extractive", "construction", "garages"]);
const VEGETATED = new Set(["park", "wood", "grass", "farmland", "pasture", "recreation"]);

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
  if (id === "transit" || id === "rail") {
    next.streets = true;
    next.zoning = true;
    next.metric = false;
  }
  if (id === "wildlife" || id === "livestock" || id === "plants" || id === "trails") next.zoning = true;
  if (id === "plots") next.zoning = true;
  if (id === "events" || id === "alerts" || id === "iot") next.zoning = true;
  if (id === "iot") next.metric = false;
  if (id === "zoning" || id === "wildlife" || id === "plants" || id === "quakes") next.metric = false;
  return next;
}

export function evaluateRules(ctx: RuleContext): RuleHit[] {
  const { overlays, scene, zoneFilter, patches = [] } = ctx;
  const hits: RuleHit[] = [];
  const learned =
    scene
      ? resolveZone(patches, scene.lng, scene.lat, scene.zoneClass, scene.zoneLabel)
      : null;
  const klass = zoneClassOf(learned?.class ?? scene?.zoneClass);
  const labeled = learned?.label || scene?.zoneLabel || zoneLabel(klass, "Unknown land use");
  const tooHigh = needsDistrictScale(scene?.zoom);
  const unlabeled =
    klass === "unknown" ||
    !(learned?.class ?? scene?.zoneClass) ||
    /^no (zone|district)/i.test(labeled);
  const zoned = overlays.zoning || !unlabeled;
  const learnedOverride = Boolean(learned?.patch);

  if (overlays.zoning && tooHigh) {
    hits.push({
      id: "need-scale",
      effect: "container",
      title: "Drop closer to read districts",
      detail:
        "Land-use tiles load below about 40 km. Drop in to Albuquerque, then walk the street.",
      local: false,
    });
  } else if (zoned && !unlabeled) {
    hits.push({
      id: "container",
      effect: "container",
      title: learnedOverride
        ? `Learned ${labeled.toLowerCase()} contains the view`
        : `${labeled} contains the view`,
      detail: learnedOverride
        ? "Applied immediately at this look-at. Adjacent blocks are queued — they stay independent until you confirm."
        : "Zoning is the coordinating container. Other feeds snap, avoid, or dim inside this district.",
      local: true,
      patchId: learned?.patch?.id,
    });
  } else if (overlays.zoning) {
    hits.push({
      id: "empty-zone",
      effect: "container",
      title: zoneFilter
        ? `No ${zoneFilter} under the crosshair`
        : "No district at this look-at",
      detail: zoneFilter
        ? `The view is filtered to ${zoneFilter}. Pan until that class fills the look-at, or drop into a known district.`
        : "OpenStreetMap has no land-use polygon under the crosshair. Tag one on the ground to teach the HUD.",
      local: false,
    });
  }

  for (const flag of learned?.flags ?? []) {
    const ripple = flag.source === "ripple";
    hits.push({
      id: `learn-${flag.id}`,
      effect: ripple ? "queue" : flag.action === "flag" ? "dim" : "avoid",
      title: ripple
        ? `Queued ${flag.class ? zoneLabel(flag.class).toLowerCase() : "change"} from next door`
        : flag.action === "reclass" && flag.class
          ? `Live feed proposes ${zoneLabel(flag.class)}`
          : flag.note || "Live feed flagged this district",
      detail: ripple
        ? "Connected, not copied. Confirm to apply here, or dismiss to keep this block independent."
        : flag.note || "Confirm to teach the map, or dismiss the proposal.",
      local: true,
      patchId: flag.id,
    });
  }

  if ((learned?.queued ?? 0) > 0 && zoned && !tooHigh) {
    hits.push({
      id: "ripple-queue",
      effect: "queue",
      title: `${learned?.queued} adjacent block${learned && learned.queued === 1 ? "" : "s"} queued`,
      detail: "The rule engine already sees the local commit. Neighbors wait in the queue — they stay independent until you confirm.",
      local: false,
    });
  }

  const tick = scene ? lastMutation(patches, scene.lng, scene.lat) : null;
  if (tick && zoned && !tooHigh) {
    hits.push({
      id: "this-tick",
      effect: "adapt",
      title: `Applied ${tick.class ? zoneLabel(tick.class).toLowerCase() : "this district"} this tick`,
      detail: tick.queued
        ? `Walk/query committed immediately. ${tick.queued} connected block${tick.queued === 1 ? "" : "s"} queued — a change never silently overwrites the next district.`
        : "Walk/query committed immediately. No adjacent blocks to queue.",
      local: true,
      patchId: tick.id,
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

  if ((overlays.events && (scene?.events ?? 0) > 0) || (overlays.alerts && (scene?.alerts ?? 0) > 0)) {
    hits.push({
      id: "event-zone",
      effect: "dim",
      title: "Live event in this district",
      detail: "Hazards and alerts coordinate with the zone — they do not replace it.",
      local: true,
    });
  }

  if (overlays.transit) {
    const sense = perceiveMovement({ overlays, scene, patches, vehicles: scene?.transit ?? 0 });
    hits.push({
      id: "transit-sense",
      effect: sense.mood === "flowing" ? "snap" : sense.mood === "orphan" ? "dim" : "avoid",
      title: sense.title,
      detail: sense.detail,
      local: sense.vehicles > 0 || sense.learned || sense.mood !== "flowing",
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
      effect: klass === "pasture" || klass === "farmland" ? "prefer" : "avoid",
      title:
        klass === "pasture" || klass === "farmland"
          ? "Livestock prefer this land use"
          : "Livestock avoid industrial",
      detail:
        klass === "pasture" || klass === "farmland"
          ? `${labeled} is pasture-grade ground for herds.`
          : "Herding and pasture sit outside industrial land-use.",
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

  if (overlays.plants) {
    const plantCount = scene?.plants ?? 0;
    if (overlays.wildlife) {
      hits.push({
        id: "wild-plants",
        effect: "prefer",
        title: plantCount > 0 ? "Wildlife clusters on this vegetation" : "Wildlife follows plant cover",
        detail: "Animals use trees, shrubs, and crops as structure. Vegetation is the corridor, not scenery.",
        local: plantCount > 0 || (scene?.wildlife ?? 0) > 0,
      });
    }
    if (PAVED.has(klass)) {
      hits.push({
        id: "plants-paved",
        effect: "avoid",
        title: plantCount > 0 ? "Native plants on paved zoning" : "Vegetation fights this district",
        detail: `${labeled} is a poor container for living cover. Confirm a park / wood reclass if the ground is growing.`,
        local: plantCount > 0,
      });
    } else if (VEGETATED.has(klass) || klass === "residential") {
      hits.push({
        id: "plants-fit",
        effect: "prefer",
        title: "Plants belong in this district",
        detail: `${labeled} is a vegetated container — trees, shrubs, and crops inform how this zone works.`,
        local: plantCount > 0,
      });
    }
    if (overlays.transit) {
      hits.push({
        id: "plants-transit",
        effect: "avoid",
        title: "Transit avoids sensitive vegetation",
        detail: "Routes detour living cover. Plants constrain the snap, they do not decorate it.",
        local: plantCount > 0,
      });
    }
  }

  for (const c of orchestrate({ scene, overlays, patches })) {
    hits.push({
      id: c.id,
      effect: consequenceToEffect(c.action),
      title: c.title,
      detail: `${c.cause} → ${c.target}. ${c.detail}`,
      local: true,
    });
  }

  return hits;
}

export function radarDimFactor(overlays: OverlayState): number {
  return overlays.radar ? 0.42 : 1;
}
