import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  RasterTileSource,
  StyleSpecification,
} from "maplibre-gl";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { geoBounds } from "d3-geo";
import { countryValue, type MetricId } from "@/lib/metrics";
import { lookupCountry } from "@/lib/countries";
import type { ChoroplethScale } from "@/lib/color-scale";
import type {
  CountryFeature,
  GlobeRotation,
  HoverInfo,
  MapObject,
  MapObjectKind,
  MapTransform,
  ViewMode,
} from "@/lib/map-types";
import { HOME_ROTATION } from "@/lib/map-types";
import { GlobeFallback } from "@/components/globe-fallback";
import { DOMESTIC_TRAILS, WILD_TRAILS } from "@/lib/animal-trails";
import {
  COVER_CLASS_FILTER,
  COVER_FILL_COLOR,
  DISTRICT_SPOTS,
  DISTRICT_VIEW,
  HOME_VIEW,
  LANDUSE_CLASS_FILTER,
  QUAKES_URL,
  RAINVIEWER_MAPS,
  TILES,
  TILE_ATTRIBUTION,
  ZONE_FILL_COLOR,
  ZONE_SWATCHES,
  radarTileUrl,
  type OverlayState,
  zoneLabel,
} from "@/lib/basemaps";
import { cn } from "@/lib/utils";
import { destination, wrapBearing } from "@/lib/spatial";
import { countryAtLngLat } from "@/lib/spatial-index";
import {
  densityObject,
  heatmapColorExpr,
  quakeCircleColor,
} from "@/lib/heat";
import { DISTRICT_ZOOM, radarDimFactor, type SceneSample } from "@/lib/zoning-rules";
import { patchesToGeoJSON, type ZonePatch } from "@/lib/zone-memory";

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}

export type WorldMapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  enterWalk: (lng?: number, lat?: number) => void;
  dropToDistricts: (zoneClass?: string | null) => void;
  holdKey: (code: string, down: boolean) => void;
  setHeldKeys: (codes: string[]) => void;
  queryScene: () => SceneSample | null;
  getYaw: () => number;
  getSpeed: () => number;
};

type WorldMapProps = {
  metric: MetricId;
  scale: ChoroplethScale;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hover: HoverInfo | null;
  onHover: (info: HoverInfo | null) => void;
  transform: MapTransform;
  onTransform: (next: MapTransform | ((prev: MapTransform) => MapTransform)) => void;
  flyToId: string | null;
  flyNonce: number;
  viewMode: ViewMode;
  rotation: GlobeRotation;
  onRotation: (next: GlobeRotation) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  overlays: OverlayState;
  onLiveNote?: (note: string) => void;
  onPickObject?: (object: MapObject | null) => void;
  zoneFilter?: string | null;
  onScene?: (scene: SceneSample | null) => void;
  patches?: ZonePatch[];
};

function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function resolveColor(el: Element, token: string): string {
  if (token.startsWith("var(")) {
    const name = token.slice(4, -1).trim();
    const value = getComputedStyle(el).getPropertyValue(name).trim();
    return value || "#6fa393";
  }
  return token;
}

function colorFeatures(
  fc: FeatureCollection,
  metric: MetricId,
  scale: ChoroplethScale,
  el: Element,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.map((feat) => {
      const country = lookupCountry({
        id: feat.id,
        properties: feat.properties as { name?: string } | undefined,
      });
      const value = country ? countryValue(country, metric) : null;
      return {
        ...feat,
        id: feat.id,
        properties: {
          ...feat.properties,
          iso: String(feat.id ?? ""),
          fill: resolveColor(el, scale.colorFor(value)),
          hasData: value != null,
        },
      };
    }),
  };
}

function buildStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      marble: {
        type: "raster",
        tiles: [TILES.marble],
        tileSize: 256,
        maxzoom: 8,
        attribution: TILE_ATTRIBUTION,
      },
      imagery: {
        type: "raster",
        tiles: [TILES.imagery],
        tileSize: 256,
        maxzoom: 19,
        attribution: TILE_ATTRIBUTION,
      },
      streets: {
        type: "raster",
        tiles: [TILES.streets],
        tileSize: 256,
        maxzoom: 19,
        attribution: TILE_ATTRIBUTION,
      },
      radar: {
        type: "raster",
        tiles: [
          "https://tilecache.rainviewer.com/v2/radar/0/256/{z}/{x}/{y}/2/1_1.png",
        ],
        tileSize: 256,
        maxzoom: 12,
        attribution: "RainViewer",
      },
      reference: {
        type: "raster",
        tiles: [TILES.reference],
        tileSize: 256,
        maxzoom: 19,
        attribution: TILE_ATTRIBUTION,
      },
      trails: {
        type: "raster",
        tiles: [TILES.trails],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Waymarked Trails",
      },
      riding: {
        type: "raster",
        tiles: [TILES.riding],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Waymarked Trails",
      },
      wildlife: {
        type: "geojson",
        data: WILD_TRAILS,
      },
      livestock: {
        type: "geojson",
        data: DOMESTIC_TRAILS,
      },
      wildlifeLive: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      livestockLive: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      plantsLive: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      gbifWild: {
        type: "raster",
        tiles: [TILES.gbifWild],
        tileSize: 256,
        maxzoom: 16,
        attribution: "GBIF",
      },
      gbifStock: {
        type: "raster",
        tiles: [TILES.gbifStock],
        tileSize: 256,
        maxzoom: 16,
        attribution: "GBIF",
      },
      gbifPlants: {
        type: "raster",
        tiles: [TILES.gbifPlants],
        tileSize: 256,
        maxzoom: 16,
        attribution: "GBIF",
      },
      health: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      osm: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      plots: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      zoning: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      memory: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      parcels: {
        type: "raster",
        tiles: [TILES.parcels],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 22,
        attribution: "Regrid, Esri",
      },
      openmaptiles: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: "OpenFreeMap, OpenMapTiles, OSM",
      },
      countries: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "iso",
      },
      quakes: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      transit: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      flights: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      alerts: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      events: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#05060a" },
      },
      {
        id: "marble",
        type: "raster",
        source: "marble",
        layout: { visibility: "visible" },
      },
      {
        id: "imagery",
        type: "raster",
        source: "imagery",
        layout: { visibility: "visible" },
      },
      {
        id: "streets",
        type: "raster",
        source: "streets",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.42 },
      },
      {
        id: "radar",
        type: "raster",
        source: "radar",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.72 },
      },
      {
        id: "choropleth",
        type: "fill",
        source: "countries",
        paint: {
          "fill-color": ["coalesce", ["get", "fill"], "#888888"],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.55,
              ["boolean", ["feature-state", "hover"], false],
              0.42,
              0.28,
            ],
            6.5,
            0.12,
            8.5,
            0,
          ],
        },
      },
      {
        id: "borders",
        type: "line",
        source: "countries",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#f4f4f5",
            "rgba(255,255,255,0.35)",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            1.8,
            0.4,
          ],
        },
      },
      {
        id: "otm-cover",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        minzoom: DISTRICT_ZOOM,
        filter: ["match", ["get", "class"], COVER_CLASS_FILTER, true, false],
        layout: { visibility: "none" },
        paint: {
          "fill-color": COVER_FILL_COLOR,
          "fill-opacity": 0.42,
          "fill-outline-color": "rgba(231,234,237,0.12)",
        },
      },
      {
        id: "otm-park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        minzoom: 8,
        layout: { visibility: "none" },
        paint: {
          "fill-color": "#2f8a4b",
          "fill-opacity": 0.4,
        },
      },
      {
        id: "otm-zone",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        minzoom: DISTRICT_ZOOM,
        filter: ["match", ["get", "class"], LANDUSE_CLASS_FILTER, true, false],
        layout: { visibility: "none" },
        paint: {
          "fill-color": ZONE_FILL_COLOR,
          "fill-opacity": 0.52,
        },
      },
      {
        id: "otm-zone-line",
        type: "line",
        source: "openmaptiles",
        "source-layer": "landuse",
        minzoom: 12,
        filter: ["match", ["get", "class"], LANDUSE_CLASS_FILTER, true, false],
        layout: { visibility: "none" },
        paint: {
          "line-color": "rgba(231,234,237,0.35)",
          "line-width": 0.55,
        },
      },
      {
        id: "zoning-fill",
        type: "fill",
        source: "zoning",
        filter: ["==", ["geometry-type"], "Polygon"],
        layout: { visibility: "none" },
        paint: {
          "fill-color": ZONE_FILL_COLOR,
          "fill-opacity": 0.38,
        },
      },
      {
        id: "zoning-line",
        type: "line",
        source: "zoning",
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#c4b89a",
          "line-width": 1.3,
          "line-opacity": 0.85,
        },
      },
      {
        id: "zoning-point",
        type: "circle",
        source: "zoning",
        filter: ["==", ["geometry-type"], "Point"],
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 4,
          "circle-color": "#c4b89a",
          "circle-opacity": 0.9,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.6,
        },
      },
      {
        id: "memory-fill",
        type: "fill",
        source: "memory",
        layout: { visibility: "none" },
        paint: {
          "fill-color": ZONE_FILL_COLOR,
          "fill-opacity": [
            "case",
            ["==", ["get", "status"], "proposed"],
            0.22,
            0.48,
          ],
        },
      },
      {
        id: "memory-line",
        type: "line",
        source: "memory",
        layout: { visibility: "none" },
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "status"], "proposed"],
            "#d4a054",
            "#e7eaed",
          ],
          "line-width": 1.4,
        },
      },
      {
        id: "parcels",
        type: "raster",
        source: "parcels",
        minzoom: 13,
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.88 },
      },
      {
        id: "otm-building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        layout: { visibility: "none" },
        paint: {
          "fill-color": "#7ecad4",
          "fill-opacity": 0.22,
        },
      },
      {
        id: "otm-building-line",
        type: "line",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        layout: { visibility: "none" },
        paint: {
          "line-color": "#e7eaed",
          "line-width": 0.6,
          "line-opacity": 0.7,
        },
      },
      {
        id: "otm-building-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": "#6d7c82",
          "fill-extrusion-height": [
            "coalesce",
            ["get", "render_height"],
            ["get", "height"],
            10,
          ],
          "fill-extrusion-base": [
            "coalesce",
            ["get", "render_min_height"],
            ["get", "min_height"],
            0,
          ],
          "fill-extrusion-opacity": 0.88,
        },
      },
      {
        id: "otm-housenumber",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "housenumber",
        minzoom: 16,
        layout: {
          visibility: "none",
          "text-field": ["to-string", ["get", "housenumber"]],
          "text-font": ["Open Sans Regular"],
          "text-size": 11,
          "text-padding": 2,
        },
        paint: {
          "text-color": "#e7eaed",
          "text-halo-color": "#05060a",
          "text-halo-width": 1.2,
        },
      },
      {
        id: "plots-fill",
        type: "fill",
        source: "plots",
        filter: ["==", ["geometry-type"], "Polygon"],
        layout: { visibility: "none" },
        paint: {
          "fill-color": "#7ecad4",
          "fill-opacity": 0.12,
        },
      },
      {
        id: "plots-line",
        type: "line",
        source: "plots",
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#7ecad4",
          "line-width": 1.2,
          "line-opacity": 0.85,
        },
      },
      {
        id: "plots-point",
        type: "circle",
        source: "plots",
        filter: ["==", ["geometry-type"], "Point"],
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 3.4,
          "circle-color": "#e7eaed",
          "circle-opacity": 0.9,
          "circle-stroke-color": "#7ecad4",
          "circle-stroke-width": 0.7,
        },
      },
      {
        id: "trails",
        type: "raster",
        source: "trails",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.9 },
      },
      {
        id: "riding",
        type: "raster",
        source: "riding",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.85 },
      },
      {
        id: "wildlife",
        type: "line",
        source: "wildlife",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#7ecad4",
          "line-width": 1.7,
          "line-opacity": 0.8,
          "line-dasharray": [2.2, 1.4],
        },
      },
      {
        id: "livestock",
        type: "line",
        source: "livestock",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#e7eaed",
          "line-width": 1.5,
          "line-opacity": 0.72,
        },
      },
      {
        id: "wildlifeLive",
        type: "circle",
        source: "wildlifeLive",
        minzoom: 8,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 8],
          "circle-color": "#d4a054",
          "circle-opacity": 0.92,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.8,
        },
      },
      {
        id: "livestockLive",
        type: "circle",
        source: "livestockLive",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 3.2,
          "circle-color": "#e7eaed",
          "circle-opacity": 0.75,
          "circle-stroke-width": 0,
        },
      },
      {
        id: "gbifWild",
        type: "raster",
        source: "gbifWild",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.62 },
      },
      {
        id: "wildlife-heat",
        type: "heatmap",
        source: "wildlifeLive",
        maxzoom: 16,
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 12, 1.6],
          "heatmap-color": heatmapColorExpr("wildlife"),
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 12, 28],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.55, 14, 0.75],
        },
      },
      {
        id: "gbifStock",
        type: "raster",
        source: "gbifStock",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.5 },
      },
      {
        id: "livestock-heat",
        type: "heatmap",
        source: "livestockLive",
        maxzoom: 16,
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 12, 1.4],
          "heatmap-color": heatmapColorExpr("livestock"),
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 10, 12, 24],
          "heatmap-opacity": 0.6,
        },
      },
      {
        id: "gbifPlants",
        type: "raster",
        source: "gbifPlants",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.58 },
      },
      {
        id: "plants-heat",
        type: "heatmap",
        source: "plantsLive",
        maxzoom: 16,
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 12, 1.5],
          "heatmap-color": heatmapColorExpr("plants"),
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 12, 26],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 14, 0.72],
        },
      },
      {
        id: "plantsLive",
        type: "circle",
        source: "plantsLive",
        minzoom: 8,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 8],
          "circle-color": "#3d9e72",
          "circle-opacity": 0.9,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.8,
        },
      },
      {
        id: "otm-plants",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        minzoom: 7,
        filter: ["match", ["get", "class"], ["wood", "grass", "farmland", "wetland"], true, false],
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "match",
            ["get", "class"],
            "wood",
            "#2f6b45",
            "grass",
            "#5a8f4a",
            "farmland",
            "#7a9a3a",
            "wetland",
            "#3d6b5c",
            "#3d9e72",
          ],
          "fill-opacity": 0.38,
        },
      },
      {
        id: "otm-farm",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        minzoom: 7,
        filter: ["match", ["get", "class"], ["farmland", "grass"], true, false],
        layout: { visibility: "none" },
        paint: {
          "fill-color": "#c4b89a",
          "fill-opacity": 0.28,
        },
      },
      {
        id: "otm-rail",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 5,
        filter: ["match", ["get", "class"], ["rail", "transit"], true, false],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#e7eaed",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0.5,
            12,
            1.6,
            16,
            2.4,
          ],
          "line-opacity": 0.9,
        },
      },
      {
        id: "otm-rail-hatch",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["==", ["get", "class"], "rail"],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#e7eaed",
          "line-width": 3.4,
          "line-dasharray": [0.2, 3.2],
          "line-opacity": 0.5,
        },
      },
      {
        id: "otm-station",
        type: "circle",
        source: "openmaptiles",
        "source-layer": "poi",
        minzoom: 10,
        filter: ["==", ["get", "class"], "railway"],
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 4,
          "circle-color": "#7ecad4",
          "circle-opacity": 0.9,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.6,
        },
      },
      {
        id: "osm-fill",
        type: "fill",
        source: "osm",
        filter: ["==", ["geometry-type"], "Polygon"],
        layout: { visibility: "none" },
        paint: {
          "fill-color": "#7ecad4",
          "fill-opacity": 0.18,
        },
      },
      {
        id: "osm-line",
        type: "line",
        source: "osm",
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { visibility: "none" },
        paint: {
          "line-color": [
            "match",
            ["get", "kind"],
            "rail",
            "#e7eaed",
            "fence",
            "#7ecad4",
            "#c4b89a",
          ],
          "line-width": [
            "match",
            ["get", "kind"],
            "rail",
            1.8,
            "fence",
            1.1,
            1.4,
          ],
          "line-opacity": 0.85,
        },
      },
      {
        id: "osm-point",
        type: "circle",
        source: "osm",
        filter: ["==", ["geometry-type"], "Point"],
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 4,
          "circle-color": "#7ecad4",
          "circle-opacity": 0.9,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.6,
        },
      },
      {
        id: "health",
        type: "circle",
        source: "health",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["coalesce", ["get", "mag"], 6],
          "circle-color": "#7ecad4",
          "circle-opacity": 0.45,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.8,
        },
      },
      {
        id: "reference",
        type: "raster",
        source: "reference",
        layout: { visibility: "none" },
      },
      {
        id: "quakes-heat",
        type: "heatmap",
        source: "quakes",
        maxzoom: 10,
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "mag"], 0],
            2.5,
            0.3,
            7,
            1.4,
          ],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 1, 0.5, 6, 1.3],
          "heatmap-color": heatmapColorExpr("quakes"),
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 1, 14, 6, 28],
          "heatmap-opacity": 0.65,
        },
      },
      {
        id: "quakes",
        type: "circle",
        source: "quakes",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "mag"],
            2.5,
            5,
            8,
            18,
          ],
          "circle-color": quakeCircleColor(),
          "circle-opacity": 0.9,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.9,
        },
      },
      {
        id: "alerts",
        type: "circle",
        source: "alerts",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 7,
          "circle-color": "#7ecad4",
          "circle-opacity": 0.35,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 1,
        },
      },
      {
        id: "events",
        type: "circle",
        source: "events",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 6,
          "circle-color": "#7ecad4",
          "circle-opacity": 0.7,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.8,
        },
      },
      {
        id: "flights",
        type: "circle",
        source: "flights",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 3.4,
          "circle-color": "#e7eaed",
          "circle-opacity": 0.85,
          "circle-stroke-width": 0,
        },
      },
      {
        id: "transit",
        type: "circle",
        source: "transit",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 4,
          "circle-color": "#7ecad4",
          "circle-opacity": 0.92,
          "circle-stroke-color": "#e7eaed",
          "circle-stroke-width": 0.6,
        },
      },
    ],
  };
}

