import type { Feature, FeatureCollection, Polygon } from "geojson";
import { ZONE_SWATCHES, zoneLabel } from "./basemaps.ts";
import { destination, haversineMeters } from "./spatial.ts";

export type ZoneEdit = "reclass" | "tag" | "split" | "merge" | "flag";
export type ZonePatchSource = "walk" | "query" | "live";
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
};

export type ResolvedZone = {
  class: string | null;
  label: string;
  note: string | null;
  patch: ZonePatch | null;
  flags: ZonePatch[];
};

export const MEMORY_KEY = "kiyoshi.eye.zones.v1";
export const BLOCK_M = 90;
export const SPLIT_M = 42;
export const PROMOTE_WEIGHT = 2.4;

const AVOID_WILDLIFE = new Set(["industrial", "military", "garages", "extractive", "construction"]);

function newId(): string {
  return `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function loadPatches(): ZonePatch[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row === "object" && typeof (row as ZonePatch).id === "string") as ZonePatch[];
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
  return {
    class: klass,
    label: klass ? zoneLabel(klass, osmLabel) : osmLabel,
    note: notes[0] ?? winner?.note ?? null,
    patch: winner,
    flags,
  };
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
  },
): ZonePatch[] {
  const radiusM = input.radiusM ?? (input.action === "split" ? SPLIT_M : BLOCK_M);
  const nearby = patches.find(
    (p) =>
      p.action === input.action &&
      p.class === (input.class ?? null) &&
      haversineMeters(p.lng, p.lat, input.lng, input.lat) < radiusM * 0.6,
  );
  if (nearby) {
    return patches.map((p) =>
      p.id === nearby.id
        ? {
            ...p,
            lng: input.lng,
            lat: input.lat,
            weight: p.weight + 1,
            t: Date.now(),
            note: input.note ?? p.note,
            status: input.status ?? p.status,
          }
        : p,
    );
  }
  const next: ZonePatch = {
    id: newId(),
    lng: input.lng,
    lat: input.lat,
    radiusM,
    action: input.action,
    class: input.class ?? null,
    note: input.note ?? "",
    source: input.source,
    status: input.status ?? (input.source === "live" ? "proposed" : "accepted"),
    weight: input.source === "live" ? 1 : 2,
    t: Date.now(),
  };
  return [...patches, next];
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
  return [
    ...rest,
    {
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
    },
  ];
}

export function confirmPatch(patches: ZonePatch[], id: string): ZonePatch[] {
  return patches.map((p) =>
    p.id === id ? { ...p, status: "accepted" as const, weight: p.weight + 1, t: Date.now() } : p,
  );
}

export function dismissPatch(patches: ZonePatch[], id: string): ZonePatch[] {
  return patches.filter((p) => p.id !== id);
}

export function absorbLive(
  patches: ZonePatch[],
  scene: { lng: number; lat: number; zoom: number; zoneClass: string | null; wildlife: number; transit: number; events: number; alerts: number; quakes: number },
  overlays: { wildlife?: boolean; transit?: boolean; events?: boolean; alerts?: boolean; quakes?: boolean },
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

  return next.map((p) => {
    if (p.status === "proposed" && p.action === "reclass" && p.weight >= PROMOTE_WEIGHT) {
      return { ...p, status: "accepted" as const, note: p.note || "Promoted from live evidence" };
    }
    return p;
  });
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
        patch.action === "tag"
          ? patch.note || "Tagged district"
          : patch.class
            ? `${zoneLabel(patch.class)} · ${patch.action}`
            : patch.action,
      detail:
        patch.status === "proposed"
          ? patch.note || "Live feed proposed this change. Confirm or dismiss."
          : patch.note || "Learned district. Overrides OSM at this look-at.",
      sourceLabel: patch.source === "live" ? "Live evidence" : patch.source === "walk" ? "Ground walk" : "Query",
    },
  }));
  return { type: "FeatureCollection", features };
}

export const EDIT_CLASSES = ZONE_SWATCHES.map((s) => ({ id: s.id, label: s.label }));
