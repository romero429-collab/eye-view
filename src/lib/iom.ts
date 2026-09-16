import type { OverlayState } from "./basemaps.ts";
import { resolveZone, type ZonePatch } from "./zone-memory.ts";

/** Interaction Orchestration Model — how a change in one layer
 *  becomes action in the others. Sensors → perception → adaptation → action. */

export type IomAction = "reroute" | "anticipate" | "adapt" | "update" | "flag";

export type Consequence = {
  id: string;
  cause: string;
  target: "transit" | "zone" | "wildlife" | "plants" | "perception";
  action: IomAction;
  title: string;
  detail: string;
};

export type IomScene = {
  lng: number;
  lat: number;
  zoom?: number;
  zoneClass: string | null;
  zoneLabel: string;
  transit?: number;
  wildlife?: number;
  plants?: number;
  events?: number;
  alerts?: number;
  quakes?: number;
  sensors?: number;
  precip?: number;
  temp?: number;
  wind?: number;
};

const WET_MM = 0.2;
const WINDY = 40;

export function orchestrate(args: {
  scene: IomScene | null;
  overlays: OverlayState;
  patches?: ZonePatch[];
}): Consequence[] {
  const { scene, overlays, patches = [] } = args;
  if (!scene) return [];
  const out: Consequence[] = [];
  const learned = resolveZone(patches, scene.lng, scene.lat, scene.zoneClass, scene.zoneLabel);
  const wet = (scene.precip ?? 0) >= WET_MM;
  const windy = (scene.wind ?? 0) >= WINDY;
  const seismic = (scene.quakes ?? 0) > 0;
  const hazard = (scene.events ?? 0) > 0 || (scene.alerts ?? 0) > 0;
  const tagged = Boolean(learned.patch);

  if (tagged) {
    out.push({
      id: "iom-walk",
      cause: "ground tag",
      target: "perception",
      action: "update",
      title: "Ground tag updated the frame",
      detail: `Walk / reclass as ${learned.label.toLowerCase()} is now the district. Transit, wildlife, and plants reread this look-at.`,
    });
    out.push({
      id: "iom-zone-transit",
      cause: "zone change",
      target: "transit",
      action: "adapt",
      title: "Zone change reroutes transit",
      detail: "The corridor is not a static line. A learned district forces movement to adapt.",
    });
  }

  if (overlays.iot && (wet || windy)) {
    out.push({
      id: "iom-weather",
      cause: wet ? "iot precip" : "iot wind",
      target: "transit",
      action: "reroute",
      title: wet ? "Weather shifts the corridor" : "Wind constrains movement",
      detail: wet
        ? `${(scene.precip ?? 0).toFixed(1)} mm at the sensor. Routes seek around wet ground.`
        : `${Math.round(scene.wind ?? 0)} km/h. Movement adapts to the atmosphere, not the paper line.`,
    });
  }

  if ((overlays.iot || overlays.quakes) && seismic) {
    out.push({
      id: "iom-seismic",
      cause: "iot seismic",
      target: "wildlife",
      action: "anticipate",
      title: "Seismic — animals will leave",
      detail: "Wildlife anticipates unstable ground. Corridors detour before the next pulse.",
    });
  }

  if (hazard && (overlays.events || overlays.alerts)) {
    out.push({
      id: "iom-hazard",
      cause: "live hazard",
      target: "transit",
      action: "reroute",
      title: "Hazard forces adaptation",
      detail: "Flood, alert, or EONET event in this district. IOM reroutes movement; it does not hide the zone.",
    });
  }

  if (overlays.wildlife && overlays.plants && (scene.plants ?? 0) > 0) {
    out.push({
      id: "iom-migrate",
      cause: "plants + wildlife",
      target: "wildlife",
      action: "anticipate",
      title: "Migration expected on this cover",
      detail: "Animals follow vegetation. The system anticipates clustering here instead of waiting for a count spike.",
    });
  }

  if (overlays.iot && overlays.plants && wet) {
    out.push({
      id: "iom-grow",
      cause: "iot precip",
      target: "plants",
      action: "adapt",
      title: "Rain changes what this zone grows",
      detail: "Precipitation is not scenery. Cover and crops respond; the district may need a later reclass.",
    });
  }

  if (overlays.iot && (scene.sensors ?? 0) === 0 && overlays.zoning) {
    out.push({
      id: "iom-listen",
      cause: "iot",
      target: "perception",
      action: "flag",
      title: "IOM is listening at this look-at",
      detail: "No station in the box yet. The perception layer still owns the district; sensors will attach when they report.",
    });
  } else if (overlays.iot && (scene.sensors ?? 0) > 0 && !wet && !windy) {
    const n = scene.sensors ?? 0;
    const temp = scene.temp;
    out.push({
      id: "iom-wired",
      cause: "iot",
      target: "perception",
      action: "update",
      title: "Wired into this district's sensors",
      detail: `${n} station${n === 1 ? "" : "s"} live${temp ? ` · ${temp.toFixed(0)}°C` : ""}. IOM reads the nerve — weather, seismic, tags — not a static map.`,
    });
  }

  const seen = new Set<string>();
  return out.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).slice(0, 5);
}

export function consequenceToEffect(action: IomAction): "adapt" | "avoid" | "prefer" | "dim" | "queue" {
  if (action === "reroute" || action === "flag") return "avoid";
  if (action === "anticipate") return "prefer";
  if (action === "update") return "queue";
  return "adapt";
}
