import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryPanel } from "@/components/country-panel";
import {
  KIND_LABEL,
  PLOT_LABEL,
  childrenOf,
  placePath,
  type Place,
} from "@/lib/places";
import { lookupCountry } from "@/lib/countries";
import { type MetricId } from "@/lib/metrics";
import { cn } from "@/lib/utils";

type PlacePanelProps = {
  place: Place | null;
  metric: MetricId;
  onSelect: (id: string) => void;
  onClose: () => void;
  className?: string;
};

export function PlacePanel({
  place,
  metric,
  onSelect,
  onClose,
  className,
}: PlacePanelProps) {
  if (!place || place.kind === "country") {
    const country = place
      ? (lookupCountry({ id: place.id }) ?? null)
      : null;
    return (
      <CountryPanel
        country={country}
        metric={metric}
        onSelect={onSelect}
        onClose={onClose}
        className={className}
      />
    );
  }

  const crumbs = placePath(place);
  const country = lookupCountry({ id: place.countryId });
  const kids = childrenOf(place.id);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-l border-border bg-surface",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-label text-subtle">
            {KIND_LABEL[place.kind]}
          </p>
          <h2 className="font-display mt-1 text-2xl leading-tight font-medium tracking-display text-fg">
            {place.name}
          </h2>
          {place.plotType ? (
            <p className="mt-1 text-sm text-muted">
              {PLOT_LABEL[place.plotType]}
            </p>
          ) : country ? (
            <p className="mt-1 text-sm text-muted">{country.name}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-10 shrink-0"
          onClick={onClose}
          aria-label="Clear selection"
        >
          <X />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="flex flex-wrap gap-1.5">
          {crumbs.map((crumb) => (
            <button
              key={crumb.id}
              type="button"
              className="max-w-full"
              onClick={() => onSelect(crumb.id)}
            >
              <Badge variant={crumb.id === place.id ? "default" : "muted"}>
                {crumb.name}
              </Badge>
            </button>
          ))}
        </div>

        {place.population ? (
          <p className="mt-4 text-sm text-muted">
            Population{" "}
            <span className="font-medium tabular-nums text-fg">
              {place.population.toLocaleString()}
            </span>
          </p>
        ) : null}

        {kids.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-label text-subtle">
              Inside
            </p>
            <ul className="divide-y divide-border">
              {kids.slice(0, 10).map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
                    onClick={() => onSelect(child.id)}
                  >
                    <span className="text-sm font-medium">{child.name}</span>
                    <span className="text-xs text-subtle">
                      {KIND_LABEL[child.kind].split(" ")[0]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {country ? (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-label text-subtle">
              National context
            </p>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-md)] bg-bg-warm px-3 py-2 text-left"
              onClick={() => onSelect(country.id)}
            >
              <span className="text-sm font-medium">{country.name}</span>
              <span className="text-xs text-subtle">{country.iso3}</span>
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
