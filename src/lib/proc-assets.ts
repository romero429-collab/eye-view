import type { Feature, FeatureCollection, Position } from "geojson";
import { destination, stemPolygon } from "./spatial.ts";

/** Seeded low-poly GIS assets. Same lng/lat always grows the same tree. */

export type AssetKind = "trunk" | "crown" | "rock";

function seedFromLngLat(lng: number, lat: number): number {
  const x = Math.round(lng * 1e5);
  const y = Math.round(lat * 1e5);
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function irregularRing(
  lng: number,
  lat: number,
  radiusM: number,
  sides: number,
  rng: () => number,
  jitter = 0.32,
): Position[] {
  const ring: Position[] = [];
  for (let i = 0; i <= sides; i++) {
    const ang = (i / sides) * 360;
    const r = radiusM * (1 - jitter / 2 + rng() * jitter);
    const p = destination(lng, lat, ang + rng() * 8 - 4, r);
    ring.push([p.lng, p.lat]);
  }
  ring[ring.length - 1] = ring[0];
  return ring;
}

function poly(
  ring: Position[],
  properties: Record<string, string | number | boolean | null>,
): Feature {
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties,
  };
}

function isHerb(text: string): boolean {
  return /grass|crop|wetland|water|farmland|meadow/.test(text) && !/tree|wood|forest|oak|pine|elm|cedar|ash|maple|cottonwood/.test(text);
}

function treePalette(text: string, rng: () => number): { trunk: string; crown: string; tall: boolean; pine: boolean } {
  const pine = /pine|fir|spruce|conifer|cedar/.test(text);
  const tall = pine || /wood|forest|oak|elm|cottonwood/.test(text);
  const crown = pine ? (rng() > 0.5 ? "#1f4a32" : "#2a5a3c") : rng() > 0.45 ? "#2f6b45" : "#3d9e72";
  return { trunk: rng() > 0.5 ? "#5a4638" : "#6a5340", crown, tall, pine };
}

export function treeAt(lng: number, lat: number, title = "Tree", klass = ""): Feature[] {
  const rng = mulberry32(seedFromLngLat(lng, lat));
  const text = `${title} ${klass}`.toLowerCase();
  if (isHerb(text)) return [];
  const pal = treePalette(text, rng);
  const trunkH = pal.tall ? 3.2 + rng() * 2.4 : 2.1 + rng() * 1.6;
  const crownH = pal.pine ? 9 + rng() * 7 : 6 + rng() * 6;
  const trunkR = pal.tall ? 0.7 + rng() * 0.35 : 0.48 + rng() * 0.28;
  const out: Feature[] = [
    stemPolygon(lng, lat, trunkR, {
      kind: "trunk",
      title,
      class: klass || "tree",
      height: trunkH,
      base: 0,
      color: pal.trunk,
      lng,
      lat,
    }, 6),
  ];
  const lobes = pal.pine ? 1 : 2 + (rng() > 0.55 ? 1 : 0);
  for (let i = 0; i < lobes; i++) {
    const offset = i === 0 ? 0 : 1.05 + rng() * 0.7;
    const bearing = i * (360 / Math.max(1, lobes)) + rng() * 24;
    const at = offset === 0 ? { lng, lat } : destination(lng, lat, bearing, offset);
    const radius = pal.pine ? 2.1 + rng() * 0.8 : 2.6 + rng() * 1.4;
    const base = trunkH * (pal.pine ? 0.35 : 0.55 + i * 0.08);
    const height = trunkH + crownH * (pal.pine ? 1 : 0.82 - i * 0.12);
    out.push(
      poly(irregularRing(at.lng, at.lat, radius, pal.pine ? 5 : 6, rng, pal.pine ? 0.12 : 0.38), {
        kind: "crown",
        title,
        class: klass || "canopy",
        height,
        base,
        color: pal.crown,
        lng: at.lng,
        lat: at.lat,
      }),
    );
  }
  return out;
}

export function rockAt(lng: number, lat: number, title = "Rock", klass = ""): Feature {
  const rng = mulberry32(seedFromLngLat(lng, lat) ^ 0x9e3779b9);
  const sides = 5 + Math.floor(rng() * 3);
  const radius = 1.4 + rng() * 2.2;
  const height = 0.7 + rng() * 2.1;
  const color = rng() > 0.5 ? "#7a6458" : "#8a7a62";
  return poly(irregularRing(lng, lat, radius, sides, rng, 0.45), {
    kind: "rock",
    title,
    class: klass || "rock",
    height,
    base: 0,
    color,
    lng,
    lat,
  });
}

export function assetsFromPlants(fc: FeatureCollection, limit = 90): FeatureCollection {
  const features: Feature[] = [];
  for (const feat of fc.features) {
    if (feat.geometry?.type !== "Point") continue;
    const [lng, lat] = feat.geometry.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const title = String(feat.properties?.title ?? "Tree");
    const klass = String(feat.properties?.class ?? feat.properties?.kind ?? "");
    const parts = treeAt(lng, lat, title, klass);
    for (const part of parts) {
      features.push(part);
      if (features.length >= limit) {
        return { type: "FeatureCollection", features };
      }
    }
  }
  return { type: "FeatureCollection", features };
}

export function assetsFromGround(fc: FeatureCollection, limit = 48): FeatureCollection {
  const features: Feature[] = [];
  for (const feat of fc.features) {
    const kind = String(feat.properties?.kind ?? "");
    if (kind === "ditch") continue;
    let lng: number | null = null;
    let lat: number | null = null;
    if (feat.geometry?.type === "Point") {
      [lng, lat] = feat.geometry.coordinates;
    }
    if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const title = String(feat.properties?.title ?? "Rock");
    features.push(rockAt(lng, lat, title, kind));
    if (features.length >= limit) break;
  }
  return { type: "FeatureCollection", features };
}

export function assetCentroid(feat: Feature): { lng: number; lat: number } | null {
  const g = feat.geometry;
  if (!g) return null;
  if (g.type === "Point") return { lng: g.coordinates[0], lat: g.coordinates[1] };
  if (g.type === "Polygon") {
    const ring = g.coordinates[0] ?? [];
    if (!ring.length) return null;
    let x = 0;
    let y = 0;
    const n = ring.length - 1;
    for (let i = 0; i < n; i++) {
      x += ring[i][0];
      y += ring[i][1];
    }
    return { lng: x / n, lat: y / n };
  }
  return null;
}
