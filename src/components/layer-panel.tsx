import { IMAGERY, OVERLAYS, type ImageryId, type OverlayId, type OverlayState } from "@/lib/basemaps";
import { LAYER_META } from "@/lib/layer-meta";
import { OVERLAY_INK } from "@/lib/heat";
import { METRIC_LIST, type MetricId } from "@/lib/metrics";
import { cn } from "@/lib/utils";

type LayerPanelProps = {
  value: OverlayState;
  onToggle: (id: OverlayId) => void;
  metric: MetricId;
  onMetric: (id: MetricId) => void;
  imagery: ImageryId;
  onImagery: (id: ImageryId) => void;
  liveNote?: string;
};

function GroupTitle({ children }: { children: string }) {
  return (
    <p className="px-1.5 pt-0.5 pb-1 text-xs font-medium uppercase tracking-label text-subtle">
      {children}
    </p>
  );
}

function Row({
  label,
  title,
  on,
  onClick,
  ink,
}: {
  label: string;
  title: string;
  on: boolean;
  onClick: () => void;
  ink?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={`${label}. ${title}`}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-10 items-center justify-between gap-2 rounded-[var(--radius-xs)] px-2 text-left text-sm",
        on ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      <span className="truncate font-medium">{label}</span>
      <span
        className={cn("size-2 shrink-0 rounded-full", on ? "" : "bg-border-strong")}
        style={on ? { background: ink ?? "var(--color-primary)" } : undefined}
      />
    </button>
  );
}

function OverlayGroup({
  title,
  items,
  value,
  onToggle,
}: {
  title: string;
  items: typeof OVERLAYS;
  value: OverlayState;
  onToggle: (id: OverlayId) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <GroupTitle>{title}</GroupTitle>
      <div className="grid grid-cols-2 gap-0.5 md:flex md:flex-col">
        {items.map((item) => {
          const on = value[item.id];
          const Icon = LAYER_META[item.id].icon;
          return (
            <button
              key={item.id}
              type="button"
              title={LAYER_META[item.id].usage}
              aria-label={`${item.label}. ${LAYER_META[item.id].usage}`}
              aria-pressed={on}
              onClick={() => onToggle(item.id)}
              className={cn(
                "flex min-h-10 items-center justify-between gap-2 rounded-[var(--radius-xs)] px-2 text-left text-sm md:gap-3",
                on ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate font-medium">{item.label}</span>
              </span>
              <span
                className={cn("size-2 shrink-0 rounded-full", on ? "" : "bg-border-strong")}
                style={on ? { background: OVERLAY_INK[item.id] ?? "var(--color-primary)" } : undefined}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LayerPanel({
  value,
  onToggle,
  metric,
  onMetric,
  imagery,
  onImagery,
  liveNote,
}: LayerPanelProps) {
  const mapLayers = OVERLAYS.filter((item) => item.group === "map" && item.id !== "metric");
  return (
    <div className="w-[min(100%,18rem)] rounded-[var(--radius-md)] border border-border bg-surface p-1.5 shadow-[var(--shadow-panel)] md:w-56 md:p-2">
      <div>
        <GroupTitle>Satellite</GroupTitle>
        <div className="flex flex-col gap-0.5">
          {IMAGERY.map((item) => (
            <Row
              key={item.id}
              label={item.label}
              title={item.detail}
              on={imagery === item.id}
              onClick={() => onImagery(item.id)}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5">
        <GroupTitle>Countries</GroupTitle>
        <div className="flex flex-col gap-0.5">
          {METRIC_LIST.map((item) => {
            const on = value.metric && metric === item.id;
            return (
              <Row
                key={item.id}
                label={item.shortLabel}
                title={item.description}
                on={on}
                ink="var(--color-choropleth-6)"
                onClick={() => onMetric(item.id)}
              />
            );
          })}
        </div>
      </div>
      <OverlayGroup title="Over satellite" items={mapLayers} value={value} onToggle={onToggle} />
      <OverlayGroup
        title="Life"
        items={OVERLAYS.filter((item) => item.group === "animals")}
        value={value}
        onToggle={onToggle}
      />
      <OverlayGroup
        title="Live feeds"
        items={OVERLAYS.filter((item) => item.group === "live")}
        value={value}
        onToggle={onToggle}
      />
      {liveNote ? <p className="px-2 pt-1 text-xs text-subtle">{liveNote}</p> : null}
    </div>
  );
}