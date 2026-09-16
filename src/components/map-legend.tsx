import { METRICS, type MetricId } from "@/lib/metrics";
import type { LegendStop } from "@/lib/color-scale";
import { COVER_SWATCHES, HEAT_RAMPS, LANDUSE_SWATCHES, type HeatRampId } from "@/lib/heat";

type MapLegendProps = {
  metric: MetricId;
  stops: LegendStop[];
};

export function MapLegend({ metric, stops }: MapLegendProps) {
  const def = METRICS[metric];
  return (
    <div
      className="pointer-events-none max-w-56 rounded-[calc(var(--radius-md)+4px)] border border-border bg-surface p-3 shadow-[var(--shadow-panel)] md:max-w-72"
      role="img"
      aria-label={`${def.label} legend`}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-label text-subtle">
        {def.label}
      </p>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {stops.map((stop) => (
          <span
            key={stop.label}
            className="h-full flex-1"
            style={{ background: stop.color }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 font-medium tabular-nums text-xs text-muted">
        <span>{stops[0] ? def.formatShort(stops[0].min) : ""}</span>
        <span>
          {stops.length
            ? def.formatShort(stops[stops.length - 1]!.max)
            : ""}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-subtle">
        <span
          className="size-2.5 rounded-sm"
          style={{ background: "var(--color-nodata)" }}
        />
        No data
      </div>
    </div>
  );
}

export function HeatLegend({ ramp, title }: { ramp: HeatRampId; title: string }) {
  const stops = HEAT_RAMPS[ramp].filter((s) => s.t > 0);
  return (
    <div
      className="pointer-events-none max-w-56 rounded-[calc(var(--radius-md)+4px)] border border-border bg-surface p-3 shadow-[var(--shadow-panel)] md:max-w-72"
      role="img"
      aria-label={title}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-label text-subtle">
        {title}
      </p>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {stops.map((stop) => (
          <span
            key={stop.label}
            className="h-full flex-1"
            style={{ background: stop.color }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 font-medium text-xs text-muted">
        <span>{stops[0]?.label}</span>
        <span>{stops[stops.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function OverlayKey({
  zoning,
  wildlife,
  quakes,
  livestock,
}: {
  zoning: boolean;
  wildlife: boolean;
  quakes: boolean;
  livestock: boolean;
}) {
  const ramps: Array<{ id: HeatRampId; title: string }> = [];
  if (wildlife) ramps.push({ id: "wildlife", title: "Wild" });
  if (livestock) ramps.push({ id: "livestock", title: "Domestic" });
  if (quakes) ramps.push({ id: "quakes", title: "Quakes" });
  if (!zoning && ramps.length === 0) return null;
  return (
    <div
      className="pointer-events-none max-w-56 rounded-[calc(var(--radius-md)+4px)] border border-border bg-surface p-3 shadow-[var(--shadow-panel)] md:max-w-72"
      role="img"
      aria-label="Active overlay key"
    >
      {zoning ? (
        <>
          <p className="mb-2 text-xs font-medium uppercase tracking-label text-subtle">
            Land use
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {LANDUSE_SWATCHES.map((swatch) => (
              <li key={swatch.id} className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: swatch.color }}
                />
                <span className="truncate">{swatch.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 mb-1.5 text-xs font-medium uppercase tracking-label text-subtle">
            Cover
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {COVER_SWATCHES.map((swatch) => (
              <li key={swatch.id} className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: swatch.color }}
                />
                <span className="truncate">{swatch.label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {ramps.map((ramp) => {
        const stops = HEAT_RAMPS[ramp.id].filter((s) => s.t > 0);
        return (
          <div key={ramp.id} className={zoning ? "mt-3" : ramps[0]?.id === ramp.id ? "" : "mt-3"}>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-label text-subtle">
              {ramp.title} heat
            </p>
            <div className="flex h-2 overflow-hidden rounded-full">
              {stops.map((stop) => (
                <span
                  key={stop.label}
                  className="h-full flex-1"
                  style={{ background: stop.color }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>{stops[0]?.label}</span>
              <span>{stops[stops.length - 1]?.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
