import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import type { MapObject } from "@/lib/map-types";
import { cn } from "@/lib/utils";

type CountrySearchProps = {
  onPick: (id: string) => void;
  onPickAddress?: (object: MapObject) => void;
};

type AddressHit = {
  title: string;
  detail: string;
  object: MapObject;
};

export function CountrySearch({ onPick, onPickAddress }: CountrySearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [addresses, setAddresses] = useState<AddressHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const countries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso3.toLowerCase().includes(q) ||
        c.capital.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 4) {
      setAddresses([]);
      return;
    }
    const looksAddress = /\d/.test(q) || q.includes(",") || q.split(/\s+/).length >= 3;
    if (!looksAddress) {
      setAddresses([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/live?kind=geocode&name=${encodeURIComponent(q)}`);
          if (!res.ok) return;
          const data = (await res.json()) as GeoJSON.FeatureCollection;
          if (cancelled) return;
          const hits: AddressHit[] = [];
          for (const feat of data.features ?? []) {
            const props = (feat.properties ?? {}) as Record<string, string>;
            const coords = feat.geometry?.type === "Point" ? feat.geometry.coordinates : null;
            if (!coords) continue;
            let facts: MapObject["facts"];
            try {
              facts = props.facts ? (JSON.parse(props.facts) as MapObject["facts"]) : undefined;
            } catch {
              facts = undefined;
            }
            hits.push({
              title: String(props.title ?? q),
              detail: String(props.detail ?? ""),
              object: {
                kind: (props.kind as MapObject["kind"]) || "address",
                title: String(props.title ?? q),
                detail: String(props.detail ?? ""),
                source: String(props.source ?? "Nominatim"),
                facts,
                lng: coords[0],
                lat: coords[1],
              },
            });
          }
          setAddresses(hits);
        } catch {
          if (!cancelled) setAddresses([]);
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const rows: Array<
    | { type: "country"; id: string; title: string; detail: string }
    | { type: "address"; title: string; detail: string; object: MapObject }
  > = [
    ...countries.map((c) => ({
      type: "country" as const,
      id: c.id,
      title: c.name,
      detail: c.iso3,
    })),
    ...addresses.map((a) => ({
      type: "address" as const,
      title: a.title,
      detail: a.detail,
      object: a.object,
    })),
  ];

  const pickRow = (i: number) => {
    const row = rows[i];
    if (!row) return;
    if (row.type === "country") onPick(row.id);
    else onPickAddress?.(row.object);
    setQuery("");
    setOpen(false);
    setActive(0);
  };

  return (
    <div className="relative w-full md:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
            return;
          }
          if (!open || rows.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(rows.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            pickRow(active);
          }
        }}
        placeholder="Country or address"
        aria-label="Find a country or site address"
        className="h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface pr-3 pl-9 text-sm text-fg outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {open && rows.length > 0 ? (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-[var(--shadow-panel)]"
        >
          {rows.map((row, i) => (
            <li key={row.type === "country" ? row.id : `${row.title}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left text-sm",
                  i === active ? "bg-bg-warm" : "hover:bg-bg-warm",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickRow(i)}
              >
                <span className="min-w-0 truncate font-medium">{row.title}</span>
                <span className="shrink-0 text-xs tracking-wide text-subtle">
                  {row.type === "country" ? row.detail : "Address"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
