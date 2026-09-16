import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  METRIC_LIST,
  METRICS,
  countryValue,
  type CountryRecord,
  type MetricId,
} from "@/lib/metrics";
import { countryRank, metricExtent, rankedCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";

type CountryPanelProps = {
  country: CountryRecord | null;
  metric: MetricId;
  onSelect: (id: string) => void;
  onClose: () => void;
  className?: string;
};

export function CountryPanel({
  country,
  metric,
  onSelect,
  onClose,
  className,
}: CountryPanelProps) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-l border-border bg-surface",
        className,
      )}
    >
      {country ? (
        <SelectedBody country={country} metric={metric} onClose={onClose} />
      ) : (
        <LeadersBody metric={metric} onSelect={onSelect} />
      )}
    </aside>
  );
}

function SelectedBody({
  country,
  metric,
  onClose,
}: {
  country: CountryRecord;
  metric: MetricId;
  onClose: () => void;
}) {
  const def = METRICS[metric];
  const value = countryValue(country, metric);
  const rank = countryRank(country, metric);
  const extent = metricExtent(metric);

  return (
    <>
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-label text-subtle">
            {country.region}
          </p>
          <h2 className="font-display mt-1 text-2xl leading-tight font-medium tracking-display text-fg">
            {country.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {country.capital}
            <span className="mx-1.5 text-subtle">·</span>
            {country.iso3}
          </p>
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
        <div className="rounded-[var(--radius-md)] bg-bg-warm px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-label text-subtle">
            {def.label}
          </p>
          <p className="mt-1 font-display text-3xl leading-none font-medium tracking-display tabular-nums text-fg">
            {value == null ? "—" : def.format(value)}
          </p>
          {rank ? (
            <p className="mt-2 text-sm text-muted">
              Rank{" "}
              <span className="font-medium tabular-nums text-fg">{rank.rank}</span>
              <span className="text-subtle"> / {rank.total}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Not ranked for this metric</p>
          )}
          {extent && value != null ? (
            <ComparisonBar value={value} extent={extent} />
          ) : null}
        </div>

        <h3 className="mt-6 mb-2 text-xs font-medium uppercase tracking-label text-subtle">
          All metrics
        </h3>
        <ul className="divide-y divide-border">
          {METRIC_LIST.map((m) => {
            const v = countryValue(country, m.id);
            const ext = metricExtent(m.id);
            const active = m.id === metric;
            return (
              <li key={m.id} className={cn("py-3", active && "opacity-100")}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cn("text-sm", active ? "font-medium text-fg" : "text-muted")}>
                    {m.shortLabel}
                  </span>
                  <span className="text-sm tabular-nums text-fg">
                    {v == null ? "—" : m.format(v)}
                  </span>
                </div>
                {ext && v != null ? (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-warm">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(4, ((v - ext.min) / Math.max(ext.max - ext.min, 1e-9)) * 100)}%`,
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-subtle">
          Illustrative 2022–2024 figures for demonstration. Values are rounded
          and may differ from official releases.
        </p>
      </div>
    </>
  );
}

function LeadersBody({
  metric,
  onSelect,
}: {
  metric: MetricId;
  onSelect: (id: string) => void;
}) {
  const def = METRICS[metric];
  const ranked = rankedCountries(metric);
  const top = ranked.slice(0, 8);
  const bottom = ranked.slice(-8).reverse();
  const extent = metricExtent(metric);

  return (
    <>
      <header className="px-5 pt-5 pb-3">
        <p className="text-xs font-medium uppercase tracking-label text-subtle">
          Atlas
        </p>
        <h2 className="font-display mt-1 text-2xl leading-tight font-medium tracking-display">
          {def.label}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{def.description}</p>
        {extent ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="muted">
              Min {def.formatShort(extent.min)}
            </Badge>
            <Badge variant="muted">
              Median {def.formatShort(extent.median)}
            </Badge>
            <Badge variant="muted">
              Max {def.formatShort(extent.max)}
            </Badge>
          </div>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <RankList title="Highest" items={top} metric={metric} onSelect={onSelect} />
        <RankList
          title="Lowest"
          items={bottom}
          metric={metric}
          onSelect={onSelect}
          offset={ranked.length - bottom.length}
        />
        <p className="mt-6 text-sm text-muted">
          Select a country on the map, or search by name, to see a full profile.
        </p>
      </div>
    </>
  );
}

function RankList({
  title,
  items,
  metric,
  onSelect,
  offset = 0,
}: {
  title: string;
  items: CountryRecord[];
  metric: MetricId;
  onSelect: (id: string) => void;
  offset?: number;
}) {
  const def = METRICS[metric];
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-label text-subtle">
        {title}
      </h3>
      <ol className="flex flex-col gap-0.5">
        {items.map((c, i) => {
          const v = countryValue(c, metric);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex min-h-10 w-full items-center gap-3 rounded-[var(--radius-sm)] px-2 text-left transition-colors duration-150 hover:bg-bg-warm"
              >
                <span className="w-5 text-xs tabular-nums text-subtle">
                  {offset + i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {c.name}
                </span>
                <span className="text-sm tabular-nums text-muted">
                  {v == null ? "—" : def.formatShort(v)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ComparisonBar({
  value,
  extent,
}: {
  value: number;
  extent: { min: number; max: number; median: number };
}) {
  const span = Math.max(extent.max - extent.min, 1e-9);
  const pos = ((value - extent.min) / span) * 100;
  const med = ((extent.median - extent.min) / span) * 100;
  return (
    <div className="relative mt-4 h-2 rounded-full bg-surface">
      <div
        className="absolute top-0 left-0 h-full rounded-full bg-primary/70"
        style={{ width: `${pos}%` }}
      />
      <span
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
        style={{ left: `${med}%` }}
        title="World median"
      />
    </div>
  );
}
