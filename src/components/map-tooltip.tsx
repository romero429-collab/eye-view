import { METRICS, countryValue, type MetricId } from "@/lib/metrics";
import type { HoverInfo } from "@/lib/map-types";

type MapTooltipProps = {
  hover: HoverInfo | null;
  metric: MetricId;
  containerWidth: number;
};

export function MapTooltip({ hover, metric, containerWidth }: MapTooltipProps) {
  if (!hover) return null;
  const def = METRICS[metric];
  const value = hover.country ? countryValue(hover.country, metric) : null;
  const name = hover.country?.name ?? hover.atlasName;
  const left = Math.min(Math.max(12, hover.x + 14), containerWidth - 196);
  const top = Math.max(12, hover.y - 12);

  return (
    <div
      className="pointer-events-none absolute z-20 w-44 -translate-y-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 shadow-[var(--shadow-panel)]"
      style={{ left, top }}
      role="tooltip"
    >
      <p className="text-sm font-medium leading-tight tracking-tight text-fg">
        {hover.live ? hover.live.title : name}
      </p>
      {hover.live ? (
        <p className="mt-1 text-xs leading-relaxed text-muted">{hover.live.detail}</p>
      ) : hover.country ? (
        <p className="mt-0.5 text-xs uppercase tracking-label text-subtle">
          {hover.country.region}
        </p>
      ) : null}
      {hover.live ? null : (
        <>
          <p className="mt-2 text-sm tabular-nums text-fg">
            {value == null ? "No data" : def.format(value)}
          </p>
          <p className="text-xs text-muted">{def.shortLabel}</p>
        </>
      )}
    </div>
  );
}
