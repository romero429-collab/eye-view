import { OVERLAYS, type OverlayId, type OverlayState } from "@/lib/basemaps";
import { LAYER_META } from "@/lib/layer-meta";
import { OVERLAY_INK } from "@/lib/heat";
import { cn } from "@/lib/utils";

type LayerPanelProps = {
  value: OverlayState;
  onToggle: (id: OverlayId) => void;
  liveNote?: string;
};

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
      <p className="px-1.5 pt-0.5 pb-1 text-xs font-medium uppercase tracking-label text-subtle">
        {title}
      </p>
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
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  on ? "" : "bg-border-strong",
                )}
                style={
                  on
                    ? { background: OVERLAY_INK[item.id] ?? "var(--color-primary)" }
                    : undefined
                }
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CompactLayers({
  value,
  onToggle,
}: {
  value: OverlayState;
  onToggle: (id: OverlayId) => void;
}) {
  return (
    <div className="flex max-w-[min(100%,17rem)] flex-wrap gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface p-1 shadow-[var(--shadow-panel)]">
      {OVERLAYS.map((item) => {
        const Icon = LAYER_META[item.id].icon;
        const on = value[item.id];
        return (
          <button
            key={item.id}
            type="button"
            title={`${item.label}. ${LAYER_META[item.id].usage}`}
            aria-label={`${item.label}. ${LAYER_META[item.id].usage}`}
            aria-pressed={on}
            onClick={() => onToggle(item.id)}
            className={cn(
              "flex size-9 items-center justify-center rounded-[var(--radius-xs)]",
              on ? "text-primary" : "text-subtle hover:text-fg",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}

export function LayerPanel({ value, onToggle, liveNote }: LayerPanelProps) {
  return (
    <div className="max-h-[min(28dvh,12rem)] max-w-[min(100%,18rem)] overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface p-1.5 shadow-[var(--shadow-panel)] md:max-h-[min(42dvh,24rem)] md:max-w-56 md:p-2">
      <OverlayGroup
        title="Over satellite"
        items={OVERLAYS.filter((item) => item.group === "map")}
        value={value}
        onToggle={onToggle}
      />
      <OverlayGroup
        title="Animal trails"
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
      {liveNote ? (
        <p className="px-2 pt-1 text-xs text-subtle">{liveNote}</p>
      ) : null}
    </div>
  );
}
