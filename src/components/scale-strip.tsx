import type { PlaceKind } from "@/lib/places";
import { TIER_HINT, TIER_ORDER } from "@/lib/scale";
import { cn } from "@/lib/utils";

type ScaleStripProps = {
  tier: PlaceKind;
  onPick: (kind: PlaceKind) => void;
};

const SHORT: Record<PlaceKind, string> = {
  country: "Country",
  state: "State",
  county: "County",
  city: "City",
  plot: "Plot",
};

export function ScaleStrip({ tier, onPick }: ScaleStripProps) {
  return (
    <div
      className="flex max-w-full overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface p-1 shadow-[var(--shadow-panel)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Map scale"
    >
      {TIER_ORDER.map((kind) => {
        const active = kind === tier;
        return (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={active}
            title={TIER_HINT[kind]}
            onClick={() => onPick(kind)}
            className={cn(
              "h-9 shrink-0 rounded-[var(--radius-xs)] px-2.5 text-xs font-medium md:h-8",
              active ? "bg-bg-warm text-fg" : "text-muted hover:text-fg",
            )}
          >
            {SHORT[kind]}
          </button>
        );
      })}
    </div>
  );
}
