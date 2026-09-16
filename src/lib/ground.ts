import type { Feature, FeatureCollection } from "geojson";
import { stemPolygon } from "./spatial.ts";

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
  "USGS 3DEP (US) gives the look-at height to the meter. Worldwide hills use Mapzen/Nextzen terrarium DEM so walk mode follows the ground up and down.";

export function stemsFromPlants(fc: FeatureCollection): FeatureCollection {
  const features: Feature[] = [];
  for (const feat of fc.features) {
    if (feat.geometry?.type !== "Point") continue;
    const [lng, lat] = feat.geometry.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const title = String(feat.properties?.title ?? "Tree");
    const klass = String(feat.properties?.class ?? feat.properties?.kind ?? "");
    const text = `${title} ${klass}`.toLowerCase();
    if (/grass|crop|wetland|water|farmland|meadow/.test(text) && !/tree|wood|forest|oak|pine|elm|cedar|ash|maple/.test(text)) {
      continue;
    }
    const height = /wood|forest|pine|oak|elm|cedar/.test(text) ? 16 : /orchard|vineyard/.test(text) ? 7 : 11;
    features.push(
      stemPolygon(lng, lat, height >= 14 ? 4.2 : 3.2, {
        ...((feat.properties ?? {}) as Record<string, string | number | boolean | null>),
        kind: "plant",
        title,
        height,
      }),
    );
    if (features.length >= 180) break;
  }
  return { type: "FeatureCollection", features };
}

export function terrainExaggeration(walking: boolean): number {
  return walking ? 1.55 : 1.12;
}
