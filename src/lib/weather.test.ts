import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  briefFromProperties,
  parseAlerts,
  parseForecast,
  parseMetNo,
  parseNws,
  weatherFacts,
  toSpeed,
  toTemp,
  weatherLabel,
  windCardinal,
} from "./weather.ts";

describe("weather desk", () => {
  it("names WMO codes and the compass", () => {
    assert.equal(weatherLabel(0), "Clear");
    assert.equal(weatherLabel(95), "Thunderstorm");
    assert.equal(weatherLabel(99), "Thunderstorm, heavy hail");
    assert.equal(weatherLabel(null), "Weather");
    assert.equal(windCardinal(0), "N");
    assert.equal(windCardinal(45), "NE");
    assert.equal(windCardinal(220), "SW");
    assert.equal(windCardinal(359), "N");
    assert.equal(windCardinal(null), "—");
    assert.equal(Math.round(toTemp(0, "us") ?? 0), 32);
    assert.equal(Math.round(toTemp(22.2, "us") ?? 0), 72);
    assert.equal(toTemp(22.2, "si"), 22.2);
    assert.equal(Math.round(toSpeed(16.09344, "us") ?? 0), 10);
    assert.equal(toSpeed(null, "us"), null);
  });

  it("builds a 12-hour strip and five days from the look-at hour", () => {
    const times = Array.from({ length: 30 }, (_, i) => {
      const day = i >= 24 ? "2026-09-26" : "2026-09-25";
      return `${day}T${String(i % 24).padStart(2, "0")}:00`;
    });
    const brief = parseForecast({
      timezone: "America/Denver",
      current: {
        time: "2026-09-25T16:10",
        temperature_2m: 24.2,
        apparent_temperature: 22,
        relative_humidity_2m: 18,
        dew_point_2m: 1.5,
        precipitation: 0,
        weather_code: 1,
        cloud_cover: 12,
        pressure_msl: 1016.4,
        wind_speed_10m: 18,
        wind_direction_10m: 220,
        wind_gusts_10m: 31,
        visibility: 24140,
        uv_index: 6.1,
        is_day: 1,
      },
      hourly: {
        time: times,
        temperature_2m: times.map((_, i) => 20 + i),
        precipitation_probability: times.map(() => 10),
        precipitation: times.map(() => 0),
        weather_code: times.map(() => 1),
        wind_speed_10m: times.map(() => 18),
        wind_direction_10m: times.map(() => 220),
      },
      daily: {
        time: ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"],
        weather_code: [1, 3, 61, 0, 2],
        temperature_2m_max: [31, 28, 22, 30, 29],
        temperature_2m_min: [12, 11, 9, 10, 11],
        precipitation_sum: [0, 0, 4.2, 0, 0],
        precipitation_probability_max: [10, 20, 70, 0, 5],
        uv_index_max: [8, 7, 4, 8, 7],
      },
    });
    assert.ok(brief);
    assert.equal(brief?.condition, "Mainly clear");
    assert.equal(brief?.cardinal, "SW");
    assert.equal(brief?.visibilityKm, 24.14);
    assert.equal(brief?.hours.length, 12);
    assert.equal(brief?.hours[0]?.hour, "16");
    assert.equal(brief?.hours[0]?.temp, 36);
    assert.equal(brief?.days.length, 5);
    assert.equal(brief?.days[0]?.label, "Fri");
    assert.equal(brief?.days[2]?.pop, 70);
    const again = briefFromProperties({ brief: JSON.stringify(brief) });
    assert.equal(again?.temp, 24.2);
  });

  it("keeps the first three NWS headlines", () => {
    const alerts = parseAlerts({
      features: [
        { properties: { event: "Heat Advisory", severity: "Moderate", headline: "Hot through Friday" } },
        { properties: { event: "  " } },
        { properties: { event: "Wind Advisory", severity: "Minor", headline: "Gusts" } },
      ],
    });
    assert.equal(alerts.length, 2);
    assert.equal(alerts[0]?.event, "Heat Advisory");
    assert.equal(parseForecast(null), null);
    assert.equal(briefFromProperties({ brief: "{" }), null);
  });

  it("reads an NWS afternoon and the days after it", () => {
    const brief = parseNws(
      {
        properties: {
          periods: [
            {
              name: "This Afternoon",
              startTime: "2026-09-25T17:00:00-06:00",
              isDaytime: true,
              temperature: 73,
              temperatureUnit: "F",
              windSpeed: "10 mph",
              windDirection: "S",
              shortForecast: "Chance Showers And Thunderstorms",
              probabilityOfPrecipitation: { value: 32 },
            },
            {
              name: "Tonight",
              startTime: "2026-09-25T20:00:00-06:00",
              isDaytime: false,
              temperature: 57,
              temperatureUnit: "F",
              windSpeed: "5 to 10 mph",
              windDirection: "SW",
              shortForecast: "Partly Cloudy",
              probabilityOfPrecipitation: { value: 20 },
            },
            {
              name: "Saturday",
              startTime: "2026-09-26T08:00:00-06:00",
              isDaytime: true,
              temperature: 80,
              temperatureUnit: "F",
              windSpeed: "10 to 15 mph",
              windDirection: "W",
              shortForecast: "Sunny",
              probabilityOfPrecipitation: { value: 1 },
            },
          ],
        },
      },
      {
        properties: {
          periods: [
            {
              startTime: "2026-09-25T17:00:00-06:00",
              isDaytime: true,
              temperature: 72,
              temperatureUnit: "F",
              windSpeed: "10 mph",
              windDirection: "S",
              shortForecast: "Chance Showers And Thunderstorms",
              probabilityOfPrecipitation: { value: 32 },
              relativeHumidity: { value: 56 },
              dewpoint: { unitCode: "wmoUnit:degC", value: 13.3 },
            },
          ],
        },
      },
    );
    assert.ok(brief);
    assert.equal(brief?.source, "NWS");
    assert.equal(brief?.condition, "Chance Showers And Thunderstorms");
    assert.equal(brief?.temp, 22.2);
    assert.equal(brief?.cardinal, "S");
    assert.equal(brief?.wind, 16);
    assert.equal(brief?.humidity, 56);
    assert.equal(brief?.dew, 13.3);
    assert.equal(brief?.hours[0]?.hour, "17");
    assert.equal(brief?.days[0]?.label, "Fri");
    assert.equal(brief?.days[0]?.high, 22.8);
    assert.equal(brief?.days[0]?.low, 13.9);
    assert.equal(brief?.days[0]?.pop, 32);
    assert.equal(brief?.days[1]?.summary, "Sunny");
  });

  it("reads a MET Norway hour as a desk", () => {
    const brief = parseMetNo({
      properties: {
        timeseries: [
          {
            time: "2026-09-25T23:00:00Z",
            data: {
              instant: {
                details: {
                  air_temperature: 17.7,
                  relative_humidity: 90,
                  wind_speed: 5,
                  wind_from_direction: 180,
                  air_pressure_at_sea_level: 1010,
                  cloud_area_fraction: 100,
                },
              },
              next_1_hours: { summary: { symbol_code: "heavyrain" }, details: { precipitation_amount: 2 } },
            },
          },
        ],
      },
    });
    assert.equal(brief?.condition, "Heavy rain");
    assert.equal(brief?.temp, 17.7);
    assert.equal(Math.round(brief?.wind ?? 0), 18);
    assert.equal(brief?.cardinal, "S");
    assert.equal(brief?.source, "MET Norway");
    assert.equal(brief?.hours[0]?.precip, 2);
    const facts = weatherFacts(brief!);
    assert.equal(facts.find((fact) => fact.label === "Temp")?.value, "64°F");
    assert.equal(facts.find((fact) => fact.label === "Wind")?.value, "S 11 mph");
    assert.equal(facts.find((fact) => fact.label === "Precip")?.value, "0.08 in");
    assert.ok(facts.some((fact) => fact.label === "Next hours"));
  });
});
