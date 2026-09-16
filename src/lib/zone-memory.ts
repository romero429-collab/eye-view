import type { Feature, FeatureCollection, Polygon } from "geojson";
import { ZONE_SWATCHES, zoneLabel } from "./basemaps.ts";
import { destination, haversineMeters } from "./spatial.ts";

export type ZoneEdit = "reclass" | "tag" | "split" | "merge" | "flag";
export type ZonePatchSource = "walk" | "query" | "live" | "ripple";
export type ZonePatchStatus = "proposed" | "accepted";

export type ZonePatch = {
  id: string;
  lng: number;
  lat: number;
  radiusM: number;
  action: ZoneEdit;
  class: string | null;
  note: string;
  source: ZonePatchSource;
  status: ZonePatchStatus;
  weight: number;
  t: number;
  parentId: string | null;
  generation: number;
};

export type ResolvedZone = {
  class: string | null;
  label: string;
  note: string | null;
  patch: ZonePatch | null;
  flags: ZonePatch[];
  queued: number;
  immediate: boolean;
};

export const MEMORY_KEY = "kiyoshi.eye.zones.v1";
export const BLOCK_M = 90;
export const SPLIT_M = 42;
export const PROMOTE_WEIGHT = 2.4;
/** One hop. Local commit is immediate; neighbors are queued, never overwritten. */
export const MAX_HOP = 1;
export const RIPPLE_GAP_M = BLOCK_M * 2;
const CARDINALS = [0, 90, 180, 270];

const AVOID_WILDLIFE = new Set(["industrial", "military", "garages", "extractive", "construction"]);

