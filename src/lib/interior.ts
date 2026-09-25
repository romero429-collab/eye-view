import type { Feature, FeatureCollection, Position } from "geojson";
import { destination, haversineMeters } from "./spatial.ts";
import { mulberry32 } from "./proc-assets.ts";

/** Our interior instance. Same look-at, same rooms.
 *  When a building footprint is under the look-at, the plan uses that
 *  footprint's center, long axis, and size so it does not cut through
 *  the volume. Not a listing scan. */

const WIDTH = 13;
const DEPTH = 10;
const WALL = 0.2;

export type HouseFrame = {
  lng: number;
  lat: number;
  bearing: number;
  width: number;
  depth: number;
};

export type HouseInstance = {
  lng: number;
  lat: number;
  bearing: number;
  door: { lng: number; lat: number };
  rooms: string[];
  fitted: boolean;
  features: FeatureCollection;
};

function seedFromLngLat(lng: number, lat: number): number {
  const x = Math.round(lng * 1e5);
  const y = Math.round(lat * 1e5);
  return (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
}

function shift(lng: number, lat: number, bearing: number, meters: number) {
  if (meters < 0) return destination(lng, lat, bearing + 180, -meters);
  return destination(lng, lat, bearing, meters);
}

function corner(lng: number, lat: number, bearing: number, x: number, y: number) {
  const right = shift(lng, lat, bearing + 90, x);
  return shift(right.lng, right.lat, bearing, y);
}

function ringLngLat(
  lng: number,
  lat: number,
  bearing: number,
  local: Array<[number, number]>,
): Position[] {
  return local.map(([x, y]) => {
    const p = corner(lng, lat, bearing, x, y);
    return [p.lng, p.lat];
  });
}

function feat(
  lng: number,
  lat: number,
  bearing: number,
  local: Array<[number, number]>,
  properties: Record<string, string | number | boolean | null>,
): Feature {
  const ring = ringLngLat(lng, lat, bearing, local);
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties,
  };
}

function box(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
}

function wall(x0: number, y0: number, x1: number, y1: number, thick = WALL): Array<[number, number]> {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (thick / 2);
  const ny = (dx / len) * (thick / 2);
  return [
    [x0 + nx, y0 + ny],
    [x1 + nx, y1 + ny],
    [x1 - nx, y1 - ny],
    [x0 - nx, y0 - ny],
    [x0 + nx, y0 + ny],
  ];
}

function openRing(ring: Position[]): Position[] {
  if (ring.length < 2) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a && b && a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  return ring;
}

function edgeBearing(a: Position, b: Position): number {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function project(lng: number, lat: number, origin: { lng: number; lat: number }, bearing: number) {
  const cos = Math.cos((origin.lat * Math.PI) / 180);
  const e = (lng - origin.lng) * 111320 * cos;
  const n = (lat - origin.lat) * 111320;
  const br = (bearing * Math.PI) / 180;
  return {
    x: e * Math.cos(br) - n * Math.sin(br),
    y: e * Math.sin(br) + n * Math.cos(br),
  };
}

export function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  const pts = openRing(ring);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]?.[0] ?? 0;
    const yi = pts[i]?.[1] ?? 0;
    const xj = pts[j]?.[0] ?? 0;
    const yj = pts[j]?.[1] ?? 0;
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function frameFromRing(ring: Position[]): HouseFrame | null {
  const pts = openRing(ring);
  if (pts.length < 3) return null;
  let lng = 0;
  let lat = 0;
  for (const p of pts) {
    lng += p[0];
    lat += p[1];
  }
  lng /= pts.length;
  lat /= pts.length;
  let longest = 0;
  let longBearing = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (!a || !b) continue;
    const d = haversineMeters(a[0], a[1], b[0], b[1]);
    if (d > longest) {
      longest = d;
      longBearing = edgeBearing(a, b);
    }
  }
  if (longest < 3) return null;
  const bearing = (longBearing + 90) % 360;
  const origin = { lng, lat };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    const q = project(p[0], p[1], origin, bearing);
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  const width = maxX - minX;
  const depth = maxY - minY;
  if (width < 4 || depth < 4) return null;
  return { lng, lat, bearing, width, depth };
}

/** Prefer the footprint that contains the look-at. Otherwise the nearest
 *  centroid within 40 m. Smallest area wins when several contain the point. */
export function pickFootprint(rings: Position[][], lng: number, lat: number): HouseFrame | null {
  let best: HouseFrame | null = null;
  let bestArea = Infinity;
  let nearest: HouseFrame | null = null;
  let nearestD = 40;
  for (const ring of rings) {
    const frame = frameFromRing(ring);
    if (!frame) continue;
    const area = frame.width * frame.depth;
    if (pointInRing(lng, lat, ring) && area < bestArea) {
      best = frame;
      bestArea = area;
    }
    const d = haversineMeters(lng, lat, frame.lng, frame.lat);
    if (d < nearestD) {
      nearest = frame;
      nearestD = d;
    }
  }
  return best ?? nearest;
}

