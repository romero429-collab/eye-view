import type { OverlayState } from "./basemaps.ts";
import type { ZonePatch } from "./zone-memory.ts";
import { resolveZone } from "./zone-memory.ts";
import { orchestrate, type Consequence, type IomScene } from "./iom.ts";

/** Internet of Minds — a skill-sharing network, not a bolt-on.
 *  Zone, transit, wildlife, plants, IoT, and the walker are minds.
 *  When one learns, the pool holds it. When another needs it, it draws.
 *  Live calibration quantifies the next version of the model every tick. */

export type MindId = "zone" | "transit" | "wildlife" | "plants" | "iot" | "walk" | "kiyoshi";

export type Skill = {
  id: string;
  mind: MindId;
  name: string;
  klass?: string;
  lng: number;
  lat: number;
  evidence: number;
  t: number;
};

export type Calibration = {
  t: number;
  score: number;
  changed: string[];
  matter: string[];
  shift: string[];
  drew: Array<{ mind: MindId; name: string }>;
};

export const SKILL_KEY = "kiyoshi.eye.skills.v1";
export const CAL_KEY = "kiyoshi.eye.calibrate.v1";

const MAX_SKILLS = 48;

let lastHash = "";
let lastScore = 0.7;

export function loadSkills(): Skill[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SKILL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Skill[]).slice(-MAX_SKILLS) : [];
  } catch {
    return [];
  }
}

export function persistSkills(pool: Skill[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SKILL_KEY, JSON.stringify(pool.slice(-MAX_SKILLS)));
  } catch {
    /* quota */
  }
}

export function persistCalibration(score: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CAL_KEY, JSON.stringify({ score, t: Date.now() }));
  } catch {
    /* quota */
  }
}

export function skillId(mind: MindId, name: string): string {
  return `${mind}:${name}`;
}

export function publish(pool: Skill[], next: Omit<Skill, "evidence" | "t"> & { evidence?: number; t?: number }): Skill[] {
  const t = next.t ?? Date.now();
  const existing = pool.find((s) => s.id === next.id);
  if (existing) {
    if (t - existing.t < 12_000) return pool;
    return pool.map((s) =>
      s.id === next.id
        ? {
            ...s,
            evidence: s.evidence + (next.evidence ?? 1),
            t,
            lng: next.lng,
            lat: next.lat,
            klass: next.klass ?? s.klass,
          }
        : s,
    );
  }
  return [...pool, { ...next, evidence: next.evidence ?? 1, t }].slice(-MAX_SKILLS);
}

/** Skills from other minds that apply to this look-at. When one learns, all benefit. */
export function draw(pool: Skill[], mind: MindId, klass?: string | null): Skill[] {
  return pool.filter((s) => s.mind !== mind && (!klass || !s.klass || s.klass === klass));
}

export function shareLook(args: {
  pool: Skill[];
  scene: IomScene | null;
  patches?: ZonePatch[];
  consequences?: Consequence[];
  now?: number;
}): Skill[] {
  const { scene, patches = [], consequences = [], now = Date.now() } = args;
  let pool = args.pool;
  if (!scene) return pool;
  const learned = resolveZone(patches, scene.lng, scene.lat, scene.zoneClass, scene.zoneLabel);
  if (learned.patch) {
    pool = publish(pool, {
      id: skillId("walk", `district:${learned.class}`),
      mind: "walk",
      name: `this is ${learned.label.toLowerCase()}`,
      klass: learned.class ?? undefined,
      lng: scene.lng,
      lat: scene.lat,
      t: now,
    });
    pool = publish(pool, {
      id: skillId("zone", `read:${learned.class}`),
      mind: "zone",
      name: `read ${learned.label.toLowerCase()}`,
      klass: learned.class ?? undefined,
      lng: scene.lng,
      lat: scene.lat,
      t: now,
    });
  }
  for (const c of consequences) {
    const mind: MindId =
      c.target === "transit"
        ? "transit"
        : c.target === "wildlife"
          ? "wildlife"
          : c.target === "plants"
            ? "plants"
            : c.cause.includes("iot")
              ? "iot"
              : "kiyoshi";
    pool = publish(pool, {
      id: skillId(mind, c.id),
      mind,
      name: c.title.toLowerCase(),
      klass: learned.class ?? undefined,
      lng: scene.lng,
      lat: scene.lat,
      t: now,
    });
  }
  return pool;
}

