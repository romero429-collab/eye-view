import { altitudeFromZoom, type OverlayId, type OverlayState } from "./basemaps.ts";
import type { AttentionMap } from "./attention.ts";
import type { MapObject } from "./map-types.ts";
import type { RuleHit, SceneSample } from "./zoning-rules.ts";
import { resolveZone, type ZonePatch } from "./zone-memory.ts";
import { perceiveMovement, type TransitMood } from "./transit-sense.ts";
import { type Consequence } from "./iom.ts";
import { syncMinds, type Calibration } from "./minds.ts";

/** One tick of what the HUD actually sees. This is the contract Kiyoshi's
 *  Reality Integration Layer consumes: look-at, ground as context (never as
 *  the object), zone, focus, and the rule stack. */

export type PerceptionFocus = {
  kind: string;
  layer: string;
  title: string;
  lng: number | null;
  lat: number | null;
};

export type PerceptionFrame = {
  t: number;
  look: { lng: number; lat: number; zoom: number; altitudeKm: number };
  country: string | null;
  zone: { class: string; label: string; learned: boolean; queued: number } | null;
  overlays: OverlayId[];
  focus: PerceptionFocus | null;
  rules: Array<{ id: string; effect: string; title: string }>;
  attention: AttentionMap;
  movement: { mood: TransitMood; title: string } | null;
  consequences: Array<Pick<Consequence, "id" | "cause" | "target" | "action" | "title">>;
  minds: {
    score: number;
    skills: number;
    changed: string[];
    drew: Calibration["drew"];
    matter: string[];
  };
  calibration: Calibration;
};

export function formatDecimal(lng: number, lat: number): string {
  return `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
}

export function activeOverlays(state: OverlayState): OverlayId[] {
  return (Object.keys(state) as OverlayId[]).filter((id) => state[id] && id !== "metric" && id !== "labels");
}

export function focusFromObject(object: MapObject | null): PerceptionFocus | null {
  if (!object) return null;
  return {
    kind: object.kind,
    layer: object.layer ?? object.kind,
    title: object.title,
    lng: object.lng ?? null,
    lat: object.lat ?? null,
  };
}

export function buildPerception(args: {
  scene: SceneSample | null;
  overlays: OverlayState;
  object: MapObject | null;
  rules: RuleHit[];
  attention: AttentionMap;
  patches?: ZonePatch[];
  now?: number;
}): PerceptionFrame {
  const { scene, overlays, object, rules, attention, patches = [], now = Date.now() } = args;
  const lng = object?.lng ?? scene?.lng ?? 0;
  const lat = object?.lat ?? scene?.lat ?? 0;
  const zoom = scene?.zoom ?? 0;
  const learned = scene
    ? resolveZone(patches, scene.lng, scene.lat, scene.zoneClass, scene.zoneLabel)
    : null;
  const zone =
    learned?.class && learned.label && !/^no (zone|district)/i.test(learned.label)
      ? {
          class: learned.class,
          label: learned.label,
          learned: learned.immediate,
          queued: learned.queued,
        }
      : null;
  const countryFact = object?.facts?.find((f) => f.label === "Ground")?.value ?? null;
  const movement = overlays.transit
    ? (() => {
        const sense = perceiveMovement({ scene, overlays, patches, vehicles: scene?.transit ?? 0 });
        return { mood: sense.mood, title: sense.title };
      })()
    : null;
  const minds = syncMinds({ scene, overlays, patches, now });
  return {
    t: now,
    look: {
      lng,
      lat,
      zoom,
      altitudeKm: altitudeFromZoom(zoom),
    },
    country: countryFact ?? object?.ground ?? null,
    zone,
    overlays: activeOverlays(overlays),
    focus: focusFromObject(object),
    rules: rules.map((hit) => ({ id: hit.id, effect: hit.effect, title: hit.title })),
    attention,
    movement,
    consequences: minds.consequences.map((c) => ({
      id: c.id,
      cause: c.cause,
      target: c.target,
      action: c.action,
      title: c.title,
    })),
    minds: {
      score: minds.calibration.score,
      skills: minds.pool.length,
      changed: minds.calibration.changed,
      drew: minds.calibration.drew,
      matter: minds.calibration.matter,
    },
    calibration: minds.calibration,
  };
}

/** Country GDP is orbit-scale. Ground overlays own the inspector. */
export function groundOwnsInspector(overlays: OverlayState, zoom: number | null | undefined): boolean {
  return Boolean(
    overlays.zoning ||
      overlays.wildlife ||
      overlays.livestock ||
      overlays.plants ||
      overlays.quakes ||
      overlays.plots ||
      overlays.iot ||
      overlays.transit ||
      overlays.flights ||
      (zoom ?? 0) >= 5,
  );
}
