/** US AQI is the worst of the pollutant sub-indexes, not an average.
 *  Bands are the EPA scale. Concentrations are micrograms per cubic meter. */

export type AirFact = { label: string; value: string };

export type AirCurrent = {
  us_aqi?: number;
  european_aqi?: number;
  us_aqi_pm2_5?: number;
  us_aqi_pm10?: number;
  us_aqi_ozone?: number;
  us_aqi_nitrogen_dioxide?: number;
  us_aqi_sulphur_dioxide?: number;
  us_aqi_carbon_monoxide?: number;
  pm2_5?: number;
  pm10?: number;
  ozone?: number;
  nitrogen_dioxide?: number;
  sulphur_dioxide?: number;
  carbon_monoxide?: number;
  dust?: number;
  uv_index?: number;
};

const SUBS: Array<[keyof AirCurrent, string]> = [
  ["us_aqi_ozone", "Ozone"],
  ["us_aqi_pm2_5", "PM2.5"],
  ["us_aqi_pm10", "PM10"],
  ["us_aqi_nitrogen_dioxide", "Nitrogen dioxide"],
  ["us_aqi_sulphur_dioxide", "Sulphur dioxide"],
  ["us_aqi_carbon_monoxide", "Carbon monoxide"],
];

const AMOUNTS: Array<[keyof AirCurrent, string, string]> = [
  ["ozone", "Ozone", "µg/m³"],
  ["pm2_5", "PM2.5", "µg/m³"],
  ["pm10", "PM10", "µg/m³"],
  ["nitrogen_dioxide", "Nitrogen dioxide", "µg/m³"],
  ["sulphur_dioxide", "Sulphur dioxide", "µg/m³"],
  ["carbon_monoxide", "Carbon monoxide", "µg/m³"],
  ["dust", "Dust", "µg/m³"],
];

