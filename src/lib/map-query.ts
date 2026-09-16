import { DEFAULT_OVERLAYS, ZONE_SWATCHES, type OverlayId, type OverlayState } from "./basemaps.ts";
import { COUNTRIES } from "./countries.ts";
import type { ZoneEdit } from "./zone-memory.ts";

export type QueryKind = "empty" | "place" | "ask" | "walk";

export type MapIntent = {
  raw: string;
  kind: QueryKind;
  overlays: OverlayId[];
  zoneClass: string | null;
  zoneLabel: string | null;
  locationText: string | null;
  here: boolean;
  walk: boolean;
  countryId: string | null;
  countryName: string | null;
  summary: string;
  edit: ZoneEdit | null;
};

const OVERLAY_WORDS: Array<{ id: OverlayId; re: RegExp }> = [
  { id: "transit", re: /\b(transit|bus(?:es)?|gtfs|rout(?:e|es)|vehicles?|riders?|movement|corridors?|reroute)\b/ },
  { id: "flights", re: /\b(flights?|aircraft|ads-?b|planes?)\b/ },
  { id: "wildlife", re: /\b(animals?|wildlife|wild|mammals?|habitat|migration|fauna|critters?)\b/ },
  { id: "plants", re: /\b(plants?|vegetation|flora|trees?|shrubs?|crops?|growing|botany|native plants)\b/ },
  { id: "livestock", re: /\b(livestock|cattle|herd(?:s|ing)?|horses?|domestic)\b/ },
  { id: "trails", re: /\b(terrain|hiking|trails?|footpaths?|paths?)\b/ },
  { id: "zoning", re: /\b(zon(?:e|es|ing)|land-?use|districts?)\b/ },
  { id: "plots", re: /\b(plots?|parcels?|lots?|cadastr(?:e|al)|address(?:es)?)\b/ },
  { id: "rail", re: /\b(rail|trains?|tracks?|stations?)\b/ },
  { id: "quakes", re: /\b(quakes?|seismic|earthquakes?|tremors?)\b/ },
  { id: "radar", re: /\b(weather|radar|rain|storms?|precip)\b/ },
  { id: "alerts", re: /\b(alerts?|warnings?|nws)\b/ },
  { id: "events", re: /\b(hazards?|wildfires?|volcano(?:es)?|eonet)\b/ },
  { id: "streets", re: /\b(streets?|roads?|navigation)\b/ },
  { id: "health", re: /\b(health|sickness|disease)\b/ },
  { id: "iot", re: /\b(iot|sensors?|metar|weather stations?|nervous system|what's changing|what is changing|iom)\b/ },
];

const WALK_RE =
  /\b(walk|walking|ground[- ]?level|street[- ]?view|traverse|first[- ]?person|drop in|on foot|pedestrian)\b/;
const HERE_RE = /\b(here|this (?:spot|place|area|zone|location)|current|nearby|around me)\b/;

const STOP = new Set([
  "show",
  "me",
  "all",
  "the",
  "a",
  "an",
  "in",
  "on",
  "at",
  "for",
  "like",
  "whats",
  "what",
  "is",
  "are",
  "to",
  "of",
  "and",
  "or",
  "this",
  "that",
  "please",
  "find",
  "get",
  "see",
  "with",
  "from",
]);

export const QUERY_EXAMPLES = [
  "how does transit move here",
  "terrain for animals here",
  "walk this street",
  "this is residential",
  "what's growing here",
  "what's changing here",
  "split this zone",
] as const;

const THIS_IS_RE = /\b(?:this is|make this|reclassify(?: this)?(?: as)?|mark this(?: as)?)\b/;
const SPLIT_RE = /\bsplit\b/;
const MERGE_RE = /\bmerge\b/;
const TAG_RE = /\b(tag|note that|missed)\b/;

function matchZone(text: string): { id: string; label: string } | null {
  const lower = text.toLowerCase();
  for (const swatch of ZONE_SWATCHES) {
    if (lower.includes(swatch.id) || lower.includes(swatch.label.toLowerCase())) {
      return { id: swatch.id, label: swatch.label };
    }
    if (swatch.classes.some((klass) => klass !== swatch.id && lower.includes(klass))) {
      return { id: swatch.id, label: swatch.label };
    }
  }
  return null;
}

function matchCountry(text: string): { id: string; name: string } | null {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return null;
  const exact = COUNTRIES.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.iso3.toLowerCase() === q ||
      c.capital.toLowerCase() === q,
  );
  if (exact) return { id: exact.id, name: exact.name };
  const named = COUNTRIES.find(
    (c) =>
      q.includes(c.name.toLowerCase()) ||
      (c.capital.length > 3 && q.includes(c.capital.toLowerCase())),
  );
  if (named) return { id: named.id, name: named.name };
  const starts = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().startsWith(q) ||
      c.capital.toLowerCase().startsWith(q) ||
      c.iso3.toLowerCase() === q,
  );
  if (starts.length === 1) return { id: starts[0].id, name: starts[0].name };
  return null;
}