export function houseAt(
  lng: number,
  lat: number,
  frame?: HouseFrame | null,
): HouseInstance {
  const rng = mulberry32(seedFromLngLat(lng, lat));
  const fitted = Boolean(frame);
  const originLng = frame?.lng ?? lng;
  const originLat = frame?.lat ?? lat;
  const bearing = frame?.bearing ?? Math.round(rng() * 360);
  const s = frame ? Math.min(frame.width / WIDTH, frame.depth / DEPTH, 2.4) : 1;
  const u = Math.max(0.45, s);
  const hx = (WIDTH / 2) * u;
  const hy = (DEPTH / 2) * u;
  const doorGap = 0.65 * u;
  const features: Feature[] = [];
  const note = fitted
    ? "Interior fitted to the building footprint under this look-at. Other volumes are hidden so they do not cut the rooms."
    : "Interior at this look-at. No building footprint was loaded, so it is not snapped to a roof.";

  const rooms: Array<{ id: string; label: string; box: [number, number, number, number]; color: string }> = [
    { id: "living", label: "Living", box: [-hx + 0.15 * u, -hy + 0.15 * u, -0.12 * u, 0.15 * u], color: "#c4b89a" },
    { id: "kitchen", label: "Kitchen", box: [0.12 * u, -hy + 0.15 * u, hx - 0.15 * u, 0.15 * u], color: "#d4c2a0" },
    { id: "bed", label: "Bedroom", box: [-hx + 0.15 * u, 0.35 * u, 1.05 * u, hy - 0.15 * u], color: "#9bb8b0" },
    { id: "bath", label: "Bath", box: [1.25 * u, 0.35 * u, hx - 0.15 * u, hy - 0.15 * u], color: "#8a9aa0" },
  ];

  for (const room of rooms) {
    const [x0, y0, x1, y1] = room.box;
    features.push(
      feat(originLng, originLat, bearing, box(x0, y0, x1, y1), {
        kind: "building",
        part: "floor",
        title: room.label,
        room: room.id,
        height: 0.08,
        base: 0,
        color: room.color,
        detail: note,
        lng: originLng,
        lat: originLat,
      }),
    );
  }

  const walls: Array<[number, number, number, number]> = [
    [-hx, hy, hx, hy],
    [-hx, -hy, -hx, hy],
    [hx, -hy, hx, hy],
    [-hx, -hy, -doorGap, -hy],
    [doorGap, -hy, hx, -hy],
    [0, -hy + 0.4 * u, 0, -0.7 * u],
    [0, 0.7 * u, 0, hy - 0.3 * u],
    [-hx + 0.3 * u, 0.25 * u, -0.7 * u, 0.25 * u],
    [0.7 * u, 0.25 * u, hx - 0.3 * u, 0.25 * u],
    [1.15 * u, 0.45 * u, 1.15 * u, hy - 0.3 * u],
  ];
  for (const [x0, y0, x1, y1] of walls) {
    features.push(
      feat(originLng, originLat, bearing, wall(x0, y0, x1, y1, WALL * u), {
        kind: "building",
        part: "wall",
        title: "Wall",
        height: 2.6,
        base: 0.08,
        color: "#6a5340",
        detail: note,
        lng: originLng,
        lat: originLat,
      }),
    );
  }

  const furn: Array<{ title: string; box: [number, number, number, number]; h: number; color: string }> = [
    { title: "Sofa", box: [-4.6 * u, -3.4 * u, -1.8 * u, -2.3 * u], h: 0.72, color: "#5a4638" },
    { title: "Table", box: [-3.6 * u, -1.8 * u, -2.4 * u, -0.8 * u], h: 0.42, color: "#8a7a62" },
    { title: "Counter", box: [2.1 * u, -4.2 * u, 5.8 * u, -3.4 * u], h: 0.9, color: "#7a6458" },
    { title: "Bed", box: [-5.4 * u, 1.6 * u, -2.1 * u, 4.1 * u], h: 0.55, color: "#3d6b5c" },
    { title: "Fixture", box: [3.3 * u, 3.1 * u, 4.7 * u, 4.3 * u], h: 0.45, color: "#5a6a62" },
  ];
  for (const item of furn) {
    const [x0, y0, x1, y1] = item.box;
    features.push(
      feat(originLng, originLat, bearing, box(x0, y0, x1, y1), {
        kind: "building",
        part: "furn",
        title: item.title,
        height: item.h,
        base: 0.08,
        color: item.color,
        detail: note,
        lng: originLng,
        lat: originLat,
      }),
    );
  }

  const door = corner(originLng, originLat, bearing, 0, -hy - 3.2 * u);
  return {
    lng: originLng,
    lat: originLat,
    bearing,
    door,
    rooms: rooms.map((r) => r.label),
    fitted,
    features: { type: "FeatureCollection", features },
  };
}
