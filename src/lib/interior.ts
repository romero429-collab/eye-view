import type { Feature, FeatureCollection, Position } from "geojson";
import { destination } from "./spatial.ts";
import { mulberry32 } from "./proc-assets.ts";

/** Our interior instance. A look-at grows the same rooms every time.
 *  This is not a scanned listing and not an Unreal import. */

const WIDTH = 13;
const DEPTH = 10;
const WALL = 0.2;

export type HouseInstance = {
  lng: number;
  lat: number;
  bearing: number;
  door: { lng: number; lat: number };
  rooms: string[];
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

const NOTE = "Our interior instance at this look-at. Not a listing scan and not an Unreal import.";

export function houseAt(lng: number, lat: number): HouseInstance {
  const rng = mulberry32(seedFromLngLat(lng, lat));
  const bearing = Math.round(rng() * 360);
  const hx = WIDTH / 2;
  const hy = DEPTH / 2;
  const doorGap = 0.65;
  const features: Feature[] = [];

  const rooms: Array<{ id: string; label: string; box: [number, number, number, number]; color: string }> = [
    { id: "living", label: "Living", box: [-hx + 0.15, -hy + 0.15, -0.12, 0.15], color: "#c4b89a" },
    { id: "kitchen", label: "Kitchen", box: [0.12, -hy + 0.15, hx - 0.15, 0.15], color: "#d4c2a0" },
    { id: "bed", label: "Bedroom", box: [-hx + 0.15, 0.35, 1.05, hy - 0.15], color: "#9bb8b0" },
    { id: "bath", label: "Bath", box: [1.25, 0.35, hx - 0.15, hy - 0.15], color: "#8a9aa0" },
  ];

  for (const room of rooms) {
    const [x0, y0, x1, y1] = room.box;
    features.push(
      feat(lng, lat, bearing, box(x0, y0, x1, y1), {
        kind: "building",
        part: "floor",
        title: room.label,
        room: room.id,
        height: 0.08,
        base: 0,
        color: room.color,
        detail: NOTE,
        lng,
        lat,
      }),
    );
  }

  const walls: Array<[number, number, number, number]> = [
    [-hx, hy, hx, hy],
    [-hx, -hy, -hx, hy],
    [hx, -hy, hx, hy],
    [-hx, -hy, -doorGap, -hy],
    [doorGap, -hy, hx, -hy],
    [0, -hy + 0.4, 0, -0.7],
    [0, 0.7, 0, hy - 0.3],
    [-hx + 0.3, 0.25, -0.7, 0.25],
    [0.7, 0.25, hx - 0.3, 0.25],
    [1.15, 0.45, 1.15, hy - 0.3],
  ];
  for (const [x0, y0, x1, y1] of walls) {
    features.push(
      feat(lng, lat, bearing, wall(x0, y0, x1, y1), {
        kind: "building",
        part: "wall",
        title: "Wall",
        height: 2.6,
        base: 0.08,
        color: "#6a5340",
        detail: NOTE,
        lng,
        lat,
      }),
    );
  }

  const furn: Array<{ title: string; box: [number, number, number, number]; h: number; color: string }> = [
    { title: "Sofa", box: [-4.6, -3.4, -1.8, -2.3], h: 0.72, color: "#5a4638" },
    { title: "Table", box: [-3.6, -1.8, -2.4, -0.8], h: 0.42, color: "#8a7a62" },
    { title: "Counter", box: [2.1, -4.2, 5.8, -3.4], h: 0.9, color: "#7a6458" },
    { title: "Bed", box: [-5.4, 1.6, -2.1, 4.1], h: 0.55, color: "#3d6b5c" },
    { title: "Fixture", box: [3.3, 3.1, 4.7, 4.3], h: 0.45, color: "#5a6a62" },
  ];
  for (const item of furn) {
    const [x0, y0, x1, y1] = item.box;
    features.push(
      feat(lng, lat, bearing, box(x0, y0, x1, y1), {
        kind: "building",
        part: "furn",
        title: item.title,
        height: item.h,
        base: 0.08,
        color: item.color,
        detail: NOTE,
        lng,
        lat,
      }),
    );
  }

  const door = corner(lng, lat, bearing, 0, -hy - 4.5);
  return {
    lng,
    lat,
    bearing,
    door,
    rooms: rooms.map((r) => r.label),
    features: { type: "FeatureCollection", features },
  };
}