function newId(): string {
  return `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function withMeta(row: ZonePatch): ZonePatch {
  return {
    ...row,
    parentId: row.parentId ?? null,
    generation: row.generation ?? 0,
  };
}

export function loadPatches(): ZonePatch[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === "object" && typeof (row as ZonePatch).id === "string")
      .map((row) => withMeta(row as ZonePatch));
  } catch {
    return [];
  }
}

export function persistPatches(patches: ZonePatch[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(patches.slice(-80)));
  } catch {
    /* quota */
  }
}

export function containsPatch(patch: ZonePatch, lng: number, lat: number): boolean {
  return haversineMeters(patch.lng, patch.lat, lng, lat) <= patch.radiusM;
}

export function patchesAt(patches: ZonePatch[], lng: number, lat: number): ZonePatch[] {
  return patches.filter((p) => containsPatch(p, lng, lat));
}

export function connectedTo(patches: ZonePatch[], origin: ZonePatch): ZonePatch[] {
  return patches.filter((p) => {
    if (p.id === origin.id) return false;
    const reach = origin.radiusM + p.radiusM + 24;
    return haversineMeters(origin.lng, origin.lat, p.lng, p.lat) <= reach;
  });
}

export function resolveZone(
  patches: ZonePatch[],
  lng: number,
  lat: number,
  osmClass: string | null,
  osmLabel: string,
): ResolvedZone {
  const here = patchesAt(patches, lng, lat);
  const flags = here.filter((p) => p.status === "proposed");
  const claimed = here
    .filter((p) => p.status === "accepted" && p.class && (p.action === "reclass" || p.action === "split" || p.action === "merge"))
    .sort((a, b) => a.radiusM - b.radiusM || b.weight - a.weight);
  const winner = claimed[0] ?? null;
  const klass = winner?.class ?? osmClass;
  const notes = here
    .filter((p) => p.action === "tag" && p.note)
    .map((p) => p.note);
  const children = winner
    ? patches.filter((p) => p.status === "proposed" && p.parentId === winner.id).length
    : 0;
  return {
    class: klass,
    label: klass ? zoneLabel(klass, osmLabel) : osmLabel,
    note: notes[0] ?? winner?.note ?? null,
    patch: winner,
    flags,
    queued: children,
    immediate: Boolean(winner),
  };
}

function classChanging(action: ZoneEdit): boolean {
  return action === "reclass" || action === "split" || action === "merge";
}

export function writePatch(
  patches: ZonePatch[],
  input: {
    lng: number;
    lat: number;
    action: ZoneEdit;
    class?: string | null;
    note?: string;
    source: ZonePatchSource;
    radiusM?: number;
    status?: ZonePatchStatus;
    parentId?: string | null;
    generation?: number;
  },
): ZonePatch[] {
  const radiusM = input.radiusM ?? (input.action === "split" ? SPLIT_M : BLOCK_M);
  const status = input.status ?? (input.source === "live" || input.source === "ripple" ? "proposed" : "accepted");
  const generation = input.generation ?? (input.source === "ripple" ? 1 : 0);
  const nearby = patches.find(
    (p) =>
      p.action === input.action &&
      p.class === (input.class ?? null) &&
      haversineMeters(p.lng, p.lat, input.lng, input.lat) < radiusM * 0.6,
  );
  if (nearby) {
    const becameAccepted = nearby.status !== "accepted" && status === "accepted";
    const next = patches.map((p) =>
      p.id === nearby.id
        ? {
            ...p,
            lng: input.lng,
            lat: input.lat,
            weight: p.weight + 1,
            t: Date.now(),
            note: input.note ?? p.note,
            status,
            parentId: input.parentId ?? p.parentId,
            generation: p.generation,
          }
        : p,
    );
    return becameAccepted ? propagateFrom(next, nearby.id) : next;
  }
  const created: ZonePatch = {
    id: newId(),
    lng: input.lng,
    lat: input.lat,
    radiusM,
    action: input.action,
    class: input.class ?? null,
    note: input.note ?? "",
    source: input.source,
    status,
    weight: input.source === "live" || input.source === "ripple" ? 1 : 2,
    t: Date.now(),
    parentId: input.parentId ?? null,
    generation,
  };
  const next = [...patches, created];
  if (status === "accepted" && classChanging(created.action) && created.source !== "ripple") {
    return propagateFrom(next, created.id);
  }
  return next;
}

function queueNeighbors(patches: ZonePatch[], origin: ZonePatch): ZonePatch[] {
  if (!origin.class) return patches;
  let next = patches;
  for (const neighbor of connectedTo(patches, origin)) {
    if (neighbor.status === "accepted" && neighbor.class === origin.class) continue;
    if (neighbor.id === origin.id) continue;
    next = writePatch(next, {
      lng: neighbor.lng,
      lat: neighbor.lat,
      action: "reclass",
      class: origin.class,
      note: `Queued from adjacent ${zoneLabel(origin.class).toLowerCase()} — confirm to apply.`,
      source: "ripple",
      status: "proposed",
      parentId: origin.id,
      generation: Math.min((origin.generation ?? 0) + 1, MAX_HOP),
      radiusM: neighbor.radiusM,
    });
  }
  return next;
}

function seedAdjacency(patches: ZonePatch[], origin: ZonePatch): ZonePatch[] {
  if (!origin.class || (origin.generation ?? 0) >= MAX_HOP) return patches;
  let next = patches;
  for (const bearing of CARDINALS) {
    const spot = destination(origin.lng, origin.lat, bearing, RIPPLE_GAP_M);
    const already = patchesAt(next, spot.lng, spot.lat).some(
      (p) => p.status === "accepted" && p.class === origin.class,
    );
    if (already) continue;
    next = writePatch(next, {
      lng: spot.lng,
      lat: spot.lat,
      action: "reclass",
      class: origin.class,
      note: `Queued from ${zoneLabel(origin.class).toLowerCase()} next door. Independent until you confirm.`,
      source: "ripple",
      status: "proposed",
      parentId: origin.id,
      generation: 1,
      radiusM: origin.radiusM,
    });
  }
  return next;
}

export function propagateFrom(patches: ZonePatch[], originId: string): ZonePatch[] {
  const origin = patches.find((p) => p.id === originId);
  if (!origin || origin.status !== "accepted" || !classChanging(origin.action) || !origin.class) {
    return patches;
  }
  let next = queueNeighbors(patches, origin);
  if ((origin.generation ?? 0) < MAX_HOP) next = seedAdjacency(next, origin);
  return next;
}

export function mergeAt(patches: ZonePatch[], lng: number, lat: number, klass: string | null): ZonePatch[] {
  const here = patchesAt(patches, lng, lat).filter((p) => p.status === "accepted");
  const targetClass = klass || here[0]?.class;
  if (!targetClass) {
    return writePatch(patches, {
      lng,
      lat,
      action: "merge",
      class: klass,
      note: "Merged at look-at",
      source: "walk",
    });
  }
  const keep = here.find((p) => p.class === targetClass) ?? here[0];
  const absorbed = new Set(here.map((p) => p.id));
  const rest = patches.filter((p) => !absorbed.has(p.id));
  const radius = Math.max(BLOCK_M, ...here.map((p) => p.radiusM + 24));
  const merged: ZonePatch = {
    id: keep?.id ?? newId(),
    lng,
    lat,
    radiusM: radius,
    action: "merge",
    class: targetClass,
    note: keep?.note || "Merged districts",
    source: "walk",
    status: "accepted",
    weight: (keep?.weight ?? 1) + here.length,
    t: Date.now(),
    parentId: null,
    generation: 0,
  };
  return propagateFrom([...rest, merged], merged.id);
}

export function confirmPatch(patches: ZonePatch[], id: string): ZonePatch[] {
  const next = patches.map((p) =>
    p.id === id ? { ...p, status: "accepted" as const, weight: p.weight + 1, t: Date.now() } : p,
  );
  return propagateFrom(next, id);
}

export function dismissPatch(patches: ZonePatch[], id: string): ZonePatch[] {
  return patches.filter((p) => p.id !== id && p.parentId !== id);
}

export function absorbLive(
  patches: ZonePatch[],
  scene: { lng: number; lat: number; zoom: number; zoneClass: string | null; wildlife: number; plants?: number; transit: number; events: number; alerts: number; quakes: number },
  overlays: { wildlife?: boolean; plants?: boolean; transit?: boolean; events?: boolean; alerts?: boolean; quakes?: boolean },
): ZonePatch[] {
  if (scene.zoom < 8) return patches;
  let next = patches;
  const klass = scene.zoneClass;

  const flag = (action: ZoneEdit, target: string | null, note: string) => {
    next = writePatch(next, {
      lng: scene.lng,
      lat: scene.lat,
      action,
      class: target,
      note,
      source: "live",
      status: "proposed",
    });
  };

  if (overlays.wildlife && scene.wildlife > 0 && klass && AVOID_WILDLIFE.has(klass)) {
    flag("reclass", "park", "Wildlife is using ground tagged industrial — propose park / corridor.");
  }
  if (overlays.plants && (scene.plants ?? 0) > 0 && klass && AVOID_WILDLIFE.has(klass)) {
    flag("reclass", "park", "Living cover on paved zoning — propose park / wood.");
  }
  if (overlays.plants && (scene.plants ?? 0) > 0 && (klass === "commercial" || klass === "retail")) {
    flag("reclass", "park", "Native plants on commercial ground — the district may need reclass.");
  }
  if (overlays.transit && scene.transit > 2 && klass && (klass === "industrial" || klass === "extractive" || klass === "military")) {
    flag("reclass", "commercial", "Transit density does not match this district class.");
  }
  if (overlays.events && scene.events > 0) {
    flag("flag", klass, "Live hazard sits inside this district.");
  }
  if (overlays.alerts && scene.alerts > 0) {
    flag("flag", klass, "Weather alert covers this district.");
  }
  if (overlays.quakes && scene.quakes > 0) {
    flag("flag", klass, "Seismic activity — treat this district as unstable.");
  }

  const promoted: string[] = [];
  next = next.map((p) => {
    if (p.status === "proposed" && p.action === "reclass" && p.weight >= PROMOTE_WEIGHT) {
      promoted.push(p.id);
      return { ...p, status: "accepted" as const, note: p.note || "Promoted from live evidence" };
    }
    return p;
  });
  for (const id of promoted) next = propagateFrom(next, id);
  return next;
}

export function patchPolygon(patch: ZonePatch): Polygon {
  const ring: Array<[number, number]> = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 360;
    const p = destination(patch.lng, patch.lat, bearing, patch.radiusM);
    ring.push([p.lng, p.lat]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

export function patchesToGeoJSON(patches: ZonePatch[]): FeatureCollection {
  const features: Feature[] = patches.map((patch) => ({
    type: "Feature",
    id: patch.id,
    geometry: patchPolygon(patch),
    properties: {
      id: patch.id,
      class: patch.class ?? "unknown",
      action: patch.action,
      status: patch.status,
      note: patch.note,
      source: patch.source,
      kind: "zone",
      title:
        patch.source === "ripple"
          ? `Queued ${patch.class ? zoneLabel(patch.class).toLowerCase() : "district"}`
          : patch.action === "tag"
            ? patch.note || "Tagged district"
            : patch.class
              ? `${zoneLabel(patch.class)} · ${patch.action}`
              : patch.action,
      detail:
        patch.source === "ripple"
          ? patch.note || "Queued from a connected district. Independent until you confirm."
          : patch.status === "proposed"
            ? patch.note || "Live feed proposed this change. Confirm or dismiss."
            : patch.note || "Applied immediately. Adjacent blocks are queued, not overwritten.",
      sourceLabel:
        patch.source === "ripple"
          ? "Queued neighbor"
          : patch.source === "live"
            ? "Live evidence"
            : patch.source === "walk"
              ? "Ground walk"
              : "Query",
    },
  }));
  return { type: "FeatureCollection", features };
}

export const EDIT_CLASSES = ZONE_SWATCHES.map((s) => ({ id: s.id, label: s.label }));
