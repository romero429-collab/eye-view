import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  KIND_LABEL,
  searchPlaces,
  type Place,
  type PlaceKind,
} from "@/lib/places";
import { TIER_HINT } from "@/lib/scale";
import { cn } from "@/lib/utils";

const KIND_FILTERS: Array<PlaceKind | "all"> = [
  "all",
  "country",
  "state",
  "county",
  "city",
  "plot",
];

type PlaceSearchProps = {
  onPick: (place: Place) => void;
  tier: PlaceKind;
  origin: { lat: number; lon: number };
};

export function PlaceSearch({ onPick, tier, origin }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [kind, setKind] = useState<PlaceKind | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 1) return [];
    return searchPlaces(query, { tier, kind, origin, limit: 10 });
  }, [query, tier, kind, origin]);

  const pick = (place: Place) => {
    onPick(place);
    setQuery("");
    setOpen(false);
    setActive(0);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full md:w-80">
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
          window.setTimeout(() => setOpen(false), 140);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
            return;
          }
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            const hit = results[active];
            if (hit) pick(hit);
          }
        }}
        placeholder={TIER_HINT[tier]}
        aria-label="Search places"
        autoComplete="off"
        className="h-11 w-full rounded-[var(--radius-sm)] border border-border bg-surface pr-3 pl-9 text-sm text-fg outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring/40 md:h-10"
      />
      {open ? (
        <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-panel)] md:left-auto md:w-[22rem]">
          <div className="flex gap-1 overflow-x-auto border-b border-border p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {KIND_FILTERS.map((id) => (
              <button
                key={id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setKind(id);
                  setActive(0);
                }}
                className={cn(
                  "h-8 shrink-0 rounded-[var(--radius-xs)] px-2.5 text-xs font-medium",
                  kind === id
                    ? "bg-bg-warm text-fg"
                    : "text-muted hover:text-fg",
                )}
              >
                {id === "all" ? "All" : KIND_LABEL[id].split(" ")[0]}
              </button>
            ))}
          </div>
          {query.trim().length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">
              Try a country, state, county, city, or plot type.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">No matching places.</p>
          ) : (
            <ul role="listbox" className="max-h-[min(22rem,55dvh)] overflow-y-auto py-1">
              {results.map((place, i) => (
                <li key={place.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left",
                      i === active ? "bg-bg-warm" : "hover:bg-bg-warm",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(place)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {place.name}
                      </span>
                      <span className="text-xs text-subtle">
                        {KIND_LABEL[place.kind]}
                        {place.plotType ? ` · ${place.plotType}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs uppercase tracking-wide text-subtle">
                      {place.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
