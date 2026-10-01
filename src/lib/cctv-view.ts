import type { Feature, FeatureCollection } from "geojson";
import { geohashEncode } from "./geohash.ts";
import { bulkRTree } from "./rtree.ts";

type CamRow = [string, number, number, number];

function cameraTitle(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Ground rectangle for the pixels on screen, not the globe's horizon. */
export function boundsAround(
  lng: number,
  lat: number,
  zoom: number,
  widthPx: number,
  heightPx: number,
): { west: number; south: number; east: number; north: number } {
  const degPerPx = 360 / (512 * 2 ** Math.max(zoom, 0));
  const halfLat = (heightPx / 2) * degPerPx;
  const cos = Math.cos((lat * Math.PI) / 180);
  const halfLng = (widthPx / 2) * degPerPx / (Math.abs(cos) < 0.15 ? 0.15 : cos);
  return {
    west: lng - halfLng,
    east: lng + halfLng,
    south: Math.max(-85, lat - halfLat),
    north: Math.min(85, lat + halfLat),
  };
}

function gridKeys(
  west: number,
  south: number,
  east: number,
  north: number,
  centerLat?: number,
  centerLng?: number,
): string[] {
  const spans: Array<[number, number]> = west <= east ? [[west, east]] : [[west, 180], [-180, east]];
  const keys: string[] = [];
  for (let lat = Math.floor(south); lat <= Math.floor(north); lat++) {
    for (const [lo, hi] of spans) {
      for (let lng = Math.floor(lo); lng <= Math.floor(hi); lng++) keys.push(`${lat}_${lng}`);
    }
  }
  const center =
    centerLat != null && centerLng != null ? `${Math.floor(centerLat)}_${Math.floor(centerLng)}` : null;
  if (keys.length <= 9) return center && !keys.includes(center) ? [center, ...keys] : keys;
  const step = Math.max(1, Math.ceil(keys.length / 7));
  const chosen: string[] = center ? [center] : [];
  for (let i = 0; i < keys.length && chosen.length < 8; i += step) {
    if (!chosen.includes(keys[i]!)) chosen.push(keys[i]!);
  }
  return chosen;
}

export async function cctvInView(
  west: number,
  south: number,
  east: number,
  north: number,
  centerLat?: number,
  centerLng?: number,
): Promise<FeatureCollection> {
  const keys = gridKeys(west, south, east, north, centerLat, centerLng);
  const rows: CamRow[] = [];
  await Promise.all(
    keys.map(async (key) => {
      try {
        const res = await fetch(`/cctv/${key}.json`);
        if (!res.ok) return;
        const data = (await res.json()) as CamRow[];
        if (Array.isArray(data)) rows.push(...data);
      } catch {
        /* this square has no published cameras */
      }
    }),
  );
  const tree = bulkRTree(
    rows.map((row) => ({ x: row[2], y: row[1], value: row })),
  );
  const hits = tree.search(west, south, east, north);
  const live = hits.filter((row) => row[3]);
  const still = hits.filter((row) => !row[3]);
  const picked = live.slice(0, 80);
  const room = Math.max(0, 280 - picked.length);
  const step = Math.max(1, Math.ceil(still.length / Math.max(room, 1)));
  for (let i = 0; i < still.length && picked.length < 280; i += step) picked.push(still[i]!);
  return {
    type: "FeatureCollection",
    features: picked.map((row) => {
      const [id, lat, lng, moving] = row;
      const hash = geohashEncode(lat, lng, 6);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          kind: "camera",
          title: cameraTitle(id),
          detail: moving ? "Live video. Click to open the feed." : "Public camera. Click to open the still.",
          source: "Public camera directory",
          live: moving ? 1 : 0,
          facts: JSON.stringify([
            { label: "Id", value: id },
            { label: "Geohash", value: hash },
            { label: "Picture", value: moving ? "Live video feed" : "Public still" },
          ]),
        },
      } satisfies Feature;
    }),
  };
}
