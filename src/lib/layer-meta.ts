import {
  Activity,
  Beef,
  Bird,
  Bug,
  Bus,
  CloudRain,
  Fence,
  Gem,
  Grid2x2,
  HeartPulse,
  House,
  LandPlot,
  Layers,
  Leaf,
  MapPin,
  MapPinHouse,
  Mountain,
  PawPrint,
  Plane,
  Radio,
  TrainFront,
  TriangleAlert,
  Type,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { OverlayId } from "@/lib/basemaps";
import type { MapObjectKind } from "@/lib/map-types";

export type LayerMeta = {
  icon: LucideIcon;
  usage: string;
};

export const LAYER_META: Record<OverlayId, LayerMeta> = {
  metric: {
    icon: Layers,
    usage: "Colors countries by the selected social metric.",
  },
  labels: {
    icon: Type,
    usage: "Place names and political boundaries over imagery.",
  },
  streets: {
    icon: Waypoints,
    usage: "Road network over the satellite base.",
  },
  trails: {
    icon: Mountain,
    usage:
      "OSM hiking network via Waymarked Trails: highway=path/footway, route=hiking, sac_scale, trail_visibility.",
  },
  wildlife: {
    icon: PawPrint,
    usage:
      "GBIF mammal/bird density as a heat map (amber → dense). Click a cell for the nearest named occurrence, not a country.",
  },
  livestock: {
    icon: Beef,
    usage:
      "GBIF cattle (Bos taurus) density, historic drives, OSM farmland/grass, highway=bridleway / route=horse, landuse=meadow|farmyard|animal_keeping, barrier=fence when zoomed.",
  },
  plants: {
    icon: Leaf,
    usage:
      "Vegetation as GIS, not scenery: NASA GIBS MODIS NDVI, GBIF Plantae, iNaturalist, OSM woods. Walk mode stands seeded low-poly trunks and canopy on the DEM at each occurrence. Click a cell or a tree.",
  },
  rail: {
    icon: TrainFront,
    usage:
      "Worldwide OSM railways (OpenMapTiles class=rail/transit, railway=station) plus live Amtrak trains. Zoom in to see tracks under a train.",
  },
  plots: {
    icon: LandPlot,
    usage:
      "US assessor lot lines (Regrid), OSM buildings and house numbers worldwide. Click a lot for the site address, or No site address when the plot is vacant/unaddressed. Zoom to neighborhood scale.",
  },
  zoning: {
    icon: Grid2x2,
    usage:
      "OSM land-use (residential, commercial, industrial, civic, recreation, construction, quarry/landfill) plus landcover (wood, grass, farmland, pasture) via OpenFreeMap. Walk or ask to mutate a district: the look-at commits immediately; neighbors queue as dashed blocks and stay independent until you confirm. Country metric fades so zone color is the fill.",
  },
  ground: {
    icon: Gem,
    usage:
      "Height anywhere: Open-Meteo DEM worldwide, USGS 3DEP where it answers. NASA GEDI RH100 canopy (global spaceborne lidar) plus ICESat-2 tracks at the look-at. Airborne 3DEP LPC only where a US workunit exists. Macrostrat, SoilGrids, OSM ditches. Ask lidar / rocks here.",
  },
  bugs: {
    icon: Bug,
    usage:
      "GBIF Insecta density and named occurrences. Ask what bugs are here — same heat language as wildlife, different taxon.",
  },
  health: {
    icon: HeartPulse,
    usage:
      "Country sickness load and 14-day case trend from public COVID-19 series. Click a pulse for the readout.",
  },
  radar: {
    icon: CloudRain,
    usage: "Near-real-time precipitation radar.",
  },
  quakes: {
    icon: Activity,
    usage: "USGS earthquakes, last 24 hours. Heat plus magnitude-colored rings. Click a ring, not the country under it.",
  },
  transit: {
    icon: Bus,
    usage:
      "Live vehicles perceive the district they occupy. Color is mood: flowing, constrained, rerouting around a hazard, or orphaned by a learned reclass — not a paper timetable.",
  },
  flights: {
    icon: Plane,
    usage: "Live ADS-B aircraft around major hubs, or around the view when zoomed.",
  },
  alerts: {
    icon: TriangleAlert,
    usage: "Active NWS weather alerts.",
  },
  events: {
    icon: Bird,
    usage: "NASA EONET open hazards (storms, wildfires, volcanoes).",
  },
  iot: {
    icon: Radio,
    usage:
      "IoT into the perception layer: METAR, Open-Meteo climate, worldwide height, air quality at the look-at. USGS 3DEP only refines height inside the US.",
  },
};

export const OBJECT_META: Record<MapObjectKind, LayerMeta> = {
  country: { icon: MapPin, usage: "National statistics." },
  quake: LAYER_META.quakes,
  transit: LAYER_META.transit,
  flight: LAYER_META.flights,
  alert: LAYER_META.alerts,
  event: LAYER_META.events,
  trail: { icon: PawPrint, usage: "A mapped corridor or drive." },
  sighting: { icon: PawPrint, usage: "A GBIF occurrence — common name, family, IUCN, photo when present." },
  plant: { icon: Leaf, usage: "A named plant occurrence — tree, shrub, or crop." },
  bug: { icon: Bug, usage: "A GBIF insect occurrence." },
  rock: { icon: Gem, usage: "Bedrock, lithology, or OSM rock at the look-at." },
  ditch: { icon: Gem, usage: "An OSM ditch, drain, or stream." },
  rail: LAYER_META.rail,
  fence: { icon: Fence, usage: "OSM barrier=fence, often around pasture." },
  farm: { icon: Beef, usage: "OSM landuse=meadow/farmyard/animal_keeping." },
  health: LAYER_META.health,
  plot: {
    icon: LandPlot,
    usage: "A cadastral lot or vacant land polygon. Click for the assessor-style readout.",
  },
  building: {
    icon: House,
    usage: "An OSM building footprint. Site address is reverse-geocoded on click.",
  },
  address: {
    icon: MapPinHouse,
    usage: "A site address (addr:housenumber / Nominatim). Blank lots show No site address.",
  },
  zone: {
    icon: Grid2x2,
    usage:
      "An OSM land-use zone. Legal zoning ordinances are municipal; this is the worldwide land-use proxy.",
  },
  sensor: LAYER_META.iot,
};