const OVERLAY_LAYERS: Record<keyof OverlayState, string[]> = {
  metric: ["choropleth"],
  labels: ["reference"],
  streets: ["streets"],
  trails: ["trails"],
  wildlife: ["gbifWild", "wildlife-heat", "wildlife", "wildlifeLive"],
  livestock: [
    "gbifStock",
    "livestock-heat",
    "livestock",
    "livestockLive",
    "riding",
    "otm-farm",
    "osm-fill",
  ],
  plants: ["gbifPlants", "plants-heat", "plantsLive", "otm-plants"],
  rail: ["otm-rail", "otm-rail-hatch", "otm-station", "osm-line", "osm-point"],
  plots: [
    "parcels",
    "otm-building",
    "otm-building-line",
    "otm-building-3d",
    "otm-housenumber",
    "plots-fill",
    "plots-line",
    "plots-point",
  ],
  zoning: [
    "otm-cover",
    "otm-park",
    "otm-zone",
    "otm-zone-line",
    "zoning-fill",
    "zoning-line",
    "zoning-point",
    "memory-fill",
    "memory-line",
  ],
  health: ["health"],
  radar: ["radar"],
  quakes: ["quakes-heat", "quakes"],
  transit: ["transit"],
  flights: ["flights"],
  alerts: ["alerts"],
  events: ["events"],
};

const POINT_HIT_LAYERS = [
  "transit",
  "flights",
  "wildlifeLive",
  "livestockLive",
  "plantsLive",
  "health",
  "plots-point",
  "otm-housenumber",
  "otm-station",
  "osm-point",
  "zoning-point",
  "quakes",
  "alerts",
  "events",
];

const AREA_HIT_LAYERS = [
  "plots-line",
  "plots-fill",
  "otm-building",
  "otm-building-3d",
  "zoning-line",
  "zoning-fill",
  "otm-zone",
  "otm-park",
  "otm-cover",
  "memory-fill",
  "osm-line",
  "osm-fill",
  "otm-rail",
  "otm-farm",
  "otm-plants",
  "wildlife",
  "livestock",
];

const HIT_LAYERS = [...POINT_HIT_LAYERS, ...AREA_HIT_LAYERS];

function parseFacts(raw: unknown): Array<{ label: string; value: string }> | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Array<{ label: string; value: string }>;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parseTrend(raw: unknown): number[] | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const values = parsed.map(Number).filter(Number.isFinite);
    return values.length ? values : undefined;
  } catch {
    return undefined;
  }
}

function closestFeature(
  features: GeoJSON.Feature[],
  lng: number,
  lat: number,
): GeoJSON.Feature | undefined {
  let best: GeoJSON.Feature | undefined;
  let bestD = Infinity;
  for (const feat of features) {
    const geom = feat.geometry;
    if (!geom || geom.type !== "Point") continue;
    const [x, y] = geom.coordinates;
    if (x == null || y == null) continue;
    const d = (x - lng) ** 2 + (y - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = feat;
    }
  }
  return best;
}

function layerName(layerId: string, kind: MapObjectKind): string {
  if (layerId.includes("plants") || kind === "plant") return "Plants";
  if (layerId.includes("wildlife") || kind === "sighting") return "Wild";
  if (layerId.includes("livestock") || kind === "farm" || kind === "fence") return "Domestic";
  if (layerId === "quakes" || kind === "quake") return "Quakes";
  if (layerId.startsWith("otm-zone") || layerId.startsWith("zoning") || layerId === "otm-cover" || layerId === "otm-park" || layerId.startsWith("memory") || kind === "zone")
    return "Zoning";
  if (layerId.startsWith("plots") || kind === "plot" || kind === "building" || kind === "address")
    return "Plots";
  if (kind === "transit") return "Transit";
  if (kind === "flight") return "Flights";
  if (kind === "rail") return "Rail";
  if (kind === "health") return "Health";
  if (kind === "alert") return "Alerts";
  if (kind === "event") return "Events";
  if (kind === "country") return "Metric";
  return kind;
}

function withGround(object: MapObject, ground?: string | null): MapObject {
  if (!ground) return object;
  const facts = object.facts ? [...object.facts] : [];
  if (!facts.some((f) => f.label === "Ground")) {
    facts.unshift({ label: "Ground", value: ground });
  }
  return { ...object, ground, facts };
}

