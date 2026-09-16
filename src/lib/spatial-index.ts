import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

/** Client analogue of a PostGIS GiST pass:
 *  1. bbox overlap (`&&`) — cheap reject from vertex extents
 *  2. exact predicate (`ST_Contains`) — even-odd point in polygon
 *
 *  Globe `queryRenderedFeatures` on country fills is wrong at city zoom
 *  (the video bug: a tap in Albuquerque selected Luxembourg). d3-geo's
 *  spherical `geoContains` also inverts small lat-band rectangles, so
 *  this index stays on the GeoJSON vertex plane the tiles already use. */

export type CountryHit = {
  id: string;
  name: string;
  feature: Feature<Geometry>;
};

function ringBbox(ring: Position[]): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const pos of ring) {
    const lng = pos[0];
    const lat = pos[1];
    if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  if (!Number.isFinite(west)) return null;
  return [
    [west, south],
    [east, north],
  ];
}

function geometryBbox(geom: Geometry): [[number, number], [number, number]] | null {
  if (geom.type === "Polygon") {
    return ringBbox(geom.coordinates[0] ?? []);
  }
  if (geom.type === "MultiPolygon") {
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const poly of geom.coordinates) {
      const box = ringBbox(poly[0] ?? []);
      if (!box) continue;
      if (box[0][0] < west) west = box[0][0];
      if (box[0][1] < south) south = box[0][1];
      if (box[1][0] > east) east = box[1][0];
      if (box[1][1] > north) north = box[1][1];
    }
    if (!Number.isFinite(west)) return null;
    return [
      [west, south],
      [east, north],
    ];
  }
  return null;
}

export function featureBbox(
  feature: Feature<Geometry>,
): [[number, number], [number, number]] | null {
  if (!feature.geometry) return null;
  return geometryBbox(feature.geometry);
}

export function pointInBbox(
  lng: number,
  lat: number,
  bbox: [[number, number], [number, number]],
): boolean {
  const [[west, south], [east, north]] = bbox;
  if (east - west > 180) {
    // dateline-straddling extent: accept either side
    return lat >= south && lat <= north;
  }
  if (west <= east) return lng >= west && lng <= east && lat >= south && lat <= north;
  return (lng >= west || lng <= east) && lat >= south && lat <= north;
}

function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (xi == null || yi == null || xj == null || yj == null) continue;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, rings: Position[][]): boolean {
  const outer = rings[0];
  if (!outer || !pointInRing(lng, lat, outer)) return false;
  for (let i = 1; i < rings.length; i++) {
    const hole = rings[i];
    if (hole && pointInRing(lng, lat, hole)) return false;
  }
  return true;
}

export function countryContainsLngLat(
  feature: Feature<Geometry> | undefined,
  lng: number,
  lat: number,
): boolean {
  if (!feature?.geometry) return false;
  const geom = feature.geometry;
  const bbox = geometryBbox(geom);
  if (!bbox || !pointInBbox(lng, lat, bbox)) return false;
  if (geom.type === "Polygon") return pointInPolygon(lng, lat, geom.coordinates);
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.some((rings) => pointInPolygon(lng, lat, rings));
  }
  return false;
}

export function countryAtLngLat(
  fc: FeatureCollection<Geometry> | null | undefined,
  lng: number,
  lat: number,
): CountryHit | null {
  if (!fc || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  let best: CountryHit | null = null;
  let bestArea = Infinity;
  for (const feature of fc.features) {
    if (!countryContainsLngLat(feature, lng, lat)) continue;
    const bbox = featureBbox(feature);
    const area = bbox
      ? Math.abs(bbox[1][0] - bbox[0][0]) * Math.abs(bbox[1][1] - bbox[0][1])
      : Infinity;
    const id = String(feature.id ?? (feature.properties as { iso?: string } | null)?.iso ?? "");
    const name = String((feature.properties as { name?: string } | null)?.name ?? id);
    if (!id) continue;
    if (area < bestArea) {
      bestArea = area;
      best = { id, name, feature };
    }
  }
  return best;
}
