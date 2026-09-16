import type { Feature, Geometry } from "geojson";
import type { CountryRecord } from "@/lib/metrics";
import type { Place } from "@/lib/places";

export type CountryFeature = Feature<Geometry, { name: string }> & {
  id?: string | number;
};

export type MapObjectKind =
  | "country"
  | "quake"
  | "transit"
  | "flight"
  | "alert"
  | "event"
  | "trail"
  | "sighting"
  | "plant"
  | "rail"
  | "fence"
  | "farm"
  | "health"
  | "plot"
  | "building"
  | "address"
  | "zone"
  | "sensor";

export type MapObject = {
  kind: MapObjectKind;
  title: string;
  detail: string;
  source?: string;
  layer?: string;
  ground?: string;
  facts?: Array<{ label: string; value: string }>;
  trend?: number[];
  lng?: number;
  lat?: number;
  /** Zone memory — present when this pick is a mutable district. */
  patchId?: string;
  status?: "proposed" | "accepted";
  mutable?: boolean;
};

export type LiveHover = {
  kind: Exclude<MapObjectKind, "country">;
  title: string;
  detail: string;
};

export type HoverInfo = {
  country: CountryRecord | undefined;
  place?: Place;
  live?: LiveHover;
  atlasName: string;
  x: number;
  y: number;
};

export type MapTransform = {
  x: number;
  y: number;
  k: number;
};

export type ViewMode = "atlas" | "godsEye" | "walk";

export type GlobeRotation = {
  lambda: number;
  phi: number;
};

export const HOME_ROTATION: GlobeRotation = { lambda: 88, phi: -22 };
