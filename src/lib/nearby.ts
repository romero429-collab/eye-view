/** Things happening around a tap, not the object under the finger. */

export type NearbySource = {
  lng: number;
  lat: number;
  layer: string;
  title: string;
  detail: string;
};

export type NearbyHit = {
  layer: string;
  title: string;
  detail: string;
  km: number;
};

export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function hitsFromCollection(data: unknown, layer: string): NearbySource[] {
  const features = (data as { features?: Array<{ geometry?: { type?: string; coordinates?: number[] }; properties?: Record<string, unknown> }> } | null)
    ?.features;
  if (!features) return [];
  const out: NearbySource[] = [];
  for (const feature of features) {
    if (feature.geometry?.type !== "Point" || !feature.geometry.coordinates) continue;
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const props = feature.properties ?? {};
    const mag = props.mag != null && Number.isFinite(Number(props.mag)) ? `M ${Number(props.mag).toFixed(1)}` : "";
    const title = String(props.title || mag || props.place || layer);
    const detail = String(props.detail || props.place || props.headline || "");
    out.push({ lng, lat, layer, title, detail: detail === title ? "" : detail });
  }
  return out;
}

export function nearbyHits(
  sources: NearbySource[],
  lng: number,
  lat: number,
  withinKm: number,
  limit: number,
): NearbyHit[] {
  return sources
    .map((source) => ({
      layer: source.layer,
      title: source.title,
      detail: source.detail,
      km: haversineKm(lng, lat, source.lng, source.lat),
    }))
    .filter((hit) => hit.km <= withinKm && hit.km > 0.05)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
