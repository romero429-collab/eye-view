import type { Feature, FeatureCollection, LineString } from "geojson";

function line(
  title: string,
  detail: string,
  coordinates: [number, number][],
): Feature<LineString> {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: { title, detail, kind: "trail", source: "Mapped corridor" },
  };
}

export const WILD_TRAILS: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [
    line("Pacific Flyway", "Waterfowl · Alaska to Mexico", [
      [-152, 66], [-145, 61], [-135, 57], [-130, 52], [-124, 48],
      [-124, 42], [-122, 37], [-118, 34], [-115, 29], [-110, 24], [-105, 20],
    ]),
    line("Central Flyway", "Waterfowl · Prairie Canada to Gulf", [
      [-110, 58], [-108, 52], [-104, 46], [-102, 41], [-100, 36],
      [-98, 31], [-97, 27], [-96, 24],
    ]),
    line("Mississippi Flyway", "Songbirds · Hudson Bay to Gulf", [
      [-90, 58], [-92, 52], [-93, 46], [-91, 41], [-90, 36],
      [-91, 32], [-90, 29], [-89, 24],
    ]),
    line("Atlantic Flyway", "Shorebirds · Arctic to Caribbean", [
      [-68, 70], [-70, 60], [-68, 50], [-74, 42], [-76, 36],
      [-80, 27], [-78, 21], [-72, 18],
    ]),
    line("East Atlantic Flyway", "Waders · Arctic to West Africa", [
      [20, 72], [10, 64], [5, 56], [2, 48], [-2, 40],
      [-8, 32], [-16, 20], [-16, 14],
    ]),
    line("East Asian–Australasian Flyway", "Shorebirds · Siberia to Australia", [
      [140, 68], [135, 55], [128, 42], [121, 32], [114, 22],
      [106, 8], [128, -12], [140, -18], [151, -27],
    ]),
    line("Gray whale", "Pacific · Arctic to Baja", [
      [-165, 69], [-165, 64], [-161, 58], [-152, 58], [-140, 58],
      [-130, 52], [-124, 48], [-124, 40], [-118, 32], [-114, 27], [-112, 24],
    ]),
    line("Humpback (Pacific)", "Calving grounds · Alaska to Hawaii / Mexico", [
      [-145, 58], [-150, 50], [-155, 40], [-157, 28], [-156, 21],
    ]),
    line("Wildebeest circuit", "Serengeti–Mara migration", [
      [34.8, -2.4], [35.2, -2.0], [35.3, -1.5], [35.0, -1.25],
      [34.7, -1.4], [34.5, -1.9], [34.6, -2.3], [34.8, -2.4],
    ]),
    line("Caribou (Porcupine)", "Arctic National Wildlife Refuge", [
      [-148, 70], [-145, 69], [-142, 68], [-140, 67], [-141, 66],
      [-144, 66.5], [-147, 67.5], [-148, 69],
    ]),
    line("Monarch butterfly", "Eastern population · Canada to Michoacán", [
      [-80, 46], [-84, 42], [-88, 38], [-92, 34], [-97, 30],
      [-100, 26], [-101, 20],
    ]),
    line("KAZA elephant", "Okavango–Chobe–Kafue corridor", [
      [22.5, -19.2], [23.8, -18.4], [25.2, -17.8], [26.5, -17.0], [27.8, -16.0],
    ]),
    line("Yellowstone to Yukon", "Y2Y wildlife corridor", [
      [-110.6, 44.6], [-113, 47], [-115, 50], [-118, 53], [-122, 56],
      [-128, 59], [-135, 62],
    ]),
    line("Pronghorn (Path of the Pronghorn)", "Greater Yellowstone", [
      [-110.8, 43.6], [-110.5, 43.2], [-110.2, 42.7], [-109.8, 42.3],
    ]),
    line("Mule deer (Wyoming Range)", "Western ungulate corridor", [
      [-110.9, 42.8], [-110.6, 42.2], [-110.2, 41.6], [-109.7, 41.1],
    ]),
    line("Sandhill crane", "Platte River staging", [
      [-106, 53], [-105, 48], [-103, 43], [-100, 41], [-98, 38],
      [-97, 34], [-96, 28],
    ]),
  ],
};

export const DOMESTIC_TRAILS: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [
    line("Chisholm Trail", "Cattle drive · Texas to Kansas", [
      [-97.4, 28.0], [-97.3, 29.4], [-97.4, 31.1], [-97.5, 33.2],
      [-97.3, 35.5], [-97.2, 37.0], [-97.3, 38.4],
    ]),
    line("Goodnight–Loving Trail", "Cattle · Texas to Colorado / Wyoming", [
      [-100.5, 32.2], [-103.2, 32.0], [-104.5, 33.4], [-104.8, 36.2],
      [-105.0, 38.3], [-105.5, 41.1], [-106.3, 42.8],
    ]),
    line("Santa Fe livestock road", "Sheep & cattle · New Mexico", [
      [-106.1, 35.7], [-105.9, 35.2], [-105.2, 34.4], [-104.5, 33.4],
      [-103.7, 32.3],
    ]),
    line("Camino Real de Tierra Adentro", "Colonial livestock · Mexico to Santa Fe", [
      [-99.1, 19.4], [-100.3, 20.7], [-101.0, 22.2], [-102.3, 24.0],
      [-104.7, 26.9], [-106.5, 31.8], [-106.5, 32.8], [-106.0, 35.7],
    ]),
    line("Pyrenean transhumance", "Sheep · Spain / France", [
      [1.0, 42.0], [0.5, 42.5], [0.2, 42.8], [0.8, 43.0], [1.5, 42.7],
    ]),
    line("Alpine transhumance", "Cattle · Austria / Italy / Switzerland", [
      [7.4, 46.0], [8.2, 46.4], [9.8, 46.6], [11.4, 46.8], [13.0, 47.0],
    ]),
    line("Sahel cattle corridor", "Transhumance · West Africa", [
      [-15.5, 16.0], [-12.0, 15.4], [-7.5, 14.8], [-3.0, 14.2],
      [2.1, 13.5], [7.5, 13.0], [12.0, 12.4],
    ]),
    line("Mongolian herding route", "Nomadic livestock · steppe", [
      [96, 48], [100, 47.5], [105, 47.2], [110, 47.5], [115, 48],
    ]),
    line("Australian stock route", "Cattle droving · Queensland to NSW", [
      [144.2, -20.0], [145.8, -23.5], [147.2, -26.8], [148.5, -30.2],
      [149.1, -32.9], [148.6, -35.0],
    ]),
    line("Silk Road caravan", "Camels · China to Central Asia", [
      [108.9, 34.3], [103.8, 36.0], [98.5, 39.7], [88.1, 43.8],
      [80.3, 41.3], [74.6, 39.5], [69.2, 38.6],
    ]),
    line("Andean llama trail", "High pasture · Peru / Bolivia", [
      [-72.0, -13.5], [-70.0, -15.5], [-68.1, -16.5], [-66.2, -17.4],
    ]),
    line("King's Highway livestock", "Jordan / Levant herding", [
      [35.9, 32.6], [35.7, 31.9], [35.6, 31.0], [35.5, 30.3], [35.5, 29.5],
    ]),
  ],
};
