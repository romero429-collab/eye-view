/** Look-at weather desk. Open-Meteo is the worldwide forecast; NWS alerts are US-only. */

export type HourSlice = {
  time: string;
  hour: string;
  temp: number | null;
  pop: number | null;
  precip: number | null;
  code: number | null;
  wind: number | null;
  dir: number | null;
};

export type DaySlice = {
  date: string;
  label: string;
  code: number | null;
  high: number | null;
  low: number | null;
  pop: number | null;
  precip: number | null;
  uv: number | null;
  summary?: string;
};

export type WeatherAlert = {
  event: string;
  severity: string;
  headline: string;
};

export type WeatherBrief = {
  condition: string;
  code: number | null;
  observed: string;
  timezone: string;
  temp: number | null;
  feels: number | null;
  humidity: number | null;
  dew: number | null;
  precip: number | null;
  cloud: number | null;
  pressure: number | null;
  wind: number | null;
  gust: number | null;
  dir: number | null;
  cardinal: string;
  visibilityKm: number | null;
  uv: number | null;
  isDay: boolean | null;
  hours: HourSlice[];
  days: DaySlice[];
  alerts: WeatherAlert[];
  source: string;
};

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm, hail",
  99: "Thunderstorm, heavy hail",
};

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function weatherLabel(code: number | null | undefined): string {
  if (code == null || !Number.isFinite(code)) return "Weather";
  return WMO[code] ?? "Weather";
}

export function windCardinal(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return "—";
  const wrapped = ((deg % 360) + 360) % 360;
  const index = Math.round(wrapped / 45) % 8;
  return CARDINALS[index] ?? "—";
}

export type WeatherUnits = "us" | "si";

export function toTemp(celsius: number | null | undefined, units: WeatherUnits): number | null {
  if (celsius == null || !Number.isFinite(celsius)) return null;
  return units === "us" ? (celsius * 9) / 5 + 32 : celsius;
}

export function toSpeed(kmh: number | null | undefined, units: WeatherUnits): number | null {
  if (kmh == null || !Number.isFinite(kmh)) return null;
  return units === "us" ? kmh / 1.609344 : kmh;
}

export function weekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate.slice(5);
  return WEEK[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? isoDate.slice(5);
}

function hourLabel(iso: string): string {
  const match = /T(\d{2}):/.exec(iso);
  return match?.[1] ?? iso.slice(11, 13);
}

type Hourly = {
  time?: string[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
  precipitation?: number[];
  weather_code?: number[];
  wind_speed_10m?: number[];
  wind_direction_10m?: number[];
};

type Daily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_sum?: number[];
  precipitation_probability_max?: number[];
  uv_index_max?: number[];
};

export function parseForecast(raw: unknown): WeatherBrief | null {
  const body = raw as {
    timezone?: string;
    current?: Record<string, unknown>;
    hourly?: Hourly;
    daily?: Daily;
  } | null;
  const current = body?.current;
  if (!current) return null;
  const code = num(current.weather_code);
  const dir = num(current.wind_direction_10m);
  const visibility = num(current.visibility);
  const observed = String(current.time ?? "");
  const hourly = body?.hourly;
  const times = hourly?.time ?? [];
  let start = 0;
  for (let i = 0; i < times.length; i += 1) {
    if ((times[i] ?? "") <= observed) start = i;
    else break;
  }
  const hours: HourSlice[] = [];
  for (let i = start; i < times.length && hours.length < 12; i += 1) {
    hours.push({
      time: times[i] ?? "",
      hour: hourLabel(times[i] ?? ""),
      temp: num(hourly?.temperature_2m?.[i]),
      pop: num(hourly?.precipitation_probability?.[i]),
      precip: num(hourly?.precipitation?.[i]),
      code: num(hourly?.weather_code?.[i]),
      wind: num(hourly?.wind_speed_10m?.[i]),
      dir: num(hourly?.wind_direction_10m?.[i]),
    });
  }
  const daily = body?.daily;
  const days: DaySlice[] = [];
  const dates = daily?.time ?? [];
  for (let i = 0; i < dates.length && days.length < 5; i += 1) {
    const date = dates[i] ?? "";
    days.push({
      date,
      label: weekdayLabel(date),
      code: num(daily?.weather_code?.[i]),
      high: num(daily?.temperature_2m_max?.[i]),
      low: num(daily?.temperature_2m_min?.[i]),
      pop: num(daily?.precipitation_probability_max?.[i]),
      precip: num(daily?.precipitation_sum?.[i]),
      uv: num(daily?.uv_index_max?.[i]),
    });
  }
  const isDay = num(current.is_day);
  return {
    condition: weatherLabel(code),
    code,
    observed,
    timezone: body?.timezone ?? "",
    temp: num(current.temperature_2m),
    feels: num(current.apparent_temperature),
    humidity: num(current.relative_humidity_2m),
    dew: num(current.dew_point_2m),
    precip: num(current.precipitation),
    cloud: num(current.cloud_cover),
    pressure: num(current.pressure_msl),
    wind: num(current.wind_speed_10m),
    gust: num(current.wind_gusts_10m),
    dir,
    cardinal: windCardinal(dir),
    visibilityKm: visibility == null ? null : visibility > 300 ? visibility / 1000 : visibility,
    uv: num(current.uv_index),
    isDay: isDay == null ? null : isDay >= 1,
    hours,
    days,
    alerts: [],
    source: "Open-Meteo",
  };
}

