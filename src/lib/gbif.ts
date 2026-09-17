/** GBIF occurrence + species helpers. Vernacular names are not on
 *  occurrence search; they live on /species/{key}/vernacularNames. */

export type GbifMedia = {
  type?: string;
  identifier?: string;
  format?: string;
};

export type GbifOccurrence = {
  decimalLatitude?: number;
  decimalLongitude?: number;
  species?: string;
  scientificName?: string;
  acceptedScientificName?: string;
  country?: string;
  eventDate?: string;
  basisOfRecord?: string;
  taxonKey?: number;
  speciesKey?: number;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genericName?: string;
  recordedBy?: string;
  iucnRedListCategory?: string;
  media?: GbifMedia[];
};

export type GbifVernacular = {
  vernacularName?: string;
  language?: string;
};

/** Mammals, birds, amphibians, squamates (GBIF files reptiles under Squamata, not class Reptilia). */
export const WILDLIFE_TAXA: Array<{ key: number; label: string }> = [
  { key: 359, label: "mammal" },
  { key: 212, label: "bird" },
  { key: 131, label: "amphibian" },
  { key: 11592253, label: "reptile" },
];

export function pickVernacular(names: GbifVernacular[]): string | null {
  const counts = new Map<string, number>();
  for (const row of names) {
    const raw = row.vernacularName?.trim();
    if (!raw || raw.length > 48) continue;
    const lang = (row.language ?? "").toLowerCase();
    if (lang && lang !== "eng" && lang !== "en") continue;
    if (/aceae|idae|iformes/.test(raw)) continue;
    const boost = lang === "eng" || lang === "en" ? 12 : 2;
    counts.set(raw, (counts.get(raw) ?? 0) + boost);
  }
  let best: string | null = null;
  let score = 0;
  for (const [name, n] of counts) {
    const words = name.split(/\s+/).length;
    const s = n - Math.abs(words - 2);
    if (s > score) {
      score = s;
      best = name;
    }
  }
  return best;
}

export function photoUrl(rec: GbifOccurrence): string | null {
  const media = rec.media ?? [];
  const still = media.find((m) => (m.type ?? "").toLowerCase().includes("image") || (m.format ?? "").startsWith("image/"));
  const url = still?.identifier ?? media[0]?.identifier;
  if (!url || !/^https:\/\//.test(url)) return null;
  return url.replace("/original.", "/medium.").replace("/original/", "/medium/");
}

export function occurrenceTitle(rec: GbifOccurrence, common?: string | null, fallback = "Occurrence"): string {
  return common || rec.species || rec.scientificName || fallback;
}

export function occurrenceFacts(
  rec: GbifOccurrence,
  common?: string | null,
): Array<{ label: string; value: string }> {
  return [
    common ? { label: "Common", value: common } : null,
    rec.scientificName ? { label: "Taxon", value: rec.scientificName } : null,
    rec.family ? { label: "Family", value: rec.family } : null,
    rec.class ? { label: "Class", value: rec.class } : null,
    rec.iucnRedListCategory ? { label: "IUCN", value: rec.iucnRedListCategory } : null,
    rec.country ? { label: "Country", value: rec.country } : null,
    rec.eventDate ? { label: "When", value: rec.eventDate.slice(0, 10) } : null,
    rec.recordedBy ? { label: "By", value: rec.recordedBy } : null,
    rec.basisOfRecord ? { label: "Basis", value: rec.basisOfRecord.replace(/_/g, " ") } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
}

export function lidarSummary(args: {
  workunit?: string | null;
  project?: string | null;
  ql?: string | null;
  gsd?: number | null;
  points?: number | null;
  year?: number | null;
  ept?: boolean;
}): string {
  const bits = [
    args.workunit,
    args.ql && args.ql !== "Other" ? args.ql : null,
    args.gsd != null ? `${args.gsd < 1 ? args.gsd.toFixed(2) : Math.round(args.gsd)} m` : null,
    args.year ? String(args.year) : null,
    args.points != null ? `${(args.points / 1e9).toFixed(1)}B pts` : null,
    args.ept ? "EPT" : null,
  ].filter(Boolean);
  return bits.join(" · ") || "No lidar workunit at look-at";
}
