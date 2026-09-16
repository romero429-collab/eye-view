import type { Feature, FeatureCollection } from "geojson";
import { zoneLabel, type OverlayState } from "./basemaps.ts";
import { destination } from "./spatial.ts";
import { resolveZone, type ZonePatch } from "./zone-memory.ts";

/** How movement is doing through the look-at — not a GTFS timetable. */
export type TransitMood = "flowing" | "constrained" | "reroute" | "orphan";

export type TransitSense = {
  mood: TransitMood;
  title: string;
  detail: string;
  zoneClass: string | null;
  zoneLabel: string;
  vehicles: number;
  learned: boolean;
  paper: boolean;
};

type SceneBits = {
  lng: number;
  lat: number;
  zoneClass: string | null;
  zoneLabel: string;
  transit?: number;
  events?: number;
  alerts?: number;
  quakes?: number;
};

export type CorridorStat = { flowing: number; blocked: number; t: number };
export type CorridorBook = Record<string, CorridorStat>;

export const CORRIDOR_KEY = "kiyoshi.eye.corridors.v1";
export const TRANSIT_SERVES = new Set(["residential", "commercial", "retail", "civic"]);
export const TRANSIT_FIGHTS = new Set([
  "extractive",
  "military",
  "construction",
  "park",
  "wood",
  "cemetery",
  "garages",
  "industrial",
  "quarry",
]);

export const MOOD_COLOR: Record<TransitMood, string> = {
  flowing: "#7ecad4",
  constrained: "#d4a054",
  reroute: "#c45c2a",
  orphan: "#8b90a0",
};

export function loadCorridors(): CorridorBook {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CORRIDOR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as CorridorBook;
  } catch {
    return {};
  }
}

export function persistCorridors(book: CorridorBook): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CORRIDOR_KEY, JSON.stringify(book));
  } catch {
    /* quota */
  }
}

export function rememberCorridor(book: CorridorBook, klass: string | null, mood: TransitMood, count = 1): CorridorBook {
  if (!klass || klass === "unknown") return book;
  const row = book[klass] ?? { flowing: 0, blocked: 0, t: 0 };
  const add = Math.max(1, count);
  const next: CorridorStat =
    mood === "flowing"
      ? { flowing: row.flowing + add, blocked: row.blocked, t: Date.now() }
      : { flowing: row.flowing, blocked: row.blocked + add, t: Date.now() };
  const out = { ...book, [klass]: next };
  persistCorridors(out);
  return out;
}

export function isPaperRoute(book: CorridorBook, klass: string | null): boolean {
  if (!klass) return false;
  const row = book[klass];
  if (!row) return false;
  return row.blocked + row.flowing >= 3 && row.blocked > row.flowing;
}

export function perceiveMovement(args: {
  scene: SceneBits | null;
  overlays: OverlayState;
  patches?: ZonePatch[];
  book?: CorridorBook;
  vehicles?: number;
}): TransitSense {
  const { scene, overlays, patches = [], book = {}, vehicles = scene?.transit ?? 0 } = args;
  const learned = scene
    ? resolveZone(patches, scene.lng, scene.lat, scene.zoneClass, scene.zoneLabel)
    : null;
  const klass = learned?.class ?? scene?.zoneClass;
  const labeled = learned?.label || scene?.zoneLabel || zoneLabel(klass ?? "", "this district");
  const hazard =
    (overlays.events && (scene?.events ?? 0) > 0) ||
    (overlays.alerts && (scene?.alerts ?? 0) > 0) ||
    (overlays.quakes && (scene?.quakes ?? 0) > 0);
  const paper = isPaperRoute(book, klass ?? null);
  const fought = Boolean(klass && TRANSIT_FIGHTS.has(klass));
  const served = Boolean(klass && TRANSIT_SERVES.has(klass));
  const orphan = Boolean(learned?.patch && fought);

  let mood: TransitMood = "flowing";
  if (hazard) mood = "reroute";
  else if (orphan) mood = "orphan";
  else if (fought || paper) mood = "constrained";
  else if (klass && !served && klass !== "unknown") mood = "constrained";

  const titles: Record<TransitMood, string> = {
    flowing: vehicles > 0 ? `Transit is moving through ${labeled.toLowerCase()}` : `${labeled} would carry movement`,
    constrained: paper
      ? `Paper route — ${labeled.toLowerCase()} fails on the ground`
      : `${labeled} constrains movement`,
    reroute: "Route seeking around this hazard",
    orphan: `Paper route — ${labeled.toLowerCase()} no longer serves buses`,
  };
  const details: Record<TransitMood, string> = {
    flowing:
      vehicles > 0
        ? "Live vehicles occupy this district and the corridor holds. This is movement through a zone, not a timetable."
        : "No live bus in this view. The district would still carry a through-route — corridor judgment, not a missing feed.",
    constrained:
      "The district fights a through-route. Industrial, extractive, park, and learned reclass change what a bus may do here.",
    reroute:
      "Flood, alert, or seismic in this district. Vehicles do not stay on the paper line — they seek around the hazard.",
    orphan:
      "A learned reclass took this ground off the corridor. The old route looks fine on paper and wrong in the zone.",
  };

  return {
    mood,
    title: titles[mood],
    detail: details[mood],
    zoneClass: klass && klass !== "unknown" ? klass : null,
    zoneLabel: labeled,
    vehicles,
    learned: Boolean(learned?.patch),
    paper,
  };
}

export function stampTransit(data: FeatureCollection, sense: TransitSense): FeatureCollection {
  const features = data.features.map((feat) => ({
    ...feat,
    properties: {
      ...feat.properties,
      mood: sense.mood,
      sense: sense.zoneLabel,
      kind: "transit",
      detail: [feat.properties?.detail, sense.title].filter(Boolean).join(" · "),
    },
  }));
  return { type: "FeatureCollection", features };
}

export function detourCollection(data: FeatureCollection): FeatureCollection {
  const features: Feature[] = [];
  for (const feat of data.features) {
    if (feat.properties?.mood !== "reroute") continue;
    const geom = feat.geometry;
    if (!geom || geom.type !== "Point") continue;
    const [lng, lat] = geom.coordinates;
    if (lng == null || lat == null) continue;
    const bearing = Number(feat.properties?.bearing ?? 0);
    const seek = destination(lng, lat, bearing + 70, 140);
    features.push({
      type: "Feature",
      properties: { kind: "transit", mood: "reroute", title: "Seeking around hazard" },
      geometry: {
        type: "LineString",
        coordinates: [
          [lng, lat],
          [seek.lng, seek.lat],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}