export function aqiBand(value: number): string {
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Unhealthy for sensitive groups";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}

export function europeanBand(value: number): string {
  if (value <= 20) return "Good";
  if (value <= 40) return "Fair";
  if (value <= 60) return "Moderate";
  if (value <= 80) return "Poor";
  if (value <= 100) return "Very poor";
  return "Extremely poor";
}

export function airDriver(current: AirCurrent): string | null {
  let best: string | null = null;
  let score = -1;
  for (const [key, label] of SUBS) {
    const value = Number(current[key]);
    if (!Number.isFinite(value) || value < score) continue;
    score = value;
    best = label;
  }
  return best;
}

const EFFECT: Record<string, string> = {
  Ozone: "Irritates the airways. Cough, chest tightness, and a shorter breath, worse when you are working outside. Aggravates asthma.",
  "PM2.5": "Reaches the lungs and the blood. Aggravates asthma and heart disease, and can trigger a heart attack in someone already ill.",
  PM10: "Irritates the eyes, nose, and throat. Aggravates asthma and bronchitis.",
  "Nitrogen dioxide": "Inflames the lining of the lungs and lowers resistance to infection. Aggravates asthma.",
  "Sulphur dioxide": "Tightens the airways within minutes. People with asthma wheeze and get short of breath.",
  "Carbon monoxide": "Takes the place of oxygen in the blood. People with heart disease get chest pain sooner.",
};

const SENSITIVE: Record<string, string> = {
  Ozone: "Children, older adults, people with lung disease, and anyone active outdoors",
  "PM2.5": "People with heart or lung disease, older adults, and children",
  PM10: "People with heart or lung disease, older adults, and children",
  "Nitrogen dioxide": "People with asthma, children, and older adults",
  "Sulphur dioxide": "People with asthma",
  "Carbon monoxide": "People with heart disease",
};

export function healthEffect(aqi: number, driver: string | null): { who: string; effect: string } {
  const band = aqiBand(aqi);
  const sensitive = (driver && SENSITIVE[driver]) || "People with heart or lung disease, older adults, and children";
  const effect = (driver && EFFECT[driver]) || "The index is whichever pollutant is worst, not an average.";
  if (band === "Good") {
    return { who: "Little or no risk at this level", effect };
  }
  if (band === "Moderate") {
    return { who: "Unusually sensitive people may notice it", effect };
  }
  if (band === "Unhealthy for sensitive groups") {
    return { who: `${sensitive} may feel it. Most others will not`, effect };
  }
  if (band === "Unhealthy") {
    return { who: `${sensitive} may feel it more seriously. Some others may too`, effect };
  }
  if (band === "Very unhealthy") {
    return { who: "Everyone has a higher chance of effects", effect };
  }
  return { who: "Emergency conditions. Everyone is more likely to be affected", effect };
}

export function airFacts(current: AirCurrent): AirFact[] {
  const facts: AirFact[] = [];
  const aqi = Number(current.us_aqi);
  if (Number.isFinite(aqi)) facts.push({ label: "US AQI", value: `${Math.round(aqi)} · ${aqiBand(aqi)}` });
  const driver = airDriver(current);
  if (driver) facts.push({ label: "Set by", value: driver });
  if (Number.isFinite(aqi)) {
    const health = healthEffect(aqi, driver);
    facts.push({ label: "Who", value: health.who });
    facts.push({ label: "Effect", value: health.effect });
  }
  for (const [key, label, unit] of AMOUNTS) {
    const value = Number(current[key]);
    if (!Number.isFinite(value)) continue;
    facts.push({ label, value: `${value.toFixed(1)} ${unit}` });
  }
  const uv = Number(current.uv_index);
  if (Number.isFinite(uv)) facts.push({ label: "UV", value: uv.toFixed(1) });
  const eu = Number(current.european_aqi);
  if (Number.isFinite(eu)) facts.push({ label: "European AQI", value: `${Math.round(eu)} · ${europeanBand(eu)}` });
  return facts;
}

export const AIR_CURRENT =
  "us_aqi,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_ozone,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,dust,uv_index,european_aqi";

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function monitorMethod(measures: string[]): string {
  const bits: string[] = [];
  if (measures.includes("PM2.5")) bits.push("PM2.5 is usually a beta-attenuation or optical federal equivalent method");
  if (measures.includes("PM10")) bits.push("PM10 is usually a beta-attenuation monitor or a tapered-element balance");
  if (measures.includes("Ozone")) bits.push("ozone is usually an ultraviolet absorption analyzer");
  if (!bits.length) return "Regulatory station. This feed does not name the instrument model.";
  return `Regulatory station, not a handheld sensor. ${bits.join("; ")}.`;
}

export type MonitorSite = {
  name: string;
  lat: number;
  lng: number;
  aqi: number | null;
  facts: AirFact[];
};

export function monitorSite(row: Record<string, unknown>): MonitorSite | null {
  const lat = num(row.Latitude);
  const lng = num(row.Longitude);
  if (lat == null || lng == null) return null;
  const measures = [
    Number(row.PM25_Measured) === 1 ? "PM2.5" : null,
    Number(row.OZONE_Measured) === 1 ? "Ozone" : null,
    Number(row.PM10_Measured) === 1 ? "PM10" : null,
  ].filter((item): item is string => Boolean(item));
  const parts = [
    { name: "PM2.5", aqi: num(row.PM25_AQI), amount: num(row.PM25) },
    { name: "Ozone", aqi: num(row.OZONE_AQI), amount: num(row.OZONE) },
    { name: "PM10", aqi: num(row.PM10_AQI), amount: num(row.PM10) },
  ].filter((part) => measures.includes(part.name));
  const reporting = parts.filter((part) => part.aqi != null && part.aqi >= 0);
  reporting.sort((a, b) => (b.aqi ?? 0) - (a.aqi ?? 0));
  const top = reporting[0];
  const facts: AirFact[] = [
    { label: "Device", value: `${row.MonitorType || "Station"} monitor` },
    { label: "Agency", value: String(row.DataSource || "AirNow") },
    { label: "Measures", value: measures.join(", ") || "Air" },
    { label: "Method", value: monitorMethod(measures) },
  ];
  if (top?.aqi != null) {
    facts.push({ label: "US AQI", value: `${Math.round(top.aqi)} · ${aqiBand(top.aqi)}` });
    facts.push({ label: "Set by", value: top.name });
    const health = healthEffect(top.aqi, top.name);
    facts.push({ label: "Who", value: health.who });
    facts.push({ label: "Effect", value: health.effect });
  } else {
    facts.push({ label: "Reading", value: "Not reporting this hour" });
  }
  for (const part of parts) {
    if (part.amount == null) continue;
    const unit = part.name === "Ozone" ? "ppb" : "µg/m³";
    const text = part.name === "Ozone" ? `${Math.round(part.amount)} ${unit}` : `${part.amount.toFixed(1)} ${unit}`;
    facts.push({ label: part.name, value: text });
  }
  if (row.LocalTimeString) facts.push({ label: "Observed", value: String(row.LocalTimeString) });
  return {
    name: String(row.SiteName || "Monitor"),
    lat,
    lng,
    aqi: top?.aqi ?? null,
    facts,
  };
}

