import type { Feature } from "geojson";
import { haversineMeters } from "./spatial.ts";

/** A photographed viewpoint. Google Street View is this: a picture taken
 *  on the road, linked to the next one. The facade is in the photo. */

export type StreetShot = {
  id: string;
  lng: number;
  lat: number;
  azimuth: number;
  image: string;
  when: string;
  producer: string;
  nextId: string | null;
  prevId: string | null;
};

type RawLink = { rel?: string; id?: string };
type RawFeature = {
  id?: string;
  geometry?: { type?: string; coordinates?: number[] };
  assets?: {
    sd?: { href?: string };
    hd?: { href?: string };
    thumb?: { href?: string };
  };
  properties?: Record<string, unknown>;
  links?: RawLink[];
};

export function shotsFromPanoramax(raw: unknown): StreetShot[] {
  const features = (raw as { features?: RawFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const shots: StreetShot[] = [];
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    const lng = coords?.[0];
    const lat = coords?.[1];
    if (lng == null || lat == null || !feature.id) continue;
    const props = feature.properties ?? {};
    const image =
      feature.assets?.sd?.href ||
      feature.assets?.hd?.href ||
      (typeof props["geovisio:image"] === "string" ? props["geovisio:image"] : "");
    if (!image) continue;
    const azimuth = Number(props["view:azimuth"]);
    const link = (rel: string) => feature.links?.find((item) => item.rel === rel)?.id ?? null;
    shots.push({
      id: feature.id,
      lng,
      lat,
      azimuth: Number.isFinite(azimuth) ? azimuth : 0,
      image,
      when: typeof props.datetime === "string" ? props.datetime.slice(0, 10) : "",
      producer: typeof props["geovisio:producer"] === "string" ? props["geovisio:producer"] : "Panoramax",
      nextId: link("next"),
      prevId: link("prev"),
    });
  }
  return shots;
}

export function nearestShot(shots: StreetShot[], lng: number, lat: number): StreetShot | null {
  let best: StreetShot | null = null;
  let bestD = Infinity;
  for (const shot of shots) {
    const d = haversineMeters(lng, lat, shot.lng, shot.lat);
    if (d < bestD) {
      best = shot;
      bestD = d;
    }
  }
  return best;
}

export function shotFromFeature(feature: Feature): StreetShot | null {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const coords = feature.geometry?.type === "Point" ? feature.geometry.coordinates : null;
  const id = typeof props.id === "string" ? props.id : "";
  const image = typeof props.image === "string" ? props.image : "";
  if (!id || !image || !coords) return null;
  return {
    id,
    lng: coords[0] ?? 0,
    lat: coords[1] ?? 0,
    azimuth: Number(props.azimuth) || 0,
    image,
    when: typeof props.when === "string" ? props.when : "",
    producer: typeof props.producer === "string" ? props.producer : "Panoramax",
    nextId: typeof props.nextId === "string" && props.nextId ? props.nextId : null,
    prevId: typeof props.prevId === "string" && props.prevId ? props.prevId : null,
  };
}

/** Window into a 360 photo. x may fall outside the image so the draw can wrap. */
export function cropWindow(yawDeg: number, pitchDeg: number, fovDeg: number, imgW: number, imgH: number) {
  const fov = Math.min(100, Math.max(50, fovDeg));
  const w = (fov / 360) * imgW;
  const h = Math.min(imgH * 0.85, (fov / 140) * imgH);
  const yaw = ((yawDeg % 360) + 360) % 360;
  const x = (yaw / 360) * imgW - w / 2;
  const pitch = Math.max(-35, Math.min(35, pitchDeg));
  let y = imgH / 2 - h / 2 - (pitch / 70) * Math.max(0, imgH - h);
  y = Math.max(0, Math.min(Math.max(0, imgH - h), y));
  return { x, y, w, h };
}
