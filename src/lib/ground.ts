import type { FeatureCollection } from "geojson";
import { assetsFromPlants } from "./proc-assets.ts";

/** NDVI — Normalized Difference Vegetation Index.
 *  (NIR − red) / (NIR + red). Live canopy reflects near-infrared strongly,
 *  so dense plants read high (green on the GIBS ramp); pavement, water, and
 *  bare rock read low. NASA MODIS Terra 8-day is a composite, not a snapshot
 *  of this minute — it is still the worldwide greenness metric we can drape. */
export const NDVI_EXPLAIN = {
  title: "NDVI greenness",
  detail:
    "NASA MODIS 8-day Normalized Difference Vegetation Index. Live plants bounce near-infrared; pavement and rock do not. Bright green is dense canopy, dark is bare or wet. Structural GIS, not a tint.",
  source: "NASA GIBS MODIS Terra NDVI 8-day",
};

export const USGS_ELEV_NOTE =
  "Height is worldwide: Open-Meteo DEM everywhere, USGS 3DEP EPQS where it answers (CONUS). Walk drapes Mapzen/Nextzen terrarium so hills exist on every continent.";

export const GEDI_EXPLAIN = {
  title: "GEDI canopy height",
  detail:
    "NASA ISS GEDI L3 mean RH100 — spaceborne lidar, global land. RH100 is the height where the full laser return has come back. ICESat-2 tracks also cross this look-at. Airborne USGS 3DEP point clouds exist only where a workunit intersects; we inventory those, we do not stream billions of LAS points.",
  source: "NASA GEDI L3 · ICESat-2 · USGS 3DEP LPC (US)",
};

export type ElevPick = { meters: number; source: string };

/** Best available height. 3DEP is the US meter-class answer; Open-Meteo covers every lon/lat including poles and ocean. A USGS 0 next to a real Open-Meteo height is a no-data leak, not sea level. */
export function pickElevation(usgs: number | null | undefined, openMeteo: number | null | undefined): ElevPick | null {
  const a = Number(usgs);
  const b = Number(openMeteo);
  const usgsOk = Number.isFinite(a) && !(a === 0 && Number.isFinite(b) && Math.abs(b) > 2);
  if (usgsOk) return { meters: a, source: "USGS 3DEP EPQS" };
  if (Number.isFinite(b)) return { meters: b, source: "Open-Meteo DEM" };
  return null;
}

export function inUsgsCoverage(lat: number, lng: number): boolean {
  if (lat > 24 && lat < 50 && lng > -125 && lng < -66) return true;
  if (lat > 51 && lat < 72 && lng > -170 && lng < -129) return true;
  if (lat > 18 && lat < 23 && lng > -161 && lng < -154) return true;
  if (lat > 17 && lat < 19 && lng > -68 && lng < -65) return true;
  return false;
}

export function lidarCoverageLine(args: {
  workunit?: string | null;
  ql?: string | null;
  gsd?: number | null;
  points?: number | null;
  year?: number | null;
  ept?: boolean;
  icesat?: number[] | null;
}): string {
  const bits: string[] = [];
  if (args.icesat && args.icesat.length) bits.push(`ICESat-2 tracks ${args.icesat.slice(0, 4).join(", ")}`);
  if (args.workunit) {
    bits.push(args.workunit);
    if (args.ql && args.ql !== "Other") bits.push(args.ql);
    if (args.gsd != null) bits.push(`${args.gsd < 1 ? args.gsd.toFixed(2) : Math.round(args.gsd)} m`);
    if (args.year) bits.push(String(args.year));
    if (args.points != null) bits.push(`${(args.points / 1e9).toFixed(1)}B pts`);
    if (args.ept) bits.push("EPT");
  }
  return bits.join(" · ") || "Spaceborne lidar (GEDI) · no airborne workunit here";
}

export function stemsFromPlants(fc: FeatureCollection): FeatureCollection {
  return assetsFromPlants(fc);
}

export function terrainExaggeration(walking: boolean): number {
  return walking ? 1.55 : 1.12;
}