export function parseAlerts(raw: unknown): WeatherAlert[] {
  const features = (raw as { features?: Array<{ properties?: Record<string, unknown> }> } | null)?.features;
  if (!Array.isArray(features)) return [];
  const alerts: WeatherAlert[] = [];
  for (const feature of features) {
    const props = feature.properties ?? {};
    const event = String(props.event ?? "").trim();
    if (!event) continue;
    alerts.push({
      event,
      severity: String(props.severity ?? ""),
      headline: String(props.headline ?? "").replace(/\s+/g, " ").slice(0, 160),
    });
    if (alerts.length >= 3) break;
  }
  return alerts;
}

type NwsPeriod = {
  name?: string;
  startTime?: string;
  isDaytime?: boolean;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
  probabilityOfPrecipitation?: { value?: number | null };
  dewpoint?: { value?: number | null; unitCode?: string };
  relativeHumidity?: { value?: number | null };
};

function toCelsius(value: number | null, unit: string | undefined): number | null {
  if (value == null) return null;
  if ((unit ?? "F").toUpperCase().startsWith("C")) return Math.round(value * 10) / 10;
  return Math.round((((value - 32) * 5) / 9) * 10) / 10;
}

function windKmh(text: string | undefined): number | null {
  const match = /(\d+(?:\.\d+)?)/.exec(text ?? "");
  if (!match) return null;
  return Math.round(Number(match[1]) * 1.60934);
}

function nwsPeriods(raw: unknown): NwsPeriod[] {
  const periods = (raw as { properties?: { periods?: NwsPeriod[] } } | null)?.properties?.periods;
  return Array.isArray(periods) ? periods : [];
}

