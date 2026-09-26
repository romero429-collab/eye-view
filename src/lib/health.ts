/** Respiratory counts and outbreak headlines, joined onto a country. */

export type FluRow = {
  COUNTRY_AREA_TERRITORY?: string;
  ISO2?: string;
  ISO_YEAR?: number;
  ISO_WEEK?: number;
  INF_A?: number | null;
  INF_B?: number | null;
  RSV?: number | null;
  RHINO?: number | null;
  HUMAN_CORONA?: number | null;
  ADENO?: number | null;
  PARAINFLUENZA?: number | null;
  METAPNEUMO?: number | null;
  BOCA?: number | null;
  ILI_ACTIVITY?: string | null;
};

export type Outbreak = {
  disease: string;
  place: string;
  when: string;
};

const VIRUSES: Array<[keyof FluRow, string]> = [
  ["INF_A", "Flu A"],
  ["INF_B", "Flu B"],
  ["RSV", "RSV"],
  ["RHINO", "Rhino"],
  ["HUMAN_CORONA", "Coronavirus"],
  ["PARAINFLUENZA", "Parainfluenza"],
  ["ADENO", "Adeno"],
  ["METAPNEUMO", "Metapneumovirus"],
  ["BOCA", "Bocavirus"],
];

export function isoWeek(now = new Date()): { year: number; week: number } {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function fluFilter(now = new Date()): string {
  const current = isoWeek(now);
  const previous =
    current.week > 1
      ? { year: current.year, week: current.week - 1 }
      : { year: current.year - 1, week: 52 };
  return `(ISO_YEAR eq ${current.year} and ISO_WEEK eq ${current.week}) or (ISO_YEAR eq ${previous.year} and ISO_WEEK eq ${previous.week})`;
}

export function virusFacts(row: FluRow | null | undefined): Array<{ label: string; value: string }> {
  if (!row) return [];
  const facts: Array<{ label: string; value: string }> = [];
  for (const [key, label] of VIRUSES) {
    const count = Number(row[key]);
    if (Number.isFinite(count) && count > 0) facts.push({ label, value: String(Math.round(count)) });
  }
  if (row.ILI_ACTIVITY != null) {
    const text = String(row.ILI_ACTIVITY).replace(/_/g, " ");
    if (text && text !== "NOTDEFINED" && text !== "null" && text !== "0") {
      facts.push({ label: "ILI", value: text });
    }
  }
  if (row.ISO_WEEK) facts.push({ label: "Flu week", value: `${row.ISO_YEAR ?? ""}-W${row.ISO_WEEK}` });
  return facts;
}

export function indexFlu(rows: FluRow[]): Map<string, FluRow> {
  const byIso = new Map<string, FluRow>();
  for (const row of rows) {
    const key = (row.ISO2 ?? "").toUpperCase();
    if (!key) continue;
    const prev = byIso.get(key);
    if (!prev || (row.ISO_WEEK ?? 0) >= (prev.ISO_WEEK ?? 0)) byIso.set(key, row);
  }
  return byIso;
}

export function outbreakParts(title: string): { disease: string; place: string } | null {
  const parts = title.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { disease: parts.slice(0, -1).join(" - "), place: parts[parts.length - 1]! };
}

export function samePlace(a: string, b: string): boolean {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .replace(/democratic republic of the congo|dr congo|\bdrc\b/, "dr congo")
      .replace(/united states of america|\busa\b/, "united states")
      .replace(/[^a-z ]/g, "")
      .replace(/\bthe\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function outbreaksFrom(data: unknown): Outbreak[] {
  const rows = (data as { value?: Array<{ Title?: string; PublicationDate?: string }> } | null)?.value ?? [];
  const out: Outbreak[] = [];
  for (const row of rows) {
    const title = row.Title ?? "";
    const parts = outbreakParts(title);
    if (!parts) continue;
    out.push({
      disease: parts.disease,
      place: parts.place,
      when: (row.PublicationDate ?? "").slice(0, 10),
    });
  }
  return out;
}

export function sicknessLoad(virusCount: number, perMillion: number, outbreak: boolean): number {
  const viral = Math.min(1, Math.log10(virusCount + 1) / 3.5);
  const covid = Math.min(1, Math.log10(Math.max(perMillion, 1)) / 5.5);
  const base = virusCount > 0 ? viral * 0.75 + covid * 0.25 : covid * 0.7;
  return Math.round(Math.max(0.08, Math.min(1, base + (outbreak ? 0.22 : 0))) * 100) / 100;
}

export function sicknessLabel(load: number): string {
  if (load >= 0.75) return "Peak";
  if (load >= 0.5) return "High";
  if (load >= 0.28) return "Moderate";
  return "Low";
}

export function fluRowsFrom(data: unknown): FluRow[] {
  const rows = (data as { value?: FluRow[] } | null)?.value;
  return Array.isArray(rows) ? rows : [];
}