function leftoverLocation(text: string, zoneId: string | null): string | null {
  let leftover = text.toLowerCase();
  leftover = leftover.replace(WALK_RE, " ");
  leftover = leftover.replace(HERE_RE, " ");
  leftover = leftover.replace(THIS_IS_RE, " ");
  leftover = leftover.replace(SPLIT_RE, " ");
  leftover = leftover.replace(MERGE_RE, " ");
  leftover = leftover.replace(TAG_RE, " ");
  leftover = leftover.replace(/\bzone\b/g, " ");
  for (const { re } of OVERLAY_WORDS) leftover = leftover.replace(re, " ");
  if (zoneId) leftover = leftover.replace(new RegExp(`\\b${zoneId}\\b`, "g"), " ");
  const words = leftover
    .replace(/[^a-z0-9,.\-'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  if (words.length === 0) return null;
  return words.join(" ");
}

export function parseMapQuery(raw: string): MapIntent {
  const text = raw.trim();
  if (!text) {
    return {
      raw,
      kind: "empty",
      overlays: [],
      zoneClass: null,
      zoneLabel: null,
      locationText: null,
      here: false,
      walk: false,
      countryId: null,
      countryName: null,
      summary: "",
      edit: null,
    };
  }
  const lower = text.toLowerCase();
  const walk = WALK_RE.test(lower);
  const here = HERE_RE.test(lower);
  const zone = matchZone(lower);
  const edit: ZoneEdit | null = SPLIT_RE.test(lower)
    ? "split"
    : MERGE_RE.test(lower)
      ? "merge"
      : THIS_IS_RE.test(lower)
        ? "reclass"
        : TAG_RE.test(lower)
          ? "tag"
          : null;
  const overlays: OverlayId[] = [];
  for (const { id, re } of OVERLAY_WORDS) {
    if (re.test(lower) && !overlays.includes(id)) overlays.push(id);
  }
  if (walk && !overlays.includes("streets")) overlays.push("streets");
  if (walk && !overlays.includes("plots")) overlays.push("plots");
  if ((overlays.includes("wildlife") || overlays.includes("livestock") || overlays.includes("plants") || overlays.includes("trails")) &&
      !overlays.includes("zoning")) {
    overlays.push("zoning");
  }
  if (zone && !overlays.includes("zoning")) overlays.push("zoning");
  if (edit && !overlays.includes("zoning")) overlays.push("zoning");
  if (overlays.includes("transit") && !overlays.includes("streets")) overlays.push("streets");
  if (overlays.includes("transit") && !overlays.includes("zoning")) overlays.push("zoning");
  if (overlays.includes("iot") && !overlays.includes("zoning")) overlays.push("zoning");
  if (overlays.includes("iot") && !overlays.includes("transit")) overlays.push("transit");

  const country = matchCountry(text);
  const locationText = leftoverLocation(text, zone?.id ?? null);
  const asked = overlays.length > 0 || walk || Boolean(zone) || Boolean(edit);

  let kind: QueryKind = "place";
  if (walk) kind = "walk";
  else if (asked) kind = "ask";
  else if (!country && !locationText) kind = "ask";

  const parts: string[] = [];
  if (edit === "reclass" && zone) parts.push(`Reclass as ${zone.label.toLowerCase()}`);
  else if (edit === "split") parts.push("Split district");
  else if (edit === "merge") parts.push(zone ? `Merge into ${zone.label.toLowerCase()}` : "Merge district");
  else if (edit === "tag") parts.push("Tag this look-at");
  if (walk) parts.push("Ground walk");
  if (overlays.length && !edit) {
    parts.push(overlays.map((id) => id).join(" + "));
  }
  if (zone && !edit) parts.push(`in ${zone.label.toLowerCase()}`);
  if (here) parts.push("at look-at");
  else if (country) parts.push(country.name);
  else if (locationText && !edit) parts.push(locationText);

  return {
    raw: text,
    kind,
    overlays,
    zoneClass: zone?.id ?? null,
    zoneLabel: zone?.label ?? null,
    locationText: country ? country.name : locationText,
    here: here || Boolean(edit),
    walk,
    countryId: country?.id ?? null,
    countryName: country?.name ?? null,
    summary: parts.join(" · ") || text,
    edit,
  };
}

export function assembleOverlays(intent: MapIntent): OverlayState {
  const next: OverlayState = { ...DEFAULT_OVERLAYS, metric: false, labels: true };
  for (const id of intent.overlays) next[id] = true;
  if (intent.walk) {
    next.streets = true;
    next.plots = true;
    next.labels = true;
  }
  if (intent.zoneClass) next.zoning = true;
  if (intent.edit) next.zoning = true;
  if (next.wildlife || next.livestock || next.plants || next.trails || next.transit || next.iot) next.zoning = true;
  if (next.transit || next.rail) next.streets = true;
  return next;
}
