/** Worldwide weather pictures. Radar only exists where a dish does. The other levels are NASA mosaics. */

export type WeatherLevelId = "radar" | "precip" | "clouds" | "temp" | "sea" | "snow";

export function daysAgo(days: number, now = Date.now()): string {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}

function gibs(layer: string, matrix: string, day: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${day}/${matrix}/{z}/{y}/{x}.png`;
}

export type WeatherLevel = {
  id: WeatherLevelId;
  label: string;
  detail: string;
  tiles: string | null;
  maxzoom: number;
  opacity: number;
  layerId: string;
};

export function weatherLevels(now = Date.now()): WeatherLevel[] {
  return [
    {
      id: "radar",
      label: "Radar",
      detail: "RainViewer composite. Sharp where a radar is online, empty over oceans and much of the world.",
      tiles: null,
      maxzoom: 12,
      opacity: 0.72,
      layerId: "radar",
    },
    {
      id: "precip",
      label: "Precip",
      detail: "NASA IMERG precipitation rate. Worldwide, about a day old, including oceans.",
      tiles: gibs("IMERG_Precipitation_Rate", "GoogleMapsCompatible_Level6", daysAgo(2, now)),
      maxzoom: 6,
      opacity: 0.85,
      layerId: "wx-precip",
    },
    {
      id: "clouds",
      label: "Clouds",
      detail: "MODIS Terra cloud-top temperature. Worldwide daytime cloud field.",
      tiles: gibs("MODIS_Terra_Cloud_Top_Temp_Day", "GoogleMapsCompatible_Level6", daysAgo(2, now)),
      maxzoom: 6,
      opacity: 0.8,
      layerId: "wx-clouds",
    },
    {
      id: "temp",
      label: "Air temp",
      detail: "AIRS surface air temperature. Worldwide, a few days behind the clock.",
      tiles: gibs("AIRS_L3_Surface_Air_Temperature_Daily_Day", "GoogleMapsCompatible_Level6", daysAgo(6, now)),
      maxzoom: 6,
      opacity: 0.72,
      layerId: "wx-temp",
    },
    {
      id: "sea",
      label: "Sea temp",
      detail: "GHRSST sea-surface temperature. Oceans only.",
      tiles: gibs("GHRSST_L4_MUR_Sea_Surface_Temperature", "GoogleMapsCompatible_Level7", daysAgo(2, now)),
      maxzoom: 7,
      opacity: 0.75,
      layerId: "wx-sea",
    },
    {
      id: "snow",
      label: "Snow",
      detail: "MODIS snow cover. Worldwide land, about ten days old.",
      tiles: gibs("MODIS_Terra_NDSI_Snow_Cover", "GoogleMapsCompatible_Level8", daysAgo(10, now)),
      maxzoom: 8,
      opacity: 0.8,
      layerId: "wx-snow",
    },
  ];
}

export const WEATHER_LEVELS = weatherLevels();