function tickHash(scene: IomScene | null, overlays: OverlayState, patches: ZonePatch[]): string {
  if (!scene) return "";
  return [
    scene.zoneClass ?? "",
    scene.precip ?? 0,
    scene.events ?? 0,
    scene.alerts ?? 0,
    scene.quakes ?? 0,
    scene.wildlife ?? 0,
    scene.plants ?? 0,
    scene.sensors ?? 0,
    patches.filter((p) => p.status === "accepted").length,
    Number(overlays.iot),
    Number(overlays.transit),
  ].join("|");
}

export function calibrate(args: {
  scene: IomScene | null;
  overlays: OverlayState;
  patches?: ZonePatch[];
  pool?: Skill[];
  now?: number;
}): Calibration {
  const { scene, overlays, patches = [], pool = [], now = Date.now() } = args;
  const hash = tickHash(scene, overlays, patches);
  const changed: string[] = [];
  if (lastHash && hash !== lastHash) {
    const prev = lastHash.split("|");
    const next = hash.split("|");
    const labels = ["zone", "precip", "events", "alerts", "quakes", "wildlife", "plants", "sensors", "patches"];
    for (let i = 0; i < labels.length; i++) {
      if (prev[i] !== next[i]) changed.push(labels[i]);
    }
  }
  lastHash = hash;

  const learned = scene
    ? resolveZone(patches, scene.lng, scene.lat, scene.zoneClass, scene.zoneLabel)
    : null;
  const klass = learned?.class ?? scene?.zoneClass ?? null;
  const mismatch =
    overlays.wildlife &&
    (scene?.wildlife ?? 0) > 0 &&
    (klass === "industrial" || klass === "extractive" || klass === "garages");
  const hazard = (scene?.events ?? 0) > 0 || (scene?.alerts ?? 0) > 0 || (scene?.precip ?? 0) >= 0.2;
  const queued = learned?.queued ?? 0;
  const wired = overlays.iot && (scene?.sensors ?? 0) > 0;

  let score = 0.72;
  if (learned?.immediate) score += 0.1;
  if (mismatch) score -= 0.22;
  if (hazard && overlays.transit) score += 0.04;
  if (queued > 0) score -= 0.04;
  if (wired) score += 0.06;
  if (pool.length > 0) score += Math.min(0.08, pool.length * 0.01);
  score = Math.max(0.16, Math.min(0.98, score));

  const matter: string[] = [];
  if (mismatch) matter.push("wildlife fights this district");
  if (hazard) matter.push("live hazard in the look-at");
  if (learned?.immediate) matter.push("learned ground is in force");
  if (wired) matter.push("sensors are live");
  if (changed.includes("zone")) matter.push("the district itself moved");

  const cons = orchestrate({ scene, overlays, patches });
  const shift = cons.filter((c) => c.action === "reroute" || c.action === "adapt" || c.action === "anticipate").map((c) => c.title);

  const drewRaw = klass
    ? draw(pool, "kiyoshi", klass)
        .slice(0, 6)
        .map((s) => ({ mind: s.mind, name: s.name }))
    : [];
  const seen = new Set<MindId>();
  const drew: Calibration["drew"] = [];
  for (const d of drewRaw) {
    if (seen.has(d.mind)) continue;
    seen.add(d.mind);
    drew.push(d);
  }

  lastScore = score;
  persistCalibration(score);
  return { t: now, score, changed, matter, shift, drew };
}

export function syncMinds(args: {
  scene: IomScene | null;
  overlays: OverlayState;
  patches?: ZonePatch[];
  pool?: Skill[];
  now?: number;
}): { pool: Skill[]; calibration: Calibration; consequences: Consequence[] } {
  const { scene, overlays, patches = [], now = Date.now() } = args;
  const consequences = orchestrate({ scene, overlays, patches });
  const pool = shareLook({
    pool: args.pool ?? loadSkills(),
    scene,
    patches,
    consequences,
    now,
  });
  persistSkills(pool);
  const calibration = calibrate({ scene, overlays, patches, pool, now });
  return { pool, calibration, consequences };
}

export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function resetMindsForTests(): void {
  lastHash = "";
  lastScore = 0.7;
}