/** US forecast office periods, converted onto the same desk as the model. */
export function parseNws(forecast: unknown, hourly: unknown): WeatherBrief | null {
  const hoursRaw = nwsPeriods(hourly);
  const daysRaw = nwsPeriods(forecast);
  const now = hoursRaw[0] ?? daysRaw[0];
  if (!now?.shortForecast && now?.temperature == null) return null;
  const dirText = (now.windDirection ?? "").trim().toUpperCase();
  const cardinal = /^[NSEW]{1,3}$/.test(dirText) ? dirText : "—";
  const hours: HourSlice[] = hoursRaw.slice(0, 12).map((period) => ({
    time: period.startTime ?? "",
    hour: hourLabel(period.startTime ?? ""),
    temp: toCelsius(num(period.temperature), period.temperatureUnit),
    pop: num(period.probabilityOfPrecipitation?.value),
    precip: null,
    code: null,
    wind: windKmh(period.windSpeed),
    dir: null,
  }));
  const byDate = new Map<string, DaySlice>();
  for (const period of daysRaw) {
    const date = (period.startTime ?? "").slice(0, 10);
    if (!date) continue;
    const row = byDate.get(date) ?? {
      date,
      label: weekdayLabel(date),
      code: null,
      high: null,
      low: null,
      pop: null,
      precip: null,
      uv: null,
      summary: "",
    };
    const temp = toCelsius(num(period.temperature), period.temperatureUnit);
    if (period.isDaytime) {
      row.high = temp;
      if (period.shortForecast) row.summary = period.shortForecast;
    } else if (row.low == null) {
      row.low = temp;
      if (!row.summary && period.shortForecast) row.summary = period.shortForecast;
    }
    const pop = num(period.probabilityOfPrecipitation?.value);
    if (pop != null) row.pop = row.pop == null ? pop : Math.max(row.pop, pop);
    byDate.set(date, row);
    if (byDate.size >= 5 && period.isDaytime) break;
  }
  const dew = num(now.dewpoint?.value);
  const dewUnit = now.dewpoint?.unitCode ?? "";
  return {
    condition: now.shortForecast || "Weather",
    code: null,
    observed: now.startTime ?? "",
    timezone: "NWS",
    temp: toCelsius(num(now.temperature), now.temperatureUnit),
    feels: null,
    humidity: num(now.relativeHumidity?.value),
    dew: dew == null ? null : dewUnit.includes("degF") ? toCelsius(dew, "F") : Math.round(dew * 10) / 10,
    precip: null,
    cloud: null,
    pressure: null,
    wind: windKmh(now.windSpeed),
    gust: null,
    dir: null,
    cardinal,
    visibilityKm: null,
    uv: null,
    isDay: now.isDaytime ?? null,
    hours,
    days: [...byDate.values()].slice(0, 5),
    alerts: [],
    source: "NWS",
  };
}

const MET_LABEL: Record<string, string> = {
  clearsky: "Clear",
  fair: "Mainly clear",
  partlycloudy: "Partly cloudy",
  cloudy: "Overcast",
  fog: "Fog",
  rain: "Rain",
  lightrain: "Light rain",
  heavyrain: "Heavy rain",
  rainshowers: "Showers",
  lightrainshowers: "Light showers",
  heavyrainshowers: "Violent showers",
  thunderstorm: "Thunderstorm",
  heavyrainandthunder: "Thunderstorm",
  rainandthunder: "Thunderstorm",
  snow: "Snow",
  lightsnow: "Light snow",
  heavysnow: "Heavy snow",
  sleet: "Sleet",
  rainandsnow: "Rain and snow",
};

function metCondition(code: string | undefined): string {
  const bare = (code ?? "").replace(/_(day|night|polartwilight)$/, "");
  return MET_LABEL[bare] ?? "Weather";
}

/** Norwegian Meteorological Institute compact forecast. Wind in the feed is m/s. */
export function parseMetNo(raw: unknown): WeatherBrief | null {
  const series = (raw as { properties?: { timeseries?: Array<Record<string, unknown>> } } | null)?.properties
    ?.timeseries;
  if (!Array.isArray(series) || series.length === 0) return null;
  const hours: HourSlice[] = [];
  const byDate = new Map<string, DaySlice>();
  let first: WeatherBrief | null = null;
  for (const row of series) {
    const time = String(row.time ?? "");
    const data = row.data as {
      instant?: { details?: Record<string, number> };
      next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
      next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
    } | undefined;
    const details = data?.instant?.details ?? {};
    const symbol = data?.next_1_hours?.summary?.symbol_code ?? data?.next_6_hours?.summary?.symbol_code;
    const temp = num(details.air_temperature);
    const windMs = num(details.wind_speed);
    const wind = windMs == null ? null : windMs * 3.6;
    const dir = num(details.wind_from_direction);
    const precip = num(data?.next_1_hours?.details?.precipitation_amount);
    if (hours.length < 12) {
      hours.push({
        time,
        hour: hourLabel(time),
        temp,
        pop: null,
        precip,
        code: null,
        wind,
        dir,
      });
    }
    const date = time.slice(0, 10);
    if (date && byDate.size < 5) {
      const day = byDate.get(date) ?? {
        date,
        label: weekdayLabel(date),
        code: null,
        high: null,
        low: null,
        pop: null,
        precip: null,
        uv: null,
        summary: "",
      };
      if (temp != null) {
        day.high = day.high == null ? temp : Math.max(day.high, temp);
        day.low = day.low == null ? temp : Math.min(day.low, temp);
      }
      if (!day.summary && symbol) day.summary = metCondition(symbol);
      const six = num(data?.next_6_hours?.details?.precipitation_amount);
      if (six != null) day.precip = (day.precip ?? 0) + six;
      byDate.set(date, day);
    }
    if (!first) {
      const gust = num(details.wind_speed_of_gust);
      first = {
        condition: metCondition(symbol),
        code: null,
        observed: time,
        timezone: "UTC",
        temp,
        feels: null,
        humidity: num(details.relative_humidity),
        dew: num(details.dew_point_temperature),
        precip,
        cloud: num(details.cloud_area_fraction),
        pressure: num(details.air_pressure_at_sea_level),
        wind,
        gust: gust == null ? null : gust * 3.6,
        dir,
        cardinal: windCardinal(dir),
        visibilityKm: null,
        uv: null,
        isDay: symbol?.endsWith("_day") ? true : symbol?.endsWith("_night") ? false : null,
        hours,
        days: [],
        alerts: [],
        source: "MET Norway",
      };
    }
  }
  if (!first) return null;
  first.hours = hours;
  first.days = [...byDate.values()];
  return first;
}

