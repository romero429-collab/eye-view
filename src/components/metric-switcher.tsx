import { METRIC_LIST, type MetricId } from "@/lib/metrics";
import { cn } from "@/lib/utils";

type MetricSwitcherProps = {
  value: MetricId;
  onChange: (id: MetricId) => void;
};

export function MetricSwitcher({ value, onChange }: MetricSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Map metric"
      className="flex gap-1 overflow-x-auto rounded-[calc(var(--radius-md)+4px)] bg-bg-warm p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {METRIC_LIST.map((metric) => {
        const active = metric.id === value;
        return (
          <button
            key={metric.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(metric.id)}
            className={cn(
              "shrink-0 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
              "min-h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active
                ? "bg-surface text-fg shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-fg)_8%,transparent)]"
                : "text-muted hover:text-fg",
            )}
          >
            {metric.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
