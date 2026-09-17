import GtfsMod from "gtfs-realtime-bindings";

const GtfsRealtimeBindings = (GtfsMod as { default?: typeof GtfsMod }).default ?? GtfsMod;
import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  WILDLIFE_TAXA,
  lidarSummary,
  occurrenceFacts,
  occurrenceTitle,
  photoUrl,
  pickVernacular,
  type GbifOccurrence,
  type GbifVernacular,
} from "./gbif.ts";

export type LiveKind =
  | "transit"
  | "flights"
  | "alerts"
  | "events"
  | "wildlife"
  | "livestock"
  | "plants"
  | "health"
  | "osm"
  | "plots"
  | "zoning"
  | "lookup"
  | "geocode"
  | "iot"
  | "ground"
  | "bugs";

export type LiveQuery = {
  kind: LiveKind;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  zoom?: number;
  lat?: number;
  lng?: number;
  name?: string;
};

const GTFS_FEEDS: Array<{ id: string; label: string; url: string }> = [
  {
    id: "mbta",
    label: "MBTA",
    url: "https://cdn.mbta.com/realtime/VehiclePositions.pb",
  },
  {
    id: "ovapi",
    label: "Netherlands",
    url: "https://gtfs.ovapi.nl/nl/vehiclePositions.pb",
  },
  {
    id: "hsl",
    label: "HSL",
    url: "https://realtime.hsl.fi/realtime/vehicle-positions/v2/gtfsrt",
  },
  {
    id: "entur",
    label: "Entur",
    url: "https://api.entur.io/realtime/v1/gtfs-rt/vehicle-positions",
  },
  {
    id: "marta",
    label: "MARTA",
    url: "https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb",
  },
];

const FLIGHT_HUBS: Array<[number, number]> = [
  [40.64, -73.78],
  [33.94, -118.41],
  [41.98, -87.9],
  [51.47, -0.45],
  [52.31, 4.77],
  [35.55, 139.78],
  [1.36, 103.99],
  [-33.95, 151.18],
];

function empty(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function point(
  lon: number,
  lat: number,
  properties: Record<string, string | number | null>,
): Feature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties,
  };
}

