import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LAYER_META, OBJECT_META } from "@/lib/layer-meta";
import { OVERLAYS } from "@/lib/basemaps";
import type { MapObject } from "@/lib/map-types";
import { formatDecimal, type PerceptionFrame } from "@/lib/perception";
import { cn } from "@/lib/utils";

type ObjectPanelProps = {
  object: MapObject | null;
  frame?: PerceptionFrame | null;
  onClose: () => void;
  onConfirm?: (patchId: string) => void;
  onDismiss?: (patchId: string) => void;
  showKey?: boolean;
  className?: string;
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 160;
  const h = 36;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-9 w-full text-primary"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

function RealityFrame({ frame }: { frame: PerceptionFrame }) {
  const look = formatDecimal(frame.look.lng, frame.look.lat);
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-medium uppercase tracking-label text-subtle">Reality frame</p>
      <dl className="mt-2 divide-y divide-border border-y border-border">
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-xs uppercase tracking-label text-subtle">Look-at</dt>
          <dd className="font-mono text-xs text-fg">{look}</dd>
        </div>
        {frame.zone ? (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs uppercase tracking-label text-subtle">
              {frame.zone.learned ? "Learned" : "Zone"}
            </dt>
            <dd className="text-sm font-medium text-fg">{frame.zone.label}</dd>
          </div>
        ) : null}
        {frame.zone && frame.zone.queued > 0 ? (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs uppercase tracking-label text-subtle">Queued</dt>
            <dd className="text-sm font-medium text-fg">
              {frame.zone.queued} adjacent
            </dd>
          </div>
        ) : null}
        {frame.mutation ? (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs uppercase tracking-label text-subtle">This tick</dt>
            <dd className="text-right text-sm font-medium text-fg">
              {frame.mutation.immediate ? "Immediate" : "Queued"}
              {frame.mutation.class ? ` · ${frame.mutation.class}` : ""}
            </dd>
          </div>
        ) : null}
        {frame.movement ? (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs uppercase tracking-label text-subtle">Move</dt>
            <dd className="text-right text-sm font-medium text-fg">{frame.movement.title}</dd>
          </div>
        ) : null}
        {frame.consequences[0] ? (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs uppercase tracking-label text-subtle">IOM</dt>
            <dd className="text-right text-sm font-medium text-fg">{frame.consequences[0].title}</dd>
          </div>
        ) : null}
        {frame.minds ? (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs uppercase tracking-label text-subtle">Minds</dt>
            <dd className="text-right text-sm font-medium text-fg">
              {Math.round(frame.minds.score * 100)}% · {frame.minds.skills} skills
            </dd>
          </div>
        ) : null}
        {frame.country ? (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs uppercase tracking-label text-subtle">Ground</dt>
            <dd className="text-sm font-medium text-fg">{frame.country}</dd>
          </div>
        ) : null}
        {frame.overlays.length ? (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-xs uppercase tracking-label text-subtle">Layers</dt>
            <dd className="text-right text-xs font-medium text-fg">
              {frame.overlays.slice(0, 4).join(" · ")}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-subtle">
        Ground is context. The object above is what you clicked — never the country GDP.
      </p>
    </div>
  );
}

export function ObjectPanel({
  object,
  frame,
  onClose,
  onConfirm,
  onDismiss,
  showKey = true,
  className,
}: ObjectPanelProps) {
  const meta = object ? OBJECT_META[object.kind] : null;
  const Icon = meta?.icon;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-l border-border bg-surface",
        className,
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {object && Icon ? (
          <div className="px-5 pt-5 pb-4">
            <header className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-fg">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-label text-subtle">
                    {object.layer ?? object.kind}
                    {object.ground ? ` · ${object.ground}` : ""}
                  </p>
                  <h2 className="font-display mt-1 text-xl leading-tight font-medium tracking-display text-fg">
                    {object.title}
                  </h2>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-10 shrink-0"
                onClick={onClose}
                aria-label="Close details"
              >
                <X />
              </Button>
            </header>
            <p className="mt-3 text-sm leading-relaxed text-muted">{object.detail}</p>
            {object.trend && object.trend.length > 1 ? (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-label text-subtle">14-day trend</p>
                <Sparkline values={object.trend} />
              </div>
            ) : null}
            {object.facts && object.facts.length > 0 ? (
              <dl className="mt-4 divide-y divide-border border-y border-border">
                {object.facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <dt className="text-xs uppercase tracking-label text-subtle">
                      {fact.label}
                    </dt>
                    <dd className="text-sm font-medium text-fg">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {object.source ? (
              <p className="mt-3 text-xs text-subtle">{object.source}</p>
            ) : null}
            {object.patchId && object.status === "proposed" && (onConfirm || onDismiss) ? (
              <div className="mt-3 flex gap-1.5">
                {onConfirm ? (
                  <Button type="button" size="sm" onClick={() => onConfirm(object.patchId!)}>
                    Confirm
                  </Button>
                ) : null}
                {onDismiss ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => onDismiss(object.patchId!)}>
                    Dismiss
                  </Button>
                ) : null}
              </div>
            ) : null}
            {object.lng != null && object.lat != null ? (
              <p className="mt-1 font-mono text-xs text-subtle">
                {formatDecimal(object.lng, object.lat)}
              </p>
            ) : null}
            {meta ? (
              <p className="mt-4 text-sm leading-relaxed text-muted">{meta.usage}</p>
            ) : null}
            {frame ? <RealityFrame frame={frame} /> : null}
          </div>
        ) : (
          <div className="px-5 pt-5 pb-4">
            <p className="text-xs font-medium uppercase tracking-label text-subtle">
              Inspector
            </p>
            <h2 className="font-display mt-1 text-xl font-medium tracking-display">
              {frame?.focus ? frame.focus.title : "What Kiyoshi sees"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Click a heat cell, zone, building, or live pulse. Country statistics stay
              at globe scale — they never hijack a ground tap.
            </p>
            {frame ? <RealityFrame frame={frame} /> : null}
          </div>
        )}
        {showKey ? (
          <details className="border-t border-border px-5 py-4" open={!object}>
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-label text-subtle">
              Layer key
            </summary>
            <ul className="mt-3 flex flex-col gap-2">
              {OVERLAYS.map((item) => {
                const IconMark = LAYER_META[item.id].icon;
                return (
                  <li key={item.id} className="flex items-start gap-2">
                    <IconMark
                      className="mt-0.5 size-3.5 shrink-0 text-primary"
                      strokeWidth={1.75}
                    />
                    <span className="text-xs leading-snug text-muted">
                      <span className="font-medium text-fg">{item.label}.</span>{" "}
                      {LAYER_META[item.id].usage}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </div>
    </aside>
  );
}