function featureToObject(
  feat: GeoJSON.Feature,
  layerId: string,
  lngLat?: { lng: number; lat: number },
): MapObject {
  const props = (feat.properties ?? {}) as Record<string, unknown>;
  const rawKind = String(props.kind ?? "");
  const kind: MapObjectKind = (
    [
      "rail",
      "fence",
      "farm",
      "health",
      "sighting",
      "plant",
      "trail",
      "transit",
      "flight",
      "alert",
      "event",
      "quake",
      "plot",
      "building",
      "address",
      "zone",
    ].includes(rawKind)
      ? rawKind
      : layerId === "quakes"
        ? "quake"
        : layerId === "choropleth"
          ? "country"
          : layerId === "otm-farm"
            ? "farm"
            : layerId === "otm-plants" || layerId.includes("plants")
              ? "plant"
            : layerId === "otm-housenumber"
              ? "address"
              : layerId.startsWith("otm-building")
                ? "building"
                : layerId.startsWith("plots")
                  ? "plot"
                  : layerId === "otm-zone" ||
                      layerId === "otm-zone-line" ||
                      layerId === "otm-cover" ||
                      layerId === "otm-park" ||
                      layerId.startsWith("zoning") ||
                      layerId.startsWith("memory")
                    ? "zone"
            : layerId.startsWith("otm-")
              ? "rail"
              : layerId.includes("Live")
                ? "sighting"
                : layerId.includes("wildlife") || layerId.includes("livestock")
                  ? "trail"
                  : "trail"
  ) as MapObjectKind;
  if (layerId === "choropleth") {
    const name = String(props.name ?? "Country");
    return {
      kind: "country",
      title: name,
      detail: "National choropleth feature",
      layer: "Metric",
      lng: lngLat?.lng,
      lat: lngLat?.lat,
    };
  }
  if (layerId === "quakes") {
    const mag = Number(props.mag ?? 0);
    const place = String(props.place ?? "Earthquake");
    return {
      kind: "quake",
      title: `M ${mag.toFixed(1)}`,
      detail: place,
      source: "USGS",
      layer: "Quakes",
      facts: [
        { label: "Layer", value: "Quakes" },
        { label: "Magnitude", value: mag.toFixed(1) },
        { label: "Place", value: place },
      ],
      lng: lngLat?.lng,
      lat: lngLat?.lat,
    };
  }
  if (layerId.startsWith("otm-")) {
    const name = String(props.name ?? props.name_en ?? "");
    const klass = String(props.class ?? "");
    const sub = String(props.subclass ?? "");
    const house = String(props.housenumber ?? "");
    const height = props.render_height != null ? String(props.render_height) : "";
    const isZone =
      layerId === "otm-zone" ||
      layerId === "otm-zone-line" ||
      layerId === "otm-cover" ||
      layerId === "otm-park" ||
      layerId.startsWith("memory");
    const title =
      name ||
      house ||
      (layerId === "otm-farm"
        ? "Pasture / farmland"
        : layerId === "otm-station"
          ? "Station"
          : layerId === "otm-housenumber"
            ? `No. ${house || "?"}`
            : layerId.startsWith("otm-building")
              ? "Building"
              : isZone
                ? zoneLabel(klass || (layerId === "otm-park" ? "park" : klass))
                : "Railway");
    const layer = layerName(layerId, kind);
    return {
      kind,
      title,
      detail: isZone
        ? "OpenStreetMap land-use / landcover via OpenFreeMap. This is the district class, not a country statistic."
        : [klass, sub, house && `#${house}`].filter(Boolean).join(" · ") || "OpenStreetMap",
      source: "OpenStreetMap via OpenFreeMap",
      layer,
      facts: [
        { label: "Layer", value: layer },
        house ? { label: "House no.", value: house } : null,
        height ? { label: "Height m", value: height } : null,
        klass ? { label: "class", value: klass } : null,
        sub ? { label: "subclass", value: sub } : null,
        name ? { label: "name", value: name } : null,
      ].filter((row): row is { label: string; value: string } => Boolean(row)),
      lng: lngLat?.lng,
      lat: lngLat?.lat,
    };
  }
  const layer = layerName(layerId, kind);
  const facts = parseFacts(props.facts) ?? [];
  if (!facts.some((f) => f.label === "Layer")) {
    facts.unshift({ label: "Layer", value: layer });
  }
  return {
    kind,
    title: String(props.title ?? props.name ?? layerId),
    detail: String(props.detail ?? ""),
    source: String(props.source ?? ""),
    layer,
    facts,
    trend: parseTrend(props.trend),
    lng: lngLat?.lng,
    lat: lngLat?.lat,
  };
}

async function loadCountries(url: string): Promise<FeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load world boundaries.");
  const topology = (await res.json()) as Topology;
  const object = topology.objects.countries;
  if (!object) throw new Error("Missing countries in atlas.");
  return feature(topology, object) as FeatureCollection<Geometry, { name: string }>;
}

