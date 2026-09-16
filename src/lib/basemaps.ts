export type OverlayId =
  | "metric"
  | "labels"
  | "streets"
  | "trails"
  | "wildlife"
  | "livestock"
  | "plants"
  | "rail"
  | "plots"
  | "zoning"
  | "health"
  | "radar"
  | "quakes"
  | "transit"
  | "flights"
  | "alerts"
  | "events"
  | "iot";

export type OverlayGroup = "map" | "animals" | "live";

export type OverlayState = Record<OverlayId, boolean>;

export type OverlayDef = {
  id: OverlayId;
  label: string;
  blurb: string;
  live: boolean;
  group: OverlayGroup;
};

export const OVERLAYS: OverlayDef[] = [
  {
    id: "metric",
    label: "Metric",
    blurb: "Choropleth over satellite",
    live: false,
    group: "map",
  },
  {
    id: "labels",
    label: "Labels",
    blurb: "Places and boundaries",
    live: false,
    group: "map",
  },
  {
    id: "streets",
    label: "Streets",
    blurb: "Navigation over imagery",
    live: false,
    group: "map",
  },
  {
    id: "trails",
    label: "Hiking",
    blurb: "Human hiking network",
    live: false,
    group: "map",
  },
  {
    id: "wildlife",
    label: "Wild",
    blurb: "Migration corridors and wild tracks",
    live: true,
    group: "animals",
  },
  {
    id: "livestock",
    label: "Domestic",
    blurb: "Livestock drives, herding, horse trails",
    live: true,
    group: "animals",
  },
  {
    id: "plants",
    label: "Plants",
    blurb: "Trees, shrubs, crops, NDVI — vegetation as GIS",
    live: true,
    group: "animals",
  },
  {
    id: "rail",
    label: "Rail",
    blurb: "Tracks and stations from OSM",
    live: true,
    group: "map",
  },
  {
    id: "plots",
    label: "Plots",
    blurb: "Assessor lots and site addresses",
    live: true,
    group: "map",
  },
  {
    id: "zoning",
    label: "Zoning",
    blurb: "Land-use zones worldwide",
    live: true,
    group: "map",
  },
  {
    id: "health",
    label: "Health",
    blurb: "Sickness trends by country",
    live: true,
    group: "live",
  },
  {
    id: "radar",
    label: "Radar",
    blurb: "Live precipitation",
    live: true,
    group: "live",
  },
  {
    id: "quakes",
    label: "Quakes",
    blurb: "USGS last 24 hours",
    live: true,
    group: "live",
  },
  {
    id: "transit",
    label: "Transit",
    blurb: "Live GTFS vehicle positions",
    live: true,
    group: "live",
  },
  {
    id: "flights",
    label: "Flights",
    blurb: "Live aircraft positions",
    live: true,
    group: "live",
  },
  {
    id: "alerts",
    label: "Alerts",
    blurb: "NWS weather alerts",
    live: true,
    group: "live",
  },
  {
    id: "events",
    label: "Events",
    blurb: "NASA EONET hazards",
    live: true,
    group: "live",
  },
  {
    id: "iot",
    label: "IoT",
    blurb: "Sensors into the perception layer",
    live: true,
    group: "live",
  },
];

export const DEFAULT_OVERLAYS: OverlayState = {
  metric: true,
  labels: true,
  streets: false,
  trails: false,
  wildlife: false,
  livestock: false,
  plants: false,
  rail: false,
  plots: false,
  zoning: false,
  health: false,
  radar: false,
  quakes: false,
  transit: false,
  flights: false,
  alerts: false,
  events: false,
  iot: false,
};

export function gibsNdviTileUrl(): string {
  const d = new Date(Date.now() - 20 * 86_400_000);
  const iso = d.toISOString().slice(0, 10);
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${iso}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;
}

export const TILES = {
  marble:
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  imagery:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  streets:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  reference:
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  trails: "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
  riding: "https://tile.waymarkedtrails.org/riding/{z}/{x}/{y}.png",
  gbifWild:
    "https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&taxonKey=359&bin=hex&hexPerTile=22&style=classic.poly",
  gbifStock:
    "https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&taxonKey=2441022&bin=hex&hexPerTile=22&style=purpleYellow-noborder.poly",
  gbifPlants:
    "https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&taxonKey=6&bin=hex&hexPerTile=22&style=green.poly",
  ndvi: gibsNdviTileUrl(),
  parcels:
    "https://tiles.arcgis.com/tiles/KzeiCaQsMoeCfoCq/arcgis/rest/services/Regrid_Nationwide_Parcel_Boundaries_v1/MapServer/tile/{z}/{y}/{x}",
} as const;

export const TILE_ATTRIBUTION =
  "NASA GIBS NDVI, Esri, Maxar, OpenStreetMap, OpenFreeMap, Regrid, USGS, RainViewer, GTFS-RT, ADS-B, NWS, EONET, GBIF, iNaturalist, Waymarked Trails, Open-Meteo, disease.sh";

export {
  COVER_CLASS_FILTER,
  COVER_FILL_COLOR,
  COVER_SWATCHES,
  LANDUSE_CLASS_FILTER,
  LANDUSE_SWATCHES,
  ZONE_CLASS_FILTER,
  ZONE_FILL_COLOR,
  ZONE_MEMORY_COLOR,
  ZONE_LABEL,
  ZONE_SWATCHES,
  zoneLabel,
  type ZoneSwatch,
} from "./heat.ts";

export const QUAKES_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";

export const RAINVIEWER_MAPS = "https://api.rainviewer.com/public/weather-maps.json";

export const HOME_VIEW = {
  lng: -88,
  lat: 22,
  zoom: 1.85,
};

/** City-scale look-at used when a query asks for districts / walk from orbit. */
export const DISTRICT_VIEW = {
  lng: -106.6504,
  lat: 35.0844,
  zoom: 13.2,
  name: "Albuquerque",
};

export const DISTRICT_SPOTS: Record<string, { lng: number; lat: number; zoom: number }> = {
  industrial: { lng: -106.6522, lat: 35.0684, zoom: 14.1 },
  commercial: { lng: -106.6513, lat: 35.0848, zoom: 14.2 },
  residential: { lng: -106.606, lat: 35.104, zoom: 13.8 },
  retail: { lng: -106.5655, lat: 35.1105, zoom: 14.4 },
  recreation: { lng: -106.678, lat: 35.093, zoom: 14.2 },
  civic: { lng: -106.62, lat: 35.084, zoom: 14.0 },
  extractive: { lng: -106.78, lat: 35.04, zoom: 13.6 },
  pasture: { lng: -106.72, lat: 35.16, zoom: 13.4 },
};

export function altitudeFromZoom(zoom: number): number {
  return Math.round(40075017 / Math.pow(2, zoom + 1));
}

type RainViewerMaps = {
  radar?: {
    past?: Array<{ time: number; path: string }>;
  };
};

export function radarTileUrl(data: RainViewerMaps): string | null {
  const frames = data.radar?.past;
  const last = frames?.[frames.length - 1];
  if (!last) return null;
  const path = last.path || `/v2/radar/${last.time}`;
  return `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`;
}
