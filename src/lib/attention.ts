/** Local salience. What you inspect rises; everything else decays.
 *  This is the HUD-side feedback loop until Kiyoshi's Reality
 *  Integration Layer owns the weights. */

export type AttentionMap = Record<string, number>;

export const ATTENTION_KEY = "kiyoshi.eye.attention.v1";
const DECAY = 0.9;
const BUMP = 1;
const FLOOR = 0.08;

const HINTS: Record<string, string[]> = {
  wildlife: ["animal", "wild", "terrain", "habitat", "wildlife"],
  plants: ["plant", "tree", "crop", "vegetation", "growing", "flora"],
  plant: ["plant", "tree", "crop", "vegetation"],
  sighting: ["animal", "wild", "wildlife"],
  livestock: ["livestock", "cattle", "domestic", "herd"],
  quakes: ["quake", "seismic", "earthquake"],
  quake: ["quake", "seismic"],
  zoning: ["zone", "district", "land-use", "industrial", "residential"],
  zone: ["zone", "district", "industrial", "residential", "recreation"],
  transit: ["transit", "bus", "route"],
  plots: ["plot", "lot", "address", "parcel"],
  walk: ["walk", "street"],
  recreation: ["recreation", "park", "pitch"],
  extractive: ["quarry", "landfill", "mine"],
  construction: ["construction"],
  pasture: ["pasture", "meadow", "livestock"],
};

export function loadAttention(): AttentionMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(ATTENTION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: AttentionMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > FLOOR) {
        next[key] = value;
      }
    }
    return next;
  } catch {
    return {};
  }
}

export function persistAttention(map: AttentionMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ATTENTION_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function notice(map: AttentionMap, key: string): AttentionMap {
  const token = key.trim().toLowerCase();
  if (!token) return map;
  const next: AttentionMap = {};
  for (const [k, v] of Object.entries(map)) {
    const decayed = v * DECAY;
    if (decayed > FLOOR) next[k] = decayed;
  }
  next[token] = (next[token] ?? 0) + BUMP;
  return next;
}

export function noticeMany(map: AttentionMap, keys: Array<string | null | undefined>): AttentionMap {
  let next = map;
  for (const key of keys) {
    if (key) next = notice(next, key);
  }
  return next;
}

export function salience(map: AttentionMap, key: string): number {
  return map[key.trim().toLowerCase()] ?? 0;
}

export function scoreQuery(text: string, map: AttentionMap): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const [key, value] of Object.entries(map)) {
    if (lower.includes(key)) {
      score += value;
      continue;
    }
    const hints = HINTS[key] ?? [];
    if (hints.some((h) => lower.includes(h))) score += value * 0.8;
  }
  return score;
}

export function rankQueries(queries: readonly string[], map: AttentionMap): string[] {
  return [...queries].sort((a, b) => scoreQuery(b, map) - scoreQuery(a, map) || queries.indexOf(a) - queries.indexOf(b));
}
