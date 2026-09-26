import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { airDriver, airFacts, aqiBand, healthEffect, monitorSite } from "./air.ts";

describe("air quality", () => {
  it("names the EPA band and the pollutant that set the index", () => {
    assert.equal(aqiBand(41), "Good");
    assert.equal(aqiBand(120), "Unhealthy for sensitive groups");
    assert.equal(aqiBand(310), "Hazardous");
    const current = { us_aqi: 41, us_aqi_ozone: 41, us_aqi_pm2_5: 8, ozone: 76, pm2_5: 1.4, european_aqi: 28 };
    assert.equal(airDriver(current), "Ozone");
    const labels = airFacts(current).map((fact) => fact.label);
    assert.ok(labels.includes("Set by"));
    assert.equal(airFacts(current)[0]?.value, "41 · Good");
    assert.match(healthEffect(41, "Ozone").who, /Little or no risk/);
    assert.match(healthEffect(41, "Ozone").effect, /airways/);
    assert.match(healthEffect(160, "PM2.5").who, /heart/);
    assert.match(healthEffect(320, "Ozone").who, /Emergency/);
  });

  it("reads a regulatory station and the pollutant that set its hour", () => {
    const site = monitorSite({
      SiteName: "Del Norte",
      DataSource: "Albuquerque Environmental Health Department",
      Latitude: 35.1353,
      Longitude: -106.5847,
      MonitorType: "Permanent",
      OZONE: 30,
      OZONE_AQI: 31,
      OZONE_Measured: 1,
      PM25: 3.3,
      PM25_AQI: 16,
      PM25_Measured: 1,
      PM10: "8.0",
      PM10_AQI: "7.0",
      PM10_Measured: 1,
    });
    assert.equal(site?.name, "Del Norte");
    assert.equal(site?.aqi, 31);
    assert.equal(site?.facts.find((fact) => fact.label === "Set by")?.value, "Ozone");
    assert.match(site?.facts.find((fact) => fact.label === "Method")?.value ?? "", /ultraviolet/);
  });
});