function degF(celsius: number | null): string | null {
  if (celsius == null) return null;
  return `${Math.round((celsius * 9) / 5 + 32)}°F`;
}

function mph(kmh: number | null): string | null {
  if (kmh == null) return null;
  return `${Math.round(kmh / 1.609344)} mph`;
}

/** Every field the desk knows, in °F and mph, for a tap card. */
export function weatherFacts(brief: WeatherBrief): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string } | null> = [
    { label: "Condition", value: brief.condition },
    degF(brief.temp) ? { label: "Temp", value: degF(brief.temp)! } : null,
    degF(brief.feels) ? { label: "Feels", value: degF(brief.feels)! } : null,
    brief.humidity != null ? { label: "Humidity", value: `${Math.round(brief.humidity)}%` } : null,
    degF(brief.dew) ? { label: "Dew point", value: degF(brief.dew)! } : null,
    brief.pressure != null ? { label: "Pressure", value: `${(brief.pressure / 33.8639).toFixed(2)} inHg` } : null,
    brief.wind != null ? { label: "Wind", value: `${brief.cardinal} ${mph(brief.wind)}` } : null,
    mph(brief.gust) ? { label: "Gust", value: mph(brief.gust)! } : null,
    brief.precip != null ? { label: "Precip", value: `${(brief.precip / 25.4).toFixed(2)} in` } : null,
    brief.cloud != null ? { label: "Cloud", value: `${Math.round(brief.cloud)}%` } : null,
    brief.visibilityKm != null ? { label: "Visibility", value: `${Math.round(brief.visibilityKm * 0.621371)} mi` } : null,
    brief.uv != null ? { label: "UV", value: brief.uv.toFixed(1) } : null,
    { label: "Forecast", value: brief.source },
  ];
  for (const alert of brief.alerts) {
    rows.push({ label: "Alert", value: alert.severity ? `${alert.event} (${alert.severity})` : alert.event });
  }
  if (brief.hours.length) {
    rows.push({
      label: "Next hours",
      value: brief.hours
        .slice(0, 8)
        .map((hour) => `${hour.hour} ${degF(hour.temp) ?? "—"}`)
        .join(" · "),
    });
  }
  if (brief.days.length) {
    rows.push({
      label: "Days",
      value: brief.days
        .map((day) => {
          const span = `${degF(day.high) ?? "—"}/${degF(day.low) ?? "—"}`;
          return `${day.label} ${day.summary || weatherLabel(day.code)} ${span}`;
        })
        .join(" · "),
    });
  }
  return rows.filter((row): row is { label: string; value: string } => Boolean(row?.value));
}

export function mergeFacts(
  base: Array<{ label: string; value: string }> | undefined,
  extra: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> {
  const seen = new Set((base ?? []).map((fact) => fact.label));
  return [...(base ?? []), ...extra.filter((fact) => fact.value && !seen.has(fact.label))];
}

export function briefFromProperties(props: Record<string, unknown> | null | undefined): WeatherBrief | null {
  const raw = props?.brief;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as WeatherBrief;
    if (!parsed || typeof parsed.condition !== "string" || !Array.isArray(parsed.hours)) return null;
    return parsed;
  } catch {
    return null;
  }
}