async function fetchBuffer(url: string, ms = 6000): Promise<Uint8Array | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/x-protobuf,application/octet-stream,*/*" },
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, ms = 8000, headers?: HeadersInit): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "KiyoshisEyeView/1.0 (live map overlays)",
        ...headers,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function inBbox(
  lon: number,
  lat: number,
  q: LiveQuery,
): boolean {
  if (
    q.west == null ||
    q.south == null ||
    q.east == null ||
    q.north == null
  ) {
    return true;
  }
  return lon >= q.west && lon <= q.east && lat >= q.south && lat <= q.north;
}

function decodeGtfs(buffer: Uint8Array, agency: string): Feature[] {
  const decoded = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
  const features: Feature[] = [];
  for (const entity of decoded.entity) {
    const vehicle = entity.vehicle;
    const pos = vehicle?.position;
    if (!pos || pos.latitude == null || pos.longitude == null) continue;
    const lat = pos.latitude;
    const lon = pos.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const trip = vehicle.trip?.routeId || vehicle.trip?.tripId || entity.id || "";
    const label = vehicle.vehicle?.label || vehicle.vehicle?.id || String(trip);
    features.push(
      point(lon, lat, {
        kind: "transit",
        agency,
        title: String(label),
        detail: [agency, trip && `route ${trip}`, pos.speed != null ? `${Math.round(pos.speed * 3.6)} km/h` : null]
          .filter(Boolean)
          .join(" · "),
        bearing: pos.bearing ?? 0,
      }),
    );
  }
  return features;
}

async function transitFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const batches = await Promise.all(
    GTFS_FEEDS.map(async (feed) => {
      const buf = await fetchBuffer(feed.url);
      if (!buf) return [] as Feature[];
      try {
        return decodeGtfs(buf, feed.label);
      } catch {
        return [];
      }
    }),
  );
  let features = batches.flat();
  const zoom = q.zoom ?? 2;
  if (zoom >= 5) {
    features = features.filter((f) => {
      const [lon, lat] = (f.geometry as Extract<Geometry, { type: "Point" }>).coordinates;
      return inBbox(lon, lat, q);
    });
  } else if (features.length > 2500) {
    features = features.filter((_, i) => i % 3 === 0);
  }
  return { type: "FeatureCollection", features };
}

function haversineNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dlat = toRad(lat2 - lat1);
  const dlon = toRad(lon2 - lon1);
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlon / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  return km * 0.539957;
}

async function flightsFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const zoom = q.zoom ?? 2;
  let points: Array<[number, number, number]> = [];
  if (
    zoom >= 5 &&
    q.west != null &&
    q.south != null &&
    q.east != null &&
    q.north != null
  ) {
    const lat = (q.south + q.north) / 2;
    const lon = (q.west + q.east) / 2;
    const dist = Math.min(
      250,
      Math.max(40, haversineNm(q.south, q.west, q.north, q.east)),
    );
    points = [[lat, lon, dist]];
  } else {
    points = FLIGHT_HUBS.map(([lat, lon]) => [lat, lon, 80]);
  }

  const chunks = await Promise.all(
    points.map(async ([lat, lon, dist]) => {
      const data = (await fetchJson(
        `https://opendata.adsb.fi/api/v2/lat/${lat.toFixed(3)}/lon/${lon.toFixed(3)}/dist/${Math.round(dist)}`,
      )) as { ac?: Array<Record<string, unknown>>; aircraft?: Array<Record<string, unknown>> } | null;
      return data?.aircraft ?? data?.ac ?? [];
    }),
  );

  const seen = new Set<string>();
  const features: Feature[] = [];
  for (const ac of chunks.flat()) {
    const lat = Number(ac.lat);
    const lon = Number(ac.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const hex = String(ac.hex ?? `${lat},${lon}`);
    if (seen.has(hex)) continue;
    seen.add(hex);
    const flight = String(ac.flight ?? ac.r ?? hex).trim() || hex;
    const alt = ac.alt_baro;
    const gs = ac.gs;
    features.push(
      point(lon, lat, {
        kind: "flight",
        title: flight,
        detail: [
          alt != null && alt !== "ground" ? `${Math.round(Number(alt))} ft` : "On ground",
          gs != null ? `${Math.round(Number(gs))} kt` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        bearing: Number(ac.track ?? 0),
      }),
    );
  }
  return { type: "FeatureCollection", features };
}

function geomCentroid(geom: Geometry | null | undefined): [number, number] | null {
  if (!geom) return null;
  if (geom.type === "Point") {
    const [lon, lat] = geom.coordinates;
    return [lon, lat];
  }
  let ring: number[][] | undefined;
  if (geom.type === "Polygon") ring = geom.coordinates[0];
  else if (geom.type === "MultiPolygon") ring = geom.coordinates[0]?.[0];
  else if (geom.type === "LineString") ring = geom.coordinates;
  if (!ring || ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const pt of ring) {
    const x = pt[0];
    const y = pt[1];
    if (x == null || y == null) continue;
    sx += x;
    sy += y;
    n += 1;
  }
  if (!n) return null;
  return [sx / n, sy / n];
}

async function alertsFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const data = (await fetchJson(
    "https://api.weather.gov/alerts/active?status=actual&message_type=alert",
    10000,
    { "User-Agent": "KiyoshisEyeView/1.0 (live map overlays)" },
  )) as FeatureCollection | null;
  if (!data?.features) return empty();
  const features: Feature[] = [];
  for (const feat of data.features) {
    const c = geomCentroid(feat.geometry);
    if (!c) continue;
    const [lon, lat] = c;
    if (q.zoom && q.zoom >= 4 && !inBbox(lon, lat, q)) continue;
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    features.push(
      point(lon, lat, {
        kind: "alert",
        title: String(props.event ?? props.headline ?? "Alert"),
        detail: String(props.headline ?? props.areaDesc ?? "NWS"),
      }),
    );
  }
  return { type: "FeatureCollection", features };
}

async function eventsFeatures(): Promise<FeatureCollection> {
  const data = (await fetchJson(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60",
  )) as {
    events?: Array<{
      title: string;
      categories?: Array<{ title: string }>;
      geometry?: Array<{ coordinates?: number[] }>;
    }>;
  } | null;
  const features: Feature[] = [];
  for (const ev of data?.events ?? []) {
    const coords = ev.geometry?.[0]?.coordinates;
    if (!coords || coords.length < 2) continue;
    const lon = coords[0]!;
    const lat = coords[1]!;
    features.push(
      point(lon, lat, {
        kind: "event",
        title: ev.title,
        detail: ev.categories?.[0]?.title ?? "NASA EONET",
      }),
    );
  }
  return { type: "FeatureCollection", features };
}

type GbifResult = {
  results?: GbifOccurrence[];
};

const vernacularCache = new Map<number, string | null>();

async function vernacularForKeys(keys: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const unique = [...new Set(keys.filter((k) => Number.isFinite(k)))].slice(0, 8);
  await Promise.all(
    unique.map(async (key) => {
      if (vernacularCache.has(key)) {
        const hit = vernacularCache.get(key);
        if (hit) out.set(key, hit);
        return;
      }
      const data = (await fetchJson(
        `https://api.gbif.org/v1/species/${key}/vernacularNames?limit=40`,
        5000,
      )) as { results?: GbifVernacular[] } | null;
      const name = pickVernacular(data?.results ?? []);
      vernacularCache.set(key, name);
      if (name) out.set(key, name);
    }),
  );
  return out;
}

async function gbifOccurrences(
  taxonKey: number,
  q: LiveQuery,
  limit = 60,
  opts?: { kind?: string; fallback?: string },
): Promise<Feature[]> {
  if (q.west == null || q.south == null || q.east == null || q.north == null) return [];
  const span = Math.abs(q.east - q.west) * Math.abs(q.north - q.south);
  if ((q.zoom ?? 0) < 5 && span > 8) return [];
  const params = new URLSearchParams({
    taxonKey: String(taxonKey),
    hasCoordinate: "true",
    hasGeospatialIssue: "false",
    occurrenceStatus: "PRESENT",
    limit: String(limit),
    decimalLatitude: `${q.south},${q.north}`,
    decimalLongitude: `${q.west},${q.east}`,
  });
  const data = (await fetchJson(
    `https://api.gbif.org/v1/occurrence/search?${params.toString()}`,
    8000,
  )) as GbifResult | null;
  const records = data?.results ?? [];
  const names = await vernacularForKeys(records.map((r) => r.speciesKey ?? r.taxonKey ?? 0).filter(Boolean));
  const features: Feature[] = [];
  const kind = opts?.kind ?? "sighting";
  const fallback = opts?.fallback ?? "Animal";
  for (const rec of records) {
    const lat = rec.decimalLatitude;
    const lon = rec.decimalLongitude;
    if (lat == null || lon == null) continue;
    const common = names.get(rec.speciesKey ?? rec.taxonKey ?? 0) ?? null;
    const title = occurrenceTitle(rec, common, fallback);
    const photo = photoUrl(rec);
    features.push(
      point(lon, lat, {
        kind,
        title,
        detail: [common && rec.species, rec.family, rec.class, rec.country, rec.eventDate?.slice(0, 10)]
          .filter(Boolean)
          .join(" · "),
        source: "GBIF occurrence search",
        photo,
        facts: JSON.stringify(occurrenceFacts(rec, common)),
      }),
    );
  }
  return features;
}

async function wildlifeFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const batches = await Promise.all(
    WILDLIFE_TAXA.map((taxon) =>
      gbifOccurrences(taxon.key, q, taxon.key === 212 ? 40 : 25, {
        kind: "sighting",
        fallback: taxon.label,
      }),
    ),
  );
  return { type: "FeatureCollection", features: batches.flat() };
}

const STOCK_TAXA: Array<{ key: number; label: string }> = [
  { key: 2441022, label: "cattle" },
  { key: 2441110, label: "sheep" },
  { key: 2440886, label: "horse" },
  { key: 7705930, label: "pig" },
  { key: 2441056, label: "goat" },
];

async function livestockFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const batches = await Promise.all(
    STOCK_TAXA.map(async (taxon) => {
      const feats = await gbifOccurrences(taxon.key, q, 20);
      return feats.map((feat) => ({
        ...feat,
        properties: { ...feat.properties, stock: taxon.label },
      }));
    }),
  );
  return { type: "FeatureCollection", features: batches.flat() };
}

async function plantFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const [vascular, grasses, inat, osm] = await Promise.all([
    gbifOccurrences(7707728, q, 40, { kind: "plant", fallback: "Plant" }),
    gbifOccurrences(3073, q, 20, { kind: "plant", fallback: "Grass" }),
    inaturalistPlants(q),
    osmPlantFeatures(q),
  ]);
  const seen = new Set<string>();
  const features: Feature[] = [];
  for (const feat of [...vascular, ...grasses, ...inat, ...osm]) {
    const geom = feat.geometry;
    if (!geom || geom.type !== "Point") continue;
    const [lon, lat] = geom.coordinates;
    const key = `${feat.properties?.title}|${lon.toFixed(4)}|${lat.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    features.push(feat);
  }
  return { type: "FeatureCollection", features };
}

type InatResult = {
  results?: Array<{
    species_guess?: string;
    taxon?: { name?: string; preferred_common_name?: string };
    location?: string;
    observed_on?: string;
    place_guess?: string;
    uri?: string;
  }>;
};

async function inaturalistPlants(q: LiveQuery): Promise<Feature[]> {
  const lat = q.lat ?? (q.south != null && q.north != null ? (q.south + q.north) / 2 : null);
  const lng = q.lng ?? (q.west != null && q.east != null ? (q.west + q.east) / 2 : null);
  if (lat == null || lng == null || (q.zoom ?? 0) < 6) return [];
  const span = q.west != null && q.east != null ? Math.abs(q.east - q.west) : 0.2;
  const radius = Math.min(40, Math.max(2, span * 55));
  const data = (await fetchJson(
    `https://api.inaturalist.org/v1/observations?iconic_taxa=Plantae&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&radius=${radius.toFixed(1)}&per_page=40&order=desc&order_by=observed_on`,
    8000,
  )) as InatResult | null;
  const features: Feature[] = [];
  for (const rec of data?.results ?? []) {
    const loc = rec.location?.split(",") ?? [];
    const rlat = Number(loc[0]);
    const rlon = Number(loc[1]);
    if (!Number.isFinite(rlat) || !Number.isFinite(rlon)) continue;
    const title =
      rec.taxon?.preferred_common_name || rec.species_guess || rec.taxon?.name || "Plant";
    features.push(
      point(rlon, rlat, {
        kind: "plant",
        title,
        detail: [rec.taxon?.name, rec.place_guess, rec.observed_on].filter(Boolean).join(" · "),
        source: "iNaturalist",
        facts: JSON.stringify(
          [
            rec.taxon?.name ? { label: "Taxon", value: rec.taxon.name } : null,
            rec.observed_on ? { label: "When", value: rec.observed_on } : null,
            { label: "Layer", value: "Plants" },
            { label: "GIS", value: "iNaturalist observation" },
          ].filter(Boolean),
        ),
      }),
    );
  }
  return features;
}

async function osmPlantFeatures(q: LiveQuery): Promise<Feature[]> {
  if (q.west == null || q.south == null || q.east == null || q.north == null) return [];
  if ((q.zoom ?? 0) < 10) return [];
  const span = Math.abs(q.east - q.west) * Math.abs(q.north - q.south);
  if (span > 4) return [];
  const bbox = `${q.south.toFixed(4)},${q.west.toFixed(4)},${q.north.toFixed(4)},${q.east.toFixed(4)}`;
  const local = (q.zoom ?? 0) >= 13;
  const body = `[out:json][timeout:16];(${
    local ? `node["natural"="tree"](${bbox});` : ""
  }way["natural"="wood"](${bbox});way["landuse"~"^(forest|orchard|vineyard|allotments|meadow)$"](${bbox});way["leisure"="garden"](${bbox});way["boundary"="protected_area"](${bbox});relation["boundary"="protected_area"](${bbox}););out center 160;`;
  const elements = await overpassQuery(body);
  const features: Feature[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.geometry?.[0]?.lat;
    const lon = el.lon ?? el.geometry?.[0]?.lon;
    if (lat == null || lon == null) continue;
    const klass = tags.natural || tags.landuse || tags.leisure || tags.boundary || "vegetation";
    const title = tags.name || klass.replace(/_/g, " ");
    features.push(
      point(lon, lat, {
        kind: "plant",
        title,
        detail: [klass, tags.protection_title, tags.leaf_type].filter(Boolean).join(" · "),
        source: "OpenStreetMap Overpass",
        facts: JSON.stringify(
          [
            { label: "Layer", value: "Plants" },
            { label: "GIS", value: "OSM vegetation" },
            { label: "class", value: klass },
            tags.genus ? { label: "Genus", value: tags.genus } : null,
            tags.species ? { label: "Species", value: tags.species } : null,
          ].filter(Boolean),
        ),
      }),
    );
  }
  return features;
}

type MetarRow = {
  lat?: number;
  lon?: number;
  icaoId?: string;
  name?: string;
  temp?: number;
  wspd?: number;
  precip?: number;
  pcpn?: number;
  rawOb?: string;
  wxString?: string;
};

type OpenMeteoCurrent = {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    soil_moisture_0_to_1cm?: number;
  };
  elevation?: number;
};

type UsgsElev = { value?: string | number };
type AqiCurrent = { current?: { us_aqi?: number; pm2_5?: number } };

async function iotFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const lat = q.lat ?? (q.south != null && q.north != null ? (q.south + q.north) / 2 : null);
  const lng = q.lng ?? (q.west != null && q.east != null ? (q.west + q.east) / 2 : null);
  if (lat == null || lng == null) return empty();
  const west = q.west ?? lng - 0.6;
  const south = q.south ?? lat - 0.4;
  const east = q.east ?? lng + 0.6;
  const north = q.north ?? lat + 0.4;
  const [metar, om, elev, aqi] = await Promise.all([
    fetchJson(
      `https://aviationweather.gov/api/data/metar?format=json&bbox=${south},${west},${north},${east}`,
      8000,
    ),
    fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`,
      8000,
    ),
    fetchJson(
      `https://epqs.nationalmap.gov/v1/json?x=${lng.toFixed(5)}&y=${lat.toFixed(5)}&wkid=4326&units=Meters`,
      6000,
    ),
    fetchJson(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=us_aqi,pm2_5`,
      6000,
    ),
  ]);
  const features: Feature[] = [];
  const rows = Array.isArray(metar) ? (metar as MetarRow[]) : [];
  for (const row of rows.slice(0, 40)) {
    if (row.lat == null || row.lon == null) continue;
    const wx = `${row.wxString ?? ""} ${row.rawOb ?? ""}`;
    const raining = /\b(RA|TS|SHRA|DZ)\b/.test(wx);
    const precipRaw = Number(row.precip ?? row.pcpn ?? 0);
    const precip = raining ? Math.max(precipRaw, 0.5) : Number.isFinite(precipRaw) ? precipRaw : 0;
    const temp = Number(row.temp);
    const wind = Number(row.wspd);
    const title = row.icaoId || row.name || "METAR";
    features.push(
      point(row.lon, row.lat, {
        kind: "sensor",
        title,
        detail: [row.name, row.wxString, row.rawOb?.slice(0, 48)].filter(Boolean).join(" · "),
        source: "AviationWeather METAR",
        precip: Number.isFinite(precip) ? precip : 0,
        temp: Number.isFinite(temp) ? temp : null,
        wind: Number.isFinite(wind) ? wind : null,
        facts: JSON.stringify(
          [
            Number.isFinite(temp) ? { label: "Temp °C", value: `${temp.toFixed(1)}` } : null,
            Number.isFinite(wind) ? { label: "Wind kt", value: String(Math.round(wind)) } : null,
            { label: "Kind", value: "Weather station" },
          ].filter(Boolean),
        ),
      }),
    );
  }
  const stationWet = features.some((f) => Number(f.properties?.precip ?? 0) >= 0.2);
  const cur = (om as OpenMeteoCurrent | null)?.current ?? {};
  const omElev = Number((om as OpenMeteoCurrent | null)?.elevation);
  const usgsElev = Number((elev as UsgsElev | null)?.value);
  const elevM = Number.isFinite(usgsElev) ? usgsElev : Number.isFinite(omElev) ? omElev : null;
  const aqiVal = Number((aqi as AqiCurrent | null)?.current?.us_aqi);
  const pm25 = Number((aqi as AqiCurrent | null)?.current?.pm2_5);
  const nodePrecip = stationWet ? Math.max(Number(cur.precipitation ?? 0), 0.5) : (cur.precipitation ?? 0);
  features.push(
    point(lng, lat, {
      kind: "sensor",
      title: "Look-at climate node",
      detail: stationWet
        ? "Nearby station reports precipitation. IOM treats this district as wet."
        : "Open-Meteo, USGS elevation, and air quality at the crosshair — IOM's local nerve.",
      source: "Open-Meteo · USGS 3DEP · Open-Meteo Air Quality",
      precip: nodePrecip,
      temp: cur.temperature_2m ?? null,
      wind: cur.wind_speed_10m ?? null,
      elev: elevM,
      aqi: Number.isFinite(aqiVal) ? aqiVal : null,
      facts: JSON.stringify(
        [
          cur.temperature_2m != null ? { label: "Temp °C", value: String(cur.temperature_2m) } : null,
          cur.precipitation != null ? { label: "Precip mm", value: String(cur.precipitation) } : null,
          cur.wind_speed_10m != null ? { label: "Wind km/h", value: String(cur.wind_speed_10m) } : null,
          elevM != null ? { label: "Elev m", value: String(Math.round(elevM)) } : null,
          Number.isFinite(aqiVal) ? { label: "US AQI", value: String(Math.round(aqiVal)) } : null,
          Number.isFinite(pm25) ? { label: "PM2.5", value: `${pm25.toFixed(1)} µg/m³` } : null,
          { label: "Kind", value: "Climate node" },
        ].filter(Boolean),
      ),
    }),
  );
  return { type: "FeatureCollection", features };
}

let healthCache: { at: number; data: FeatureCollection } | null = null;

async function healthFeatures(): Promise<FeatureCollection> {
  if (healthCache && Date.now() - healthCache.at < 5 * 60_000) return healthCache.data;
  const [snap, hist] = await Promise.all([
    fetchJson("https://disease.sh/v3/covid-19/countries?allowNull=true", 10000),
    fetchJson("https://disease.sh/v3/covid-19/historical?lastdays=14", 12000),
  ]);
  const histMap = new Map<string, number[]>();
  const histRows = Array.isArray(hist)
    ? (hist as Array<{ country?: string; timeline?: { cases?: Record<string, number> } }>)
    : [];
  for (const row of histRows) {
    const cases = row.timeline?.cases ?? {};
    const values = Object.keys(cases)
      .sort()
      .map((k) => Number(cases[k]))
      .filter(Number.isFinite);
    if (row.country && values.length) histMap.set(row.country, values);
  }
  const rows = Array.isArray(snap)
    ? (snap as Array<{
        country?: string;
        cases?: number;
        todayCases?: number;
        deaths?: number;
        todayDeaths?: number;
        active?: number;
        recovered?: number;
        critical?: number;
        casesPerOneMillion?: number;
        deathsPerOneMillion?: number;
        population?: number;
        countryInfo?: { lat?: number; long?: number; iso3?: string };
      }>)
    : [];
  const features: Feature[] = [];
  for (const row of rows) {
    const lat = row.countryInfo?.lat;
    const lon = row.countryInfo?.long;
    if (lat == null || lon == null) continue;
    const cases = row.cases ?? 0;
    const name = String(row.country ?? "Unknown");
    const trend = histMap.get(name);
    const first = trend?.[0];
    const last = trend?.[trend.length - 1];
    const delta =
      first != null && last != null ? last - first : (row.todayCases ?? 0);
    features.push(
      point(lon, lat, {
        kind: "health",
        title: name,
        detail: `${cases.toLocaleString()} cumulative cases`,
        source: "disease.sh · COVID-19 country series",
        mag: Math.max(3, Math.min(16, Math.log10(Math.max(cases, 1)) * 2.2)),
        trend: trend ? JSON.stringify(trend) : "",
        facts: JSON.stringify([
          { label: "Cases", value: cases.toLocaleString() },
          { label: "Today", value: (row.todayCases ?? 0).toLocaleString() },
          {
            label: "14-day",
            value: `${delta >= 0 ? "+" : ""}${delta.toLocaleString()}`,
          },
          { label: "Active", value: (row.active ?? 0).toLocaleString() },
          { label: "Critical", value: (row.critical ?? 0).toLocaleString() },
          { label: "Deaths", value: (row.deaths ?? 0).toLocaleString() },
          {
            label: "Per million",
            value: Math.round(row.casesPerOneMillion ?? 0).toLocaleString(),
          },
          {
            label: "Population",
            value: Math.round(row.population ?? 0).toLocaleString(),
          },
        ]),
      }),
    );
  }
  const data: FeatureCollection = { type: "FeatureCollection", features };
  healthCache = { at: Date.now(), data };
  return data;
}

type OverpassEl = {
  type: string;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

function osmKind(tags: Record<string, string>): "rail" | "fence" | "farm" {
  if (tags.railway) return "rail";
  if (tags.barrier === "fence" || tags.barrier === "hedge") return "fence";
  return "farm";
}

const OVERPASS_URLS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function overpassQuery(ql: string): Promise<OverpassEl[]> {
  const body = `data=${encodeURIComponent(ql)}`;
  for (const url of OVERPASS_URLS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14000);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "KiyoshisEyeView/1.0 (live map overlays)",
        },
        body,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassEl[] };
      return json.elements ?? [];
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

function osmFeatureFromElement(el: OverpassEl): Feature | null {
  const tags = el.tags ?? {};
  const kind = osmKind(tags);
  const title =
    tags.name ||
    tags.railway ||
    tags.landuse ||
    tags.barrier ||
    tags.highway ||
    tags.animal_keeping ||
    "OSM feature";
  const detail = Object.entries(tags)
    .filter(([k]) =>
      [
        "railway",
        "landuse",
        "barrier",
        "highway",
        "operator",
        "animal_keeping",
        "animal",
        "livestock",
      ].includes(k),
    )
    .map(([k, v]) => `${k}=${v}`)
    .join(" · ");
  const facts = JSON.stringify(
    Object.entries(tags)
      .slice(0, 8)
      .map(([label, value]) => ({ label, value })),
  );
  const props = {
    kind,
    title,
    detail: detail || "OpenStreetMap",
    source: "OpenStreetMap Overpass",
    facts,
  };
  if (el.type === "node" && el.lat != null && el.lon != null) {
    return point(el.lon, el.lat, props);
  }
  const geom = el.geometry;
  if (!geom || geom.length < 2) return null;
  const coords = geom.map((pt) => [pt.lon, pt.lat] as [number, number]);
  const closed =
    kind === "farm" &&
    coords.length >= 4 &&
    coords[0]![0] === coords[coords.length - 1]![0] &&
    coords[0]![1] === coords[coords.length - 1]![1];
  return {
    type: "Feature",
    geometry: closed
      ? { type: "Polygon", coordinates: [coords] }
      : { type: "LineString", coordinates: coords },
    properties: props,
  };
}

async function overpassFeatures(q: LiveQuery): Promise<Feature[]> {
  const zoom = q.zoom ?? 0;
  if (
    q.west == null ||
    q.south == null ||
    q.east == null ||
    q.north == null ||
    zoom < 9
  ) {
    return [];
  }
  const span = Math.abs(q.east - q.west) * Math.abs(q.north - q.south);
  if (span > 12) return [];
  const s = q.south.toFixed(4);
  const w = q.west.toFixed(4);
  const n = q.north.toFixed(4);
  const e = q.east.toFixed(4);
  const bbox = `${s},${w},${n},${e}`;
  const local = zoom >= 12;
  const body = `[out:json][timeout:16];(${
    local
      ? `way["railway"~"^(rail|light_rail|subway|tram)$"](${bbox});node["railway"~"^(station|halt)$"](${bbox});way["barrier"~"^(fence|hedge)$"](${bbox});way["landuse"~"^(meadow|farmyard|animal_keeping)$"](${bbox});way["highway"="bridleway"](${bbox});way["animal_keeping"](${bbox});`
      : `way["railway"~"^(rail|light_rail|subway|tram)$"](${bbox});node["railway"~"^(station|halt)$"](${bbox});`
  });out geom 500;`;
  const elements = await overpassQuery(body);
  const features: Feature[] = [];
  for (const el of elements) {
    const feat = osmFeatureFromElement(el);
    if (feat) features.push(feat);
  }
  return features;
}

let trainCache: { at: number; features: Feature[] } | null = null;

async function trainFeatures(): Promise<Feature[]> {
  if (trainCache && Date.now() - trainCache.at < 30_000) return trainCache.features;
  const features: Feature[] = [];

  const [amtrak, via, finland] = await Promise.all([
    fetchJson("https://api-v3.amtraker.com/v3/trains", 8000),
    fetchJson("https://tsimobile.viarail.ca/data/all.json", 8000),
    fetchJson("https://rata.digitraffic.fi/api/v1/train-locations/latest/", 8000),
  ]);

  const amtrakMap = amtrak && typeof amtrak === "object" ? (amtrak as Record<string, unknown>) : {};
  for (const rows of Object.values(amtrakMap)) {
    const list = Array.isArray(rows) ? rows : [rows];
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const lat = Number(rec.lat);
      const lon = Number(rec.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const num = String(rec.trainNum ?? rec.number ?? "");
      const route = String(rec.routeName ?? rec.route ?? "Amtrak");
      const speed = rec.speed != null ? `${Math.round(Number(rec.speed))} mph` : null;
      const dest = rec.destName ? String(rec.destName) : null;
      features.push(
        point(lon, lat, {
          kind: "rail",
          title: num ? `Amtrak ${num}` : route,
          detail: [route, dest && `to ${dest}`, speed].filter(Boolean).join(" · "),
          source: "Amtraker",
          facts: JSON.stringify(
            [
              { label: "Service", value: "Amtrak" },
              num ? { label: "Train", value: num } : null,
              dest ? { label: "Destination", value: dest } : null,
              speed ? { label: "Speed", value: speed } : null,
            ].filter(Boolean),
          ),
        }),
      );
    }
  }

  const viaRoot = via && typeof via === "object" ? (via as Record<string, unknown>) : {};
  const viaMap =
    viaRoot.trains && typeof viaRoot.trains === "object"
      ? (viaRoot.trains as Record<string, unknown>)
      : viaRoot;
  for (const [id, row] of Object.entries(viaMap)) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const lat = Number(rec.lat);
    const lon = Number(rec.lng ?? rec.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const speed = rec.speed != null ? `${Math.round(Number(rec.speed))} km/h` : null;
    features.push(
      point(lon, lat, {
        kind: "rail",
        title: `VIA ${id}`,
        detail: [speed, rec.direction && String(rec.direction)].filter(Boolean).join(" · ") || "VIA Rail",
        source: "VIA Rail",
        facts: JSON.stringify(
          [
            { label: "Service", value: "VIA Rail" },
            { label: "Train", value: String(id) },
            speed ? { label: "Speed", value: speed } : null,
          ].filter(Boolean),
        ),
      }),
    );
  }

  const fiRows = Array.isArray(finland)
    ? (finland as Array<{
        trainNumber?: number;
        speed?: number;
        location?: { coordinates?: number[] };
      }>)
    : [];
  for (const row of fiRows) {
    const coords = row.location?.coordinates;
    if (!coords || coords.length < 2) continue;
    const lon = coords[0]!;
    const lat = coords[1]!;
    const speed = row.speed != null ? `${Math.round(row.speed)} km/h` : null;
    features.push(
      point(lon, lat, {
        kind: "rail",
        title: `VR ${row.trainNumber ?? ""}`.trim(),
        detail: speed || "Finnish rail",
        source: "Fintraffic / digitraffic",
        facts: JSON.stringify(
          [
            { label: "Service", value: "VR" },
            row.trainNumber != null ? { label: "Train", value: String(row.trainNumber) } : null,
            speed ? { label: "Speed", value: speed } : null,
          ].filter(Boolean),
        ),
      }),
    );
  }

  trainCache = { at: Date.now(), features };
  return features;
}

async function osmFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const [ground, trains] = await Promise.all([overpassFeatures(q), trainFeatures()]);
  return { type: "FeatureCollection", features: [...ground, ...trains] };
}

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  residential?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
};

type NominatimPlace = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  addresstype?: string;
  category?: string;
  extratags?: Record<string, string>;
  address?: NominatimAddress;
};

function locality(addr: NominatimAddress | undefined): string {
  if (!addr) return "";
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.suburb ||
    addr.county ||
    ""
  );
}

function siteLine(addr: NominatimAddress | undefined): string {
  if (!addr) return "";
  const street = addr.road || addr.pedestrian || addr.residential || "";
  if (addr.house_number && street) return `${addr.house_number} ${street}`;
  if (addr.house_number) return addr.house_number;
  return "";
}

function streetLine(addr: NominatimAddress | undefined): string {
  if (!addr) return "";
  return addr.road || addr.pedestrian || addr.residential || "";
}

function plotFromNominatim(place: NominatimPlace): Feature | null {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const addr = place.address;
  const site = siteLine(addr);
  const street = streetLine(addr);
  const city = locality(addr);
  const blank = !addr?.house_number;
  const title =
    site ||
    (blank && street ? `Plot on ${street}` : "") ||
    place.name ||
    (blank ? "Unaddressed plot" : "Plot");
  const detail = blank
    ? ["No site address", street, city || addr?.county, addr?.state].filter(Boolean).join(" · ")
    : [site, city, addr?.postcode].filter(Boolean).join(" · ");
  const status = blank ? "Vacant / no site address" : "Addressed";
  const extras = place.extratags ?? {};
  return point(lon, lat, {
    kind: blank ? "plot" : "address",
    title,
    detail,
    source: "OpenStreetMap Nominatim",
    facts: JSON.stringify(
      [
        { label: "Site address", value: site || "None" },
        street ? { label: "Street", value: street } : null,
        { label: "Status", value: status },
        city ? { label: "Place", value: city } : null,
        addr?.county ? { label: "County", value: addr.county } : null,
        addr?.state ? { label: "State", value: addr.state } : null,
        addr?.postcode ? { label: "Postcode", value: addr.postcode } : null,
        addr?.country ? { label: "Country", value: addr.country } : null,
        place.addresstype ? { label: "Type", value: place.addresstype } : null,
        extras["ref:cadastre"]
          ? { label: "Cadastre", value: extras["ref:cadastre"] }
          : extras.ref
            ? { label: "Ref", value: extras.ref }
            : null,
      ].filter(Boolean),
    ),
  });
}

function plotKind(tags: Record<string, string>, el: OverpassEl): "plot" | "building" | "address" {
  if (tags.building) return "building";
  if (el.type === "node" && tags["addr:housenumber"]) return "address";
  return "plot";
}

function plotFeatureFromElement(el: OverpassEl): Feature | null {
  const tags = el.tags ?? {};
  const kind = plotKind(tags, el);
  const house = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const site = [house, street].filter(Boolean).join(" ");
  const vacant =
    !house &&
    !tags.building &&
    (kind === "plot" ||
      ["brownfield", "construction", "greenfield"].includes(tags.landuse ?? "") ||
      tags.vacant === "yes");
  const title =
    site ||
    tags.name ||
    tags.ref ||
    tags["cadastral:ref"] ||
    tags["ref:cadastre"] ||
    (kind === "building" ? "Building" : vacant ? "Unaddressed plot" : "Plot");
  const detail = vacant
    ? "No site address"
    : site || tags.landuse || tags.boundary || tags.place || "OpenStreetMap";
  const facts = JSON.stringify(
    [
      { label: "Site address", value: site || "None" },
      { label: "Status", value: vacant ? "Vacant / no site address" : tags.building ? "Improved" : "Addressed" },
      tags.ref ? { label: "Ref", value: tags.ref } : null,
      tags["cadastral:ref"] ? { label: "Cadastre", value: tags["cadastral:ref"] } : null,
      tags["ref:cadastre"] ? { label: "Cadastre", value: tags["ref:cadastre"] } : null,
      tags.landuse ? { label: "landuse", value: tags.landuse } : null,
      tags.boundary ? { label: "boundary", value: tags.boundary } : null,
      tags.building ? { label: "building", value: tags.building } : null,
      tags["addr:city"] ? { label: "Place", value: tags["addr:city"] } : null,
      tags["addr:postcode"] ? { label: "Postcode", value: tags["addr:postcode"] } : null,
    ].filter(Boolean),
  );
  const props = {
    kind,
    title,
    detail,
    source: "OpenStreetMap Overpass",
    facts,
  };
  if (el.type === "node" && el.lat != null && el.lon != null) {
    return point(el.lon, el.lat, props);
  }
  const geom = el.geometry;
  if (!geom || geom.length < 2) return null;
  const coords = geom.map((pt) => [pt.lon, pt.lat] as [number, number]);
  const closed =
    coords.length >= 4 &&
    coords[0]![0] === coords[coords.length - 1]![0] &&
    coords[0]![1] === coords[coords.length - 1]![1];
  return {
    type: "Feature",
    geometry: closed
      ? { type: "Polygon", coordinates: [coords] }
      : { type: "LineString", coordinates: coords },
    properties: props,
  };
}

async function plotsFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const zoom = q.zoom ?? 0;
  if (
    q.west == null ||
    q.south == null ||
    q.east == null ||
    q.north == null ||
    zoom < 14
  ) {
    return empty();
  }
  const span = Math.abs(q.east - q.west) * Math.abs(q.north - q.south);
  if (span > 0.35) return empty();
  const s = q.south.toFixed(5);
  const w = q.west.toFixed(5);
  const n = q.north.toFixed(5);
  const e = q.east.toFixed(5);
  const bbox = `${s},${w},${n},${e}`;
  const tight = zoom >= 15.5;
  const body = `[out:json][timeout:16];(${
    tight
      ? `way["boundary"~"^(cadastral|lot)$"](${bbox});relation["boundary"="cadastral"](${bbox});way["place"="plot"](${bbox});way["landuse"~"^(brownfield|construction|greenfield|allotments)$"](${bbox});nwr["addr:housenumber"](${bbox});`
      : `way["boundary"~"^(cadastral|lot)$"](${bbox});relation["boundary"="cadastral"](${bbox});way["place"="plot"](${bbox});way["landuse"~"^(brownfield|construction|greenfield|allotments)$"](${bbox});`
  });out geom 400;`;
  const elements = await overpassQuery(body);
  const features: Feature[] = [];
  for (const el of elements) {
    const feat = plotFeatureFromElement(el);
    if (feat) features.push(feat);
  }
  return { type: "FeatureCollection", features };
}

function zoneFeatureFromElement(el: OverpassEl): Feature | null {
  const tags = el.tags ?? {};
  const code = tags.zoning || tags["zone:type"] || "";
  const landuse = tags.landuse || "";
  const klass = landuse || tags.zoning || tags["zone:type"] || "";
  const title =
    tags.name ||
    (code ? `Zone ${code}` : "") ||
    landuse.replace(/_/g, " ") ||
    "Zoned land";
  const facts = JSON.stringify(
    [
      code ? { label: "Zoning code", value: code } : null,
      tags["zone:type"] && tags["zone:type"] !== code
        ? { label: "zone:type", value: tags["zone:type"] }
        : null,
      landuse ? { label: "landuse", value: landuse } : null,
      tags.name ? { label: "name", value: tags.name } : null,
      tags.operator ? { label: "operator", value: tags.operator } : null,
      tags.source ? { label: "source tag", value: tags.source } : null,
    ].filter(Boolean),
  );
  const props = {
    kind: "zone",
    class: klass,
    title,
    detail: code
      ? `Legal zoning tag · ${code}`
      : landuse
        ? `OSM landuse=${landuse}`
        : "OSM zoning tag",
    source: "OpenStreetMap Overpass",
    facts,
  };
  if (el.type === "node" && el.lat != null && el.lon != null) {
    return point(el.lon, el.lat, props);
  }
  const geom = el.geometry;
  if (!geom || geom.length < 2) return null;
  const coords = geom.map((pt) => [pt.lon, pt.lat] as [number, number]);
  const closed =
    coords.length >= 4 &&
    coords[0]![0] === coords[coords.length - 1]![0] &&
    coords[0]![1] === coords[coords.length - 1]![1];
  return {
    type: "Feature",
    geometry: closed
      ? { type: "Polygon", coordinates: [coords] }
      : { type: "LineString", coordinates: coords },
    properties: props,
  };
}

async function zoningFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const zoom = q.zoom ?? 0;
  if (
    q.west == null ||
    q.south == null ||
    q.east == null ||
    q.north == null ||
    zoom < 11
  ) {
    return empty();
  }
  const span = Math.abs(q.east - q.west) * Math.abs(q.north - q.south);
  if (span > 0.45) return empty();
  const s = q.south.toFixed(5);
  const w = q.west.toFixed(5);
  const n = q.north.toFixed(5);
  const e = q.east.toFixed(5);
  const bbox = `${s},${w},${n},${e}`;
  const body = `[out:json][timeout:16];(
    nwr["zoning"](${bbox});
    nwr["zone:type"](${bbox});
    way["landuse"~"^(residential|commercial|industrial|retail|military|cemetery|garages|recreation_ground|retail)$"](${bbox});
    relation["landuse"~"^(residential|commercial|industrial|retail)$"](${bbox});
  );out geom 400;`;
  const elements = await overpassQuery(body);
  const features: Feature[] = [];
  for (const el of elements) {
    const feat = zoneFeatureFromElement(el);
    if (feat) features.push(feat);
  }
  return { type: "FeatureCollection", features };
}

async function lookupPlot(q: LiveQuery): Promise<FeatureCollection> {
  const lat =
    q.lat ??
    (q.south != null && q.north != null ? (q.south + q.north) / 2 : undefined);
  const lng =
    q.lng ??
    (q.west != null && q.east != null ? (q.west + q.east) / 2 : undefined);
  if (lat == null || lng == null) return empty();
  const data = (await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&format=jsonv2&addressdetails=1&extratags=1&zoom=18`,
    8000,
  )) as NominatimPlace | null;
  if (!data || typeof data !== "object") return empty();
  const feat = plotFromNominatim(data);
  return { type: "FeatureCollection", features: feat ? [feat] : [] };
}

async function geocodePlaces(q: LiveQuery): Promise<FeatureCollection> {
  const name = q.name?.trim();
  if (!name || name.length < 3) return empty();
  const data = (await fetchJson(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=jsonv2&addressdetails=1&limit=5`,
    8000,
  )) as NominatimPlace[] | null;
  const features: Feature[] = [];
  for (const row of data ?? []) {
    const feat = plotFromNominatim(row);
    if (feat) features.push(feat);
  }
  return { type: "FeatureCollection", features };
}

type MacroUnit = {
  name?: string;
  lith?: string;
  descrip?: string;
  comments?: string;
  color?: string;
  t_int_name?: string;
  b_int_name?: string;
  best_int_name?: string;
  t_age?: number;
  b_age?: number;
};

type SoilVal = { properties?: { layers?: Array<{ name?: string; depths?: Array<{ values?: { mean?: number | null } }> }> } };

async function groundFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const lat = q.lat ?? (q.south != null && q.north != null ? (q.south + q.north) / 2 : null);
  const lng = q.lng ?? (q.west != null && q.east != null ? (q.west + q.east) / 2 : null);
  if (lat == null || lng == null) return empty();
  const [macro, soil, elev, osm, lidar] = await Promise.all([
    fetchJson(
      `https://macrostrat.org/api/v2/geologic_units/map?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`,
      8000,
    ),
    fetchJson(
      `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng.toFixed(4)}&lat=${lat.toFixed(4)}&property=sand&property=clay&property=silt&depth=0-5cm&value=mean`,
      8000,
    ),
    fetchJson(
      `https://epqs.nationalmap.gov/v1/json?x=${lng.toFixed(5)}&y=${lat.toFixed(5)}&wkid=4326&units=Meters`,
      6000,
    ),
    osmGroundFeatures(q),
    lidarInventory(lat, lng),
  ]);
  const features: Feature[] = [...osm];
  const units = ((macro as { success?: { data?: MacroUnit[] } } | null)?.success?.data ?? []).slice(0, 3);
  const elevM = Number((elev as { value?: string | number } | null)?.value);
  const layers = (soil as SoilVal | null)?.properties?.layers ?? [];
  const soilBits: Array<{ label: string; value: string }> = [];
  for (const layer of layers) {
    const mean = layer.depths?.[0]?.values?.mean;
    if (layer.name && mean != null && Number.isFinite(mean)) {
      soilBits.push({ label: layer.name, value: `${Math.round(mean)}` });
    }
  }
  if (units[0] || Number.isFinite(elevM) || soilBits.length || lidar) {
    const top = units[0];
    const title = lidar?.workunit ? `Lidar · ${lidar.workunit}` : top?.name || "Ground at look-at";
    const lith = top?.lith || "unspecified lithology";
    const lidarLine = lidar
      ? lidarSummary({
          workunit: lidar.workunit,
          ql: lidar.ql,
          gsd: lidar.gsd,
          points: lidar.points,
          year: lidar.year,
          ept: lidar.ept,
        })
      : null;
    features.unshift(
      point(lng, lat, {
        kind: "rock",
        title,
        detail: [lidarLine, lith, top?.best_int_name || top?.t_int_name, Number.isFinite(elevM) ? `${Math.round(elevM)} m` : null]
          .filter(Boolean)
          .join(" · "),
        source: "USGS 3DEP LPC · NASA GEDI · Macrostrat · SoilGrids",
        elev: Number.isFinite(elevM) ? elevM : null,
        facts: JSON.stringify(
          [
            { label: "Layer", value: "Ground" },
            lidarLine ? { label: "Lidar", value: lidarLine } : null,
            lidar?.project ? { label: "Project", value: lidar.project } : null,
            top?.lith ? { label: "Lithology", value: top.lith } : null,
            top?.best_int_name ? { label: "Age", value: top.best_int_name } : null,
            top?.descrip ? { label: "Note", value: String(top.descrip).slice(0, 140) } : null,
            Number.isFinite(elevM) ? { label: "Elev m", value: String(Math.round(elevM)) } : null,
            ...soilBits.map((b) => ({ label: `Soil ${b.label}`, value: b.value })),
            { label: "Canopy", value: "NASA GEDI L3 RH100 (spaceborne lidar)" },
            { label: "DEM", value: "USGS 3DEP + Mapzen terrarium" },
          ].filter(Boolean),
        ),
      }),
    );
  }
  return { type: "FeatureCollection", features };
}

type LidarHit = {
  workunit: string;
  project: string | null;
  ql: string | null;
  gsd: number | null;
  year: number | null;
  points: number | null;
  ept: boolean;
};

type UsgsIndex = {
  features?: Array<{
    attributes?: {
      workunit?: string;
      project?: string;
      ql?: string;
      dem_gsd_meters?: number;
      collect_end?: number;
      lpc_category?: string;
    };
  }>;
};

async function lidarInventory(lat: number, lng: number): Promise<LidarHit | null> {
  const data = (await fetchJson(
    `https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/8/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=workunit,project,ql,dem_gsd_meters,collect_end,lpc_category&returnGeometry=false&f=json`,
    8000,
  )) as UsgsIndex | null;
  const rows = (data?.features ?? [])
    .map((f) => f.attributes)
    .filter((a): a is NonNullable<typeof a> => Boolean(a?.workunit))
    .sort((a, b) => Number(b.collect_end ?? 0) - Number(a.collect_end ?? 0));
  const best = rows.find((r) => /meet/i.test(r.lpc_category ?? "")) ?? rows[0];
  if (!best?.workunit) return null;
  const year = best.collect_end ? new Date(best.collect_end).getUTCFullYear() : null;
  const ept = (await fetchJson(
    `https://s3-us-west-2.amazonaws.com/usgs-lidar-public/${encodeURIComponent(best.workunit)}/ept.json`,
    5000,
  )) as { points?: number } | null;
  return {
    workunit: best.workunit,
    project: best.project ?? null,
    ql: best.ql ?? null,
    gsd: Number.isFinite(Number(best.dem_gsd_meters)) ? Number(best.dem_gsd_meters) : null,
    year: Number.isFinite(year) ? year : null,
    points: Number.isFinite(Number(ept?.points)) ? Number(ept?.points) : null,
    ept: Boolean(ept && (ept.points || ept)),
  };
}

async function osmGroundFeatures(q: LiveQuery): Promise<Feature[]> {
  if (q.west == null || q.south == null || q.east == null || q.north == null) return [];
  if ((q.zoom ?? 0) < 12) return [];
  const span = Math.abs(q.east - q.west) * Math.abs(q.north - q.south);
  if (span > 3) return [];
  const bbox = `${q.south.toFixed(4)},${q.west.toFixed(4)},${q.north.toFixed(4)},${q.east.toFixed(4)}`;
  const body = `[out:json][timeout:16];(way["waterway"~"^(ditch|drain|stream|canal)$"](${bbox});node["natural"~"^(rock|stone|bare_rock|scree|cliff)$"](${bbox});way["natural"~"^(bare_rock|scree|cliff)$"](${bbox}););out center 120;`;
  const elements = await overpassQuery(body);
  const features: Feature[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.geometry?.[0]?.lat;
    const lon = el.lon ?? el.geometry?.[0]?.lon;
    if (lat == null || lon == null) continue;
    const ditch = Boolean(tags.waterway);
    const title = tags.name || (tags.waterway || tags.natural || "ground").replace(/_/g, " ");
    features.push(
      point(lon, lat, {
        kind: ditch ? "ditch" : "rock",
        title,
        detail: [tags.waterway, tags.natural, tags.surface, tags.material].filter(Boolean).join(" · "),
        source: "OpenStreetMap Overpass",
        facts: JSON.stringify(
          [
            { label: "Layer", value: "Ground" },
            { label: "GIS", value: ditch ? "OSM waterway" : "OSM natural" },
            tags.surface ? { label: "Surface", value: tags.surface } : null,
            tags.material ? { label: "Material", value: tags.material } : null,
          ].filter(Boolean),
        ),
      }),
    );
  }
  return features;
}

async function bugFeatures(q: LiveQuery): Promise<FeatureCollection> {
  const feats = await gbifOccurrences(216, q, 60, { kind: "bug", fallback: "Insect" });
  return { type: "FeatureCollection", features: feats };
}

export async function loadLiveFeed(q: LiveQuery): Promise<FeatureCollection> {
  switch (q.kind) {
    case "transit":
      return transitFeatures(q);
    case "flights":
      return flightsFeatures(q);
    case "alerts":
      return alertsFeatures(q);
    case "events":
      return eventsFeatures();
    case "wildlife":
      return wildlifeFeatures(q);
    case "livestock":
      return livestockFeatures(q);
    case "plants":
      return plantFeatures(q);
    case "health":
      return healthFeatures();
    case "osm":
      return osmFeatures(q);
    case "plots":
      return plotsFeatures(q);
    case "zoning":
      return zoningFeatures(q);
    case "lookup":
      return lookupPlot(q);
    case "geocode":
      return geocodePlaces(q);
    case "iot":
      return iotFeatures(q);
    case "ground":
      return groundFeatures(q);
    case "bugs":
      return bugFeatures(q);
    default:
      return empty();
  }
}