export const WorldMap = forwardRef<WorldMapHandle, WorldMapProps>(function WorldMap(
  {
    metric,
    scale,
    selectedId,
    onSelect,
    onHover,
    onTransform,
    flyToId,
    flyNonce,
    viewMode,
    rotation,
    onRotation,
    onSizeChange,
    overlays,
    onLiveNote,
    onPickObject,
    zoneFilter = null,
    onScene,
    patches = [],
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rawRef = useRef<FeatureCollection | null>(null);
  const selectedRef = useRef<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const detailRef = useRef(false);
  const metricRef = useRef(metric);
  const scaleRef = useRef(scale);
  const liveNoteRef = useRef(onLiveNote);
  const pickRef = useRef(onPickObject);
  const overlaysRef = useRef(overlays);
  const keysRef = useRef(new Set<string>());
  const speedRef = useRef(0);
  const onSceneRef = useRef(onScene);
  const hoverCbRef = useRef(onHover);
  metricRef.current = metric;
  scaleRef.current = scale;
  liveNoteRef.current = onLiveNote;
  pickRef.current = onPickObject;
  overlaysRef.current = overlays;
  onSceneRef.current = onScene;
  hoverCbRef.current = onHover;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const globe = viewMode === "godsEye";
  const walking = viewMode === "walk";

  const sampleScene = (): SceneSample | null => {
    const map = mapRef.current;
    if (!map) return null;
    const center = map.getCenter();
    const p = map.project(center);
    const box: [[number, number], [number, number]] = [
      [p.x - 48, p.y - 48],
      [p.x + 48, p.y + 48],
    ];
    const zoneHits = [
      ...(map.getLayer("otm-zone")
        ? map.queryRenderedFeatures(box, { layers: ["otm-zone"] })
        : []),
      ...(map.getLayer("otm-cover")
        ? map.queryRenderedFeatures(box, { layers: ["otm-cover"] })
        : []),
      ...(map.getLayer("otm-park")
        ? map.queryRenderedFeatures(box, { layers: ["otm-park"] })
        : []),
      ...(map.getLayer("zoning-fill")
        ? map.queryRenderedFeatures(box, { layers: ["zoning-fill"] })
        : []),
    ];
    const klass = String(zoneHits[0]?.properties?.class ?? "");
    const countLayer = (id: string) =>
      map.getLayer(id) ? map.queryRenderedFeatures(box, { layers: [id] }).length : 0;
    return {
      lng: center.lng,
      lat: center.lat,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      zoneClass: klass || null,
      zoneLabel: klass ? zoneLabel(klass) : "No zone in view",
      quakes: countLayer("quakes"),
      transit: countLayer("transit"),
      wildlife: countLayer("wildlifeLive") + countLayer("wildlife"),
      plants: countLayer("plantsLive") + countLayer("otm-plants"),
      events: countLayer("events"),
      alerts: countLayer("alerts"),
    };
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn({ duration: 180 }),
    zoomOut: () => mapRef.current?.zoomOut({ duration: 180 }),
    reset: () => {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({
        center: [HOME_VIEW.lng, HOME_VIEW.lat],
        zoom: HOME_VIEW.zoom,
        bearing: 0,
        pitch: 0,
        duration: 500,
      });
    },
    flyTo: (lng: number, lat: number, zoom = 16.5) => {
      mapRef.current?.easeTo({
        center: [lng, lat],
        zoom,
        duration: 700,
      });
    },
    enterWalk: (lng?: number, lat?: number) => {
      const map = mapRef.current;
      if (!map) return;
      const center = map.getCenter();
      const low = map.getZoom() < 8 && lng == null;
      map.easeTo({
        center: [lng ?? (low ? DISTRICT_VIEW.lng : center.lng), lat ?? (low ? DISTRICT_VIEW.lat : center.lat)],
        zoom: Math.max(map.getZoom(), 17.2),
        pitch: 68,
        duration: 800,
      });
    },
    dropToDistricts: (zoneClass?: string | null) => {
      const map = mapRef.current;
      if (!map) return;
      const spot =
        (zoneClass && DISTRICT_SPOTS[zoneClass]) ||
        (map.getZoom() < 8 ? DISTRICT_VIEW : null);
      const center = map.getCenter();
      map.jumpTo({
        center: spot
          ? [spot.lng, spot.lat]
          : [center.lng, center.lat],
        zoom: spot?.zoom ?? Math.max(map.getZoom(), DISTRICT_VIEW.zoom),
        bearing: 0,
        pitch: 0,
      });
    },
    holdKey: (code: string, down: boolean) => {
      if (down) keysRef.current.add(code);
      else keysRef.current.delete(code);
    },
    setHeldKeys: (codes: string[]) => {
      keysRef.current = new Set(codes);
    },
    queryScene: () => sampleScene(),
    getYaw: () => {
      const bearing = mapRef.current?.getBearing() ?? 0;
      return (-bearing * Math.PI) / 180;
    },
    getSpeed: () => speedRef.current,
  }));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      onSizeChange?.({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(280, Math.floor(rect.height)),
      });
      mapRef.current?.resize();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onSizeChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;
    const blockScroll = (event: TouchEvent) => {
      event.preventDefault();
    };

    const start = async () => {
      const ml = await import("maplibre-gl");
      try {
        const worker = await import(
          "maplibre-gl/dist/maplibre-gl-worker.mjs?url"
        );
        ml.setWorkerUrl(worker.default);
      } catch {
        /* parse tiles on the main thread */
      }
      if (cancelled || !hostRef.current) return;
      map = new ml.Map({
        container: hostRef.current,
        style: buildStyle(),
        center: [HOME_VIEW.lng, HOME_VIEW.lat],
        zoom: HOME_VIEW.zoom,
        minZoom: 0.6,
        maxZoom: 19,
        maxPitch: 85,
        attributionControl: { compact: true },
        cooperativeGestures: false,
        dragRotate: false,
        dragPan: true,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        fadeDuration: 0,
        cancelPendingTileRequestsWhileZooming: true,
      });
      mapRef.current = map;
      map.touchZoomRotate.enable();
      map.touchPitch.disable();
      hostRef.current.style.touchAction = "none";
      hostRef.current.addEventListener("touchmove", blockScroll, {
        passive: false,
      });
      wrapRef.current?.addEventListener("touchmove", blockScroll, {
        passive: false,
      });

      map.on("error", (event: { error?: { message?: string } }) => {
        const msg = event.error?.message ?? "";
        if (/webgl|context lost|Failed to initialize/i.test(msg)) {
          setLoadError("Map engine failed. Showing local globe.");
          setUseFallback(true);
        }
      });

      const emitView = () => {
        if (!map) return;
        const center = map.getCenter();
        onTransform({ x: 0, y: 0, k: map.getZoom() });
        onRotation({ lambda: -center.lng, phi: -center.lat });
      };

      map.on("load", () => {
        if (!map) return;
        try {
          map.setProjection({ type: "globe" });
        } catch {
          /* globe is optional */
        }
        try {
          map.setSky({
            "sky-color": "#05060a",
            "horizon-color": "#0c1820",
            "fog-color": "#05060a",
            "fog-ground-blend": 0.9,
            "horizon-fog-blend": 0.95,
            "sky-horizon-blend": 0.85,
            "atmosphere-blend": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              1,
              4,
              0.85,
              6,
              0,
            ],
          });
        } catch {
          /* sky is optional */
        }
        map.setRenderWorldCopies(false);
        map.resize();
        emitView();
        setReady(true);
      });

      window.setTimeout(() => {
        if (cancelled) return;
        if (
          map &&
          !map.loaded() &&
          !hostRef.current?.querySelector("canvas.maplibregl-canvas")
        ) {
          setUseFallback(true);
        }
      }, 7000);
      map.on("move", emitView);
      map.on("zoomend", () => {
        if (!map) return;
        if (map.getZoom() < 6.5 && !isCoarsePointer()) return;
        if (hoverRef.current) {
          try {
            map.setFeatureState(
              { source: "countries", id: hoverRef.current },
              { hover: false },
            );
          } catch {
            /* source may not be ready */
          }
          hoverRef.current = null;
        }
        hoverCbRef.current(null);
      });

      map.on("click", (event: MapMouseEvent) => {
        if (!map) return;
        hoverCbRef.current(null);
        const activeMap = map;
        const { lng, lat } = event.lngLat;
        const present = HIT_LAYERS.filter((id) => Boolean(activeMap.getLayer(id)));
        const hits = present.length
          ? activeMap.queryRenderedFeatures(event.point, { layers: present })
          : [];
        const pointHit = hits.find((hit) => POINT_HIT_LAYERS.includes(hit.layer.id));
        const areaHit = hits.find((hit) => AREA_HIT_LAYERS.includes(hit.layer.id));
        const ov = overlaysRef.current;
        const zoom = activeMap.getZoom();
        const ground = countryAtLngLat(rawRef.current, lng, lat);
        const groundName = ground?.name ?? null;

        const pickObject = (object: MapObject) => {
          onSelect(null);
          pickRef.current?.(withGround(object, groundName));
        };

        const inspectCountryHere = () => {
          pickRef.current?.(null);
          const groundMode =
            ov.zoning || ov.wildlife || ov.plants || ov.plots || ov.livestock || ov.quakes || zoom >= 5;
          if (!ground || groundMode) {
            onSelect(null);
            return;
          }
          onSelect(ground.id === selectedRef.current ? null : ground.id);
        };

        if (pointHit) {
          pickObject(featureToObject(pointHit, pointHit.layer.id, event.lngLat));
          return;
        }

        if (ov.plots && zoom >= 12) {
          const extra = areaHit
            ? featureToObject(areaHit, areaHit.layer.id, event.lngLat)
            : null;
          if (extra && extra.kind !== "country") pickObject(extra);
          else pickObject({
            kind: "plot",
            title: "Looking up site",
            detail: "Reverse-geocoding this lot.",
            layer: "Plots",
            lng,
            lat,
          });
          liveNoteRef.current?.("Looking up site address…");
          void (async () => {
            try {
              const res = await fetch(`/api/live?kind=lookup&lng=${lng}&lat=${lat}`);
              if (!res.ok) return;
              const data = (await res.json()) as GeoJSON.FeatureCollection;
              const feat = data.features?.[0];
              if (!feat) return;
              const looked = featureToObject(feat, "plots-point", event.lngLat);
              if (extra?.facts?.length) {
                const seen = new Set((looked.facts ?? []).map((f) => f.label));
                looked.facts = [
                  ...(looked.facts ?? []),
                  ...extra.facts.filter((f) => !seen.has(f.label)),
                ];
              }
              pickObject(looked);
            } catch {
              /* keep extra */
            }
          })();
          return;
        }

        if (areaHit) {
          pickObject(featureToObject(areaHit, areaHit.layer.id, event.lngLat));
          return;
        }

        const densityKind = ov.plants
          ? "plants"
          : ov.wildlife
          ? "wildlife"
          : ov.livestock
            ? "livestock"
            : ov.quakes
              ? "quakes"
              : null;
        if (densityKind) {
          pickObject(densityObject(densityKind, lng, lat));
          if (densityKind === "quakes") return;
          const pad = Math.max(0.06, 0.45 / Math.pow(2, Math.max(0, zoom - 5)));
          const bbox = `west=${lng - pad}&south=${lat - pad}&east=${lng + pad}&north=${lat + pad}&zoom=12`;
          liveNoteRef.current?.("Looking up nearby sightings…");
          void (async () => {
            try {
              const res = await fetch(`/api/live?kind=${densityKind}&${bbox}`);
              if (!res.ok) return;
              const data = (await res.json()) as GeoJSON.FeatureCollection;
              const nearest = closestFeature(data.features ?? [], lng, lat);
              if (nearest) {
                pickObject(
                  featureToObject(nearest, `${densityKind}Live`, event.lngLat),
                );
              }
            } catch {
              /* keep density cell */
            }
          })();
          return;
        }

        if (ov.zoning && zoom >= 6) {
          pickObject({
            kind: "zone",
            title: "No tagged zone",
            detail:
              "OpenStreetMap has no land-use or landcover polygon under this tap. Satellite still shows the ground.",
            layer: "Zoning",
            source: "OpenStreetMap via OpenFreeMap",
            facts: [{ label: "Layer", value: "Zoning" }],
            lng,
            lat,
          });
          return;
        }

        if (ground && zoom < 5 && ov.metric) {
          inspectCountryHere();
          return;
        }

        onSelect(null);
        pickRef.current?.(null);
      });

      map.on("mousemove", "choropleth", (event: MapLayerMouseEvent) => {
        if (!map) return;
        const active = map;
        const ov = overlaysRef.current;
        const hideCountry =
          isCoarsePointer() ||
          ov.zoning ||
          ov.wildlife ||
          ov.plants ||
          ov.livestock ||
          ov.quakes ||
          active.getZoom() >= 6.5;
        if (hideCountry) {
          if (hoverRef.current) {
            map.setFeatureState(
              { source: "countries", id: hoverRef.current },
              { hover: false },
            );
            hoverRef.current = null;
          }
          hoverCbRef.current(null);
          return;
        }
        const overlayHits = POINT_HIT_LAYERS.concat(AREA_HIT_LAYERS).filter((id) =>
          Boolean(active.getLayer(id)),
        );
        if (
          overlayHits.length &&
          map.queryRenderedFeatures(event.point, { layers: overlayHits }).length
        ) {
          return;
        }
        map.getCanvas().style.cursor = "pointer";
        const feat = event.features?.[0];
        const iso = String(feat?.id ?? feat?.properties?.iso ?? "");
        const name = String(feat?.properties?.name ?? "Unknown");
        if (hoverRef.current && hoverRef.current !== iso) {
          map.setFeatureState(
            { source: "countries", id: hoverRef.current },
            { hover: false },
          );
        }
        if (iso) {
          map.setFeatureState({ source: "countries", id: iso }, { hover: true });
          hoverRef.current = iso;
        }
        hoverCbRef.current({
          country: lookupCountry({
            id: iso,
            properties: { name },
          }),
          atlasName: name,
          x: event.point.x,
          y: event.point.y,
          place: undefined,
        });
      });
      map.on("mouseleave", "choropleth", () => {
        if (!map) return;
        map.getCanvas().style.cursor = "";
        if (hoverRef.current) {
          map.setFeatureState(
            { source: "countries", id: hoverRef.current },
            { hover: false },
          );
          hoverRef.current = null;
        }
        hoverCbRef.current(null);
      });

      map.on("mousemove", "quakes", (event: MapLayerMouseEvent) => {
        if (!map) return;
        const feat = event.features?.[0];
        if (!feat) return;
        if (isCoarsePointer()) return;
        map.getCanvas().style.cursor = "pointer";
        const mag = Number(feat.properties?.mag ?? 0);
        const place = String(feat.properties?.place ?? "Earthquake");
        const time = Number(feat.properties?.time ?? 0);
        const when = time
          ? new Date(time).toISOString().slice(11, 16) + " UTC"
          : "";
        hoverCbRef.current({
          country: undefined,
          atlasName: place,
          x: event.point.x,
          y: event.point.y,
          live: {
            kind: "quake",
            title: `M ${mag.toFixed(1)}`,
            detail: when ? `${place} · ${when}` : place,
          },
        });
      });
      map.on("mouseleave", "quakes", () => {
        hoverCbRef.current(null);
      });

      const bindLiveLayer = (
        layer: string,
        kind: HoverInfo["live"] extends infer T
          ? T extends { kind: infer K }
            ? K
            : never
          : never,
      ) => {
        map?.on("mousemove", layer, (event: MapLayerMouseEvent) => {
          const feat = event.features?.[0];
          if (!feat || !map) return;
          if (isCoarsePointer()) return;
          map.getCanvas().style.cursor = "pointer";
          const title = String(feat.properties?.title ?? layer);
          const detail = String(feat.properties?.detail ?? "");
          const hoverKind = (String(feat.properties?.kind ?? kind) as typeof kind);
          hoverCbRef.current({
            country: undefined,
            atlasName: title,
            x: event.point.x,
            y: event.point.y,
            live: { kind: hoverKind, title, detail },
          });
        });
        map?.on("mouseleave", layer, () => {
          if (map) map.getCanvas().style.cursor = "";
          hoverCbRef.current(null);
        });
      };
      bindLiveLayer("transit", "transit");
      bindLiveLayer("flights", "flight");
      bindLiveLayer("alerts", "alert");
      bindLiveLayer("events", "event");
      bindLiveLayer("wildlife", "trail");
      bindLiveLayer("livestock", "trail");
      bindLiveLayer("wildlifeLive", "sighting");
      bindLiveLayer("plantsLive", "plant");
      bindLiveLayer("otm-plants", "plant");
      bindLiveLayer("livestockLive", "sighting");
      bindLiveLayer("health", "health");
      bindLiveLayer("osm-point", "rail");
      bindLiveLayer("osm-line", "rail");
      bindLiveLayer("osm-fill", "farm");
      bindLiveLayer("otm-rail", "rail");
      bindLiveLayer("otm-station", "rail");
      bindLiveLayer("otm-farm", "farm");
      bindLiveLayer("otm-building", "building");
      bindLiveLayer("otm-housenumber", "address");
      bindLiveLayer("otm-zone", "zone");
      bindLiveLayer("otm-cover", "zone");
      bindLiveLayer("otm-park", "zone");
      bindLiveLayer("zoning-fill", "zone");
      bindLiveLayer("zoning-line", "zone");
      bindLiveLayer("zoning-point", "zone");
      bindLiveLayer("plots-fill", "plot");
      bindLiveLayer("plots-line", "plot");
      bindLiveLayer("plots-point", "address");
    };

    void start();

    return () => {
      cancelled = true;
      hostRef.current?.removeEventListener("touchmove", blockScroll);
      wrapRef.current?.removeEventListener("touchmove", blockScroll);
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      map.setProjection({ type: globe ? "globe" : "mercator" });
    } catch {
      /* projection swap is best-effort */
    }
  }, [globe, walking, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (walking) {
      map.keyboard.disable();
      map.dragRotate.enable();
      map.touchPitch.enable();
      if (map.getPitch() < 40) {
        map.easeTo({
          pitch: 68,
          zoom: Math.max(map.getZoom(), 17.1),
          duration: 700,
        });
      }
    } else {
      keysRef.current.clear();
      speedRef.current = 0;
      map.keyboard.enable();
      map.dragRotate.disable();
      map.touchPitch.disable();
      if (map.getPitch() > 5) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
      }
    }
  }, [walking, ready]);

  useEffect(() => {
    if (!walking || !ready) return;
    const map = mapRef.current;
    if (!map) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const held = keysRef.current;
      let steer = 0;
      if (held.has("KeyA") || held.has("ArrowLeft")) steer += 1;
      if (held.has("KeyD") || held.has("ArrowRight")) steer -= 1;
      let throttle = 0;
      if (held.has("KeyW") || held.has("ArrowUp")) throttle += 1;
      if (held.has("KeyS") || held.has("ArrowDown")) throttle -= 1;
      if (steer !== 0) {
        map.setBearing(wrapBearing(map.getBearing() - steer * 110 * dt));
      }
      const speed = throttle * (throttle > 0 ? 14 : 8);
      speedRef.current = Math.abs(speed);
      if (throttle !== 0) {
        const center = map.getCenter();
        const next = destination(center.lng, center.lat, map.getBearing(), speed * dt);
        map.setCenter([next.lng, next.lat]);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (
        event.code === "KeyW" ||
        event.code === "KeyA" ||
        event.code === "KeyS" ||
        event.code === "KeyD" ||
        event.code.startsWith("Arrow")
      ) {
        event.preventDefault();
        keysRef.current.add(event.code);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };
    const clear = () => keysRef.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    const probe = {
      getYaw: () => {
        const bearing = mapRef.current?.getBearing() ?? 0;
        return (-bearing * Math.PI) / 180;
      },
      getSpeed: () => speedRef.current,
      setKeys: (codes: string[]) => {
        keysRef.current = new Set(codes);
      },
    };
    window.__controlsTest = probe;
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      if (window.__controlsTest === probe) delete window.__controlsTest;
    };
  }, [walking, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const emit = () => onSceneRef.current?.(sampleScene());
    emit();
    map.on("moveend", emit);
    const id = window.setInterval(emit, 2500);
    return () => {
      map.off("moveend", emit);
      window.clearInterval(id);
    };
  }, [ready, overlays, zoneFilter, walking]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("memory") as GeoJSONSource | undefined;
    src?.setData(patchesToGeoJSON(patches));
  }, [patches, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("marble", "visibility", "visible");
    map.setLayoutProperty("imagery", "visibility", "visible");
    (Object.keys(OVERLAY_LAYERS) as Array<keyof OverlayState>).forEach((id) => {
      const show = overlays[id];
      for (const layer of OVERLAY_LAYERS[id]) {
        if (!map.getLayer(layer)) continue;
        map.setLayoutProperty(layer, "visibility", show ? "visible" : "none");
      }
    });
    const ground = overlays.rail || overlays.livestock;
    if (map.getLayer("osm-line")) {
      map.setLayoutProperty("osm-line", "visibility", ground ? "visible" : "none");
      const kinds = [
        ...(overlays.rail ? ["rail"] : []),
        ...(overlays.livestock ? ["fence", "farm"] : []),
      ];
      map.setFilter("osm-line", [
        "all",
        ["==", ["geometry-type"], "LineString"],
        ["in", ["get", "kind"], ["literal", kinds.length ? kinds : ["rail"]]],
      ]);
    }
    if (map.getLayer("osm-point")) {
      map.setLayoutProperty("osm-point", "visibility", ground ? "visible" : "none");
      const kinds = [
        ...(overlays.rail ? ["rail"] : []),
        ...(overlays.livestock ? ["farm"] : []),
      ];
      map.setFilter("osm-point", [
        "all",
        ["==", ["geometry-type"], "Point"],
        ["in", ["get", "kind"], ["literal", kinds.length ? kinds : ["rail"]]],
      ]);
    }
    if (map.getLayer("osm-fill")) {
      map.setLayoutProperty(
        "osm-fill",
        "visibility",
        overlays.livestock ? "visible" : "none",
      );
    }
    if (map.getLayer("otm-building-3d")) {
      map.setLayoutProperty(
        "otm-building-3d",
        "visibility",
        walking || overlays.plots ? "visible" : "none",
      );
    }
    const dim = radarDimFactor(overlays);
    if (map.getLayer("transit")) {
      map.setPaintProperty("transit", "circle-opacity", 0.92 * dim);
    }
    if (map.getLayer("flights")) {
      map.setPaintProperty("flights", "circle-opacity", 0.85 * dim);
    }
    if (map.getLayer("wildlifeLive")) {
      map.setPaintProperty("wildlifeLive", "circle-opacity", 0.85 * dim);
    }
    if (map.getLayer("plantsLive")) {
      map.setPaintProperty("plantsLive", "circle-opacity", 0.9 * dim);
    }
    const landuseHit = ZONE_SWATCHES.find((s) => s.id === zoneFilter && s.group === "landuse");
    const coverHit = ZONE_SWATCHES.find((s) => s.id === zoneFilter && s.group === "cover");
    const landuseClasses =
      zoneFilter == null ? LANDUSE_CLASS_FILTER : (landuseHit?.classes ?? ["__none__"]);
    const coverClasses =
      zoneFilter == null ? COVER_CLASS_FILTER : (coverHit?.classes ?? ["__none__"]);
    if (map.getLayer("otm-zone")) {
      map.setFilter("otm-zone", ["match", ["get", "class"], landuseClasses, true, false]);
    }
    if (map.getLayer("otm-zone-line")) {
      map.setFilter("otm-zone-line", [
        "match",
        ["get", "class"],
        landuseClasses,
        true,
        false,
      ]);
    }
    if (map.getLayer("otm-cover")) {
      map.setFilter("otm-cover", ["match", ["get", "class"], coverClasses, true, false]);
    }
    const hideMetric =
      overlays.zoning || overlays.wildlife || overlays.plants || overlays.livestock || overlays.quakes;
    if (map.getLayer("choropleth")) {
      map.setPaintProperty(
        "choropleth",
        "fill-opacity",
        hideMetric
          ? [
              "interpolate",
              ["linear"],
              ["zoom"],
              2,
              0.08,
              6,
              0.03,
              7.5,
              0,
            ]
          : [
              "interpolate",
              ["linear"],
              ["zoom"],
              2,
              0.28,
              6.5,
              0.12,
              8.5,
              0,
            ],
      );
    }
  }, [overlays, ready, globe, walking, zoneFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !overlays.radar) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch(RAINVIEWER_MAPS);
        if (!res.ok) return;
        const data = (await res.json()) as Parameters<typeof radarTileUrl>[0];
        const tiles = radarTileUrl(data);
        if (cancelled || !tiles) return;
        const source = map.getSource("radar") as RasterTileSource | undefined;
        source?.setTiles([tiles]);
        liveNoteRef.current?.("Radar updated just now");
      } catch {
        /* keep last frame */
      }
    };
    void pull();
    const id = window.setInterval(pull, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [overlays.radar, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !overlays.quakes) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch(QUAKES_URL);
        if (!res.ok) return;
        const data = (await res.json()) as GeoJSON.GeoJSON;
        if (cancelled) return;
        (map.getSource("quakes") as GeoJSONSource | undefined)?.setData(data);
        const count = Array.isArray((data as GeoJSON.FeatureCollection).features)
          ? (data as GeoJSON.FeatureCollection).features.length
          : 0;
        liveNoteRef.current?.(`${count} quakes · last 24h`);
      } catch {
        /* keep last points */
      }
    };
    void pull();
    const id = window.setInterval(pull, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [overlays.quakes, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const kinds = [
      "transit",
      "flights",
      "alerts",
      "events",
      "wildlife",
      "livestock",
      "plants",
      "health",
    ] as const;
    const active = kinds.filter((kind) => overlays[kind]);
    if (active.length === 0 && !overlays.rail && !overlays.livestock && !overlays.plots && !overlays.zoning)
      return;
    let cancelled = false;
    const sourceFor = (kind: (typeof kinds)[number]) =>
      kind === "wildlife"
        ? "wildlifeLive"
        : kind === "livestock"
          ? "livestockLive"
          : kind === "plants"
            ? "plantsLive"
            : kind;

    const pull = async () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const bbox = `west=${bounds.getWest()}&south=${bounds.getSouth()}&east=${bounds.getEast()}&north=${bounds.getNorth()}&zoom=${zoom.toFixed(2)}`;
      const notes: string[] = [];
      await Promise.all(
        active.map(async (kind) => {
          try {
            const res = await fetch(`/api/live?kind=${kind}&${bbox}`);
            if (!res.ok) return;
            const data = (await res.json()) as GeoJSON.FeatureCollection & {
              count?: number;
            };
            if (cancelled) return;
            (map.getSource(sourceFor(kind)) as GeoJSONSource | undefined)?.setData(
              data,
            );
            notes.push(`${data.count ?? data.features.length} ${kind}`);
          } catch {
            /* keep last */
          }
        }),
      );
      if (overlays.rail || overlays.livestock) {
        try {
          const res = await fetch(`/api/live?kind=osm&${bbox}`);
          if (res.ok) {
            const data = (await res.json()) as GeoJSON.FeatureCollection & {
              count?: number;
            };
            if (!cancelled) {
              (map.getSource("osm") as GeoJSONSource | undefined)?.setData(data);
              notes.push(`${data.count ?? data.features.length} osm`);
            }
          }
        } catch {
          /* keep last */
        }
      }
      if (overlays.plots) {
        const zoom = map.getZoom();
        if (zoom < 13) {
          notes.push("Zoom in for lot lines");
        } else {
          try {
            const res = await fetch(`/api/live?kind=plots&${bbox}`);
            if (res.ok) {
              const data = (await res.json()) as GeoJSON.FeatureCollection & {
                count?: number;
              };
              if (!cancelled) {
                (map.getSource("plots") as GeoJSONSource | undefined)?.setData(data);
                notes.push(`${data.count ?? data.features.length} plots`);
              }
            }
          } catch {
            /* keep last */
          }
        }
      }
      if (overlays.zoning) {
        const zoom = map.getZoom();
        if (zoom < 8) {
          notes.push("Districts load below ~40 km — drop in");
        } else if (zoom >= 11) {
          try {
            const res = await fetch(`/api/live?kind=zoning&${bbox}`);
            if (res.ok) {
              const data = (await res.json()) as GeoJSON.FeatureCollection & {
                count?: number;
              };
              if (!cancelled) {
                (map.getSource("zoning") as GeoJSONSource | undefined)?.setData(data);
                const n = data.count ?? data.features.length;
                if (n > 0) notes.push(`${n} OSM districts`);
                else notes.push("Land-use tiles · no legal codes here");
              }
            }
          } catch {
            notes.push("Land-use zones");
          }
        } else {
          notes.push("Land-use zones");
        }
      }
      if (!cancelled && notes.length) liveNoteRef.current?.(notes.join(" · "));
    };

    void pull();
    const id = window.setInterval(pull, 20000);
    const onMove = () => {
      window.clearTimeout((onMove as { t?: number }).t);
      (onMove as { t?: number }).t = window.setTimeout(() => void pull(), 700);
    };
    map.on("moveend", onMove);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      map.off("moveend", onMove);
    };
  }, [
    overlays.transit,
    overlays.flights,
    overlays.alerts,
    overlays.events,
    overlays.wildlife,
    overlays.livestock,
    overlays.plants,
    overlays.health,
    overlays.rail,
    overlays.plots,
    overlays.zoning,
    ready,
  ]);

  useEffect(() => {
    const el = wrapRef.current;
    const map = mapRef.current;
    if (!el || !map || !ready) return;
    let cancelled = false;
    loadCountries("/geo/countries-50m.json")
      .then((fc) => {
        if (cancelled) return;
        rawRef.current = fc;
        const painted = colorFeatures(fc, metric, scale, el);
        const source = map.getSource("countries") as GeoJSONSource | undefined;
        source?.setData(painted as GeoJSON.GeoJSON);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load map.");
        }
      });
    return () => {
      cancelled = true;
    };
    // initial 50m; metric updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    const el = wrapRef.current;
    if (!map || !el || !ready) return;

    const maybeHiRes = () => {
      if (detailRef.current || map.getZoom() < 5) return;
      detailRef.current = true;
      loadCountries("/geo/countries-10m.json")
        .then((fc) => {
          if (!wrapRef.current || !mapRef.current) return;
          rawRef.current = fc;
          const painted = colorFeatures(
            fc,
            metricRef.current,
            scaleRef.current,
            wrapRef.current,
          );
          (mapRef.current.getSource("countries") as GeoJSONSource | undefined)?.setData(
            painted as GeoJSON.GeoJSON,
          );
        })
        .catch(() => {
          detailRef.current = false;
        });
    };

    map.on("zoomend", maybeHiRes);
    maybeHiRes();
    return () => {
      map.off("zoomend", maybeHiRes);
    };
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    const el = wrapRef.current;
    const raw = rawRef.current;
    if (!map || !el || !raw || !ready) return;
    const painted = colorFeatures(raw, metric, scale, el);
    (map.getSource("countries") as GeoJSONSource | undefined)?.setData(
      painted as GeoJSON.GeoJSON,
    );
  }, [metric, scale, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selectedRef.current) {
      map.setFeatureState(
        { source: "countries", id: selectedRef.current },
        { selected: false },
      );
    }
    selectedRef.current = selectedId;
    if (selectedId) {
      map.setFeatureState({ source: "countries", id: selectedId }, { selected: true });
    }
  }, [selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const raw = rawRef.current;
    if (!map || !ready || !flyToId || !raw) return;
    const feat = raw.features.find(
      (f) => String(f.id) === flyToId,
    ) as CountryFeature | undefined;
    if (!feat) return;
    const [[west, south], [east, north]] = geoBounds(feat);
    if (![west, south, east, north].every(Number.isFinite)) return;
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 64, duration: 700, maxZoom: 7.5, essential: true },
    );
  }, [flyToId, flyNonce, ready]);

  if (useFallback) {
    return (
      <GlobeFallback
        metric={metric}
        scale={scale}
        selectedId={selectedId}
        onSelect={onSelect}
        onHover={onHover}
        onTransform={(next) => onTransform(next)}
        flyToId={flyToId}
        flyNonce={flyNonce}
        viewMode={viewMode}
        rotation={rotation}
        onRotation={onRotation}
        onSizeChange={onSizeChange}
      />
    );
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative h-full w-full touch-none overflow-hidden",
        globe || walking ? "bg-void" : "bg-ocean",
      )}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {ready ? null : (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-border border-t-primary animate-spin" />
        </div>
      )}
      {loadError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-muted">
          {loadError}
        </div>
      ) : null}
    </div>
  );
});

export function resetTransform(): MapTransform {
  return { x: 0, y: 0, k: HOME_VIEW.zoom };
}

export function zoomIn(transform: MapTransform): MapTransform {
  return { ...transform, k: Math.min(18, transform.k + 1) };
}

export function zoomOut(transform: MapTransform): MapTransform {
  return { ...transform, k: Math.max(0.6, transform.k - 1) };
}

export { HOME_ROTATION };
