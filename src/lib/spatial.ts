/** Client-side spatial helpers. The HUD queries MapLibre tiles in the
 *  browser; PostGIS remains the future AirSync system of record (see
 *  docs/spatial-stack.md). */

export function haversineMeters(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Destination from a MapLibre bearing (degrees clockwise from north). */
export function destination(
  lng: number,
  lat: number,
  bearingDeg: number,
  meters: number,
): { lng: number; lat: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (Math.cos(rad) * meters) / 111320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = cosLat === 0 ? 0 : (Math.sin(rad) * meters) / (111320 * cosLat);
  return { lng: lng + dLng, lat: lat + dLat };
}

export function wrapBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
