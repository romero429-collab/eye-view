import type { Feature, FeatureCollection, Position } from "geojson";
import { TILES } from "./basemaps.ts";

/** Sample the satellite tile under a footprint and return a color for the
 *  extrusion that already exists. The object stays. Only its paint changes. */

const pixels = new Map<string, Promise<ImageData | null>>();

function mercY(lat: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return Math.min(1, Math.max(0, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)));
}

function tileOf(lng: number, lat: number, zoom: number) {
  const z = Math.max(14, Math.min(17, Math.round(zoom)));
  const n = 2 ** z;
  const x = Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(mercY(lat) * n)));
  return { z, x, y, n };
}

function pixelOf(lng: number, lat: number, tile: { x: number; y: number; n: number }) {
  const gx = ((lng + 180) / 360) * tile.n;
  const gy = mercY(lat) * tile.n;
  return {
    x: Math.min(255, Math.max(0, Math.floor((gx - tile.x) * 256))),
    y: Math.min(255, Math.max(0, Math.floor((gy - tile.y) * 256))),
  };
}

function ringPoint(ring: Position[]): Position | null {
  if (!ring.length) return null;
  let lng = 0;
  let lat = 0;
  const n = Math.min(ring.length, 8);
  for (let i = 0; i < n; i++) {
    lng += ring[i]![0];
    lat += ring[i]![1];
  }
  return [lng / n, lat / n];
}

function loadTile(z: number, x: number, y: number): Promise<ImageData | null> {
  const key = `${z}/${x}/${y}`;
  const hit = pixels.get(key);
  if (hit) return hit;
  const job = new Promise<ImageData | null>((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, 256, 256);
      try {
        resolve(ctx.getImageData(0, 0, 256, 256));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = TILES.imagery.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  });
  pixels.set(key, job);
  return job;
}

function hexFrom(data: ImageData, x: number, y: number): string {
  const i = (y * 256 + x) * 4;
  const r = data.data[i] ?? 0;
  const g = data.data[i + 1] ?? 0;
  const b = data.data[i + 2] ?? 0;
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export async function satelliteColor(lng: number, lat: number, zoom: number): Promise<string | null> {
  const tile = tileOf(lng, lat, zoom);
  const data = await loadTile(tile.z, tile.x, tile.y);
  if (!data) return null;
  const px = pixelOf(lng, lat, tile);
  return hexFrom(data, px.x, px.y);
}

export async function paintSatelliteColors(collection: FeatureCollection, zoom: number): Promise<FeatureCollection> {
  const features: Feature[] = [];
  for (const feature of collection.features) {
    const geom = feature.geometry;
    const ring = geom?.type === "Polygon" ? (geom.coordinates[0] as Position[]) : null;
    const at = ring ? ringPoint(ring) : null;
    if (!at) {
      features.push(feature);
      continue;
    }
    const color = await satelliteColor(at[0], at[1], zoom);
    if (!color) {
      features.push(feature);
      continue;
    }
    features.push({
      ...feature,
      properties: { ...(feature.properties ?? {}), color },
    });
  }
  return { type: "FeatureCollection", features };
}
