import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LAYER_META, OBJECT_META } from "@/lib/layer-meta";
import { OVERLAYS, QUAKES_URL } from "@/lib/basemaps";
import type { MapObject } from "@/lib/map-types";
import { formatDecimal, type PerceptionFrame } from "@/lib/perception";
import { formatKm, hitsFromCollection, nearbyHits, type NearbyHit } from "@/lib/nearby";
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

const TILE_LABELS = new Set([
  "Temp",
  "Wind",
  "Humidity",
  "Echo",
  "Magnitude",
  "Elevation",
  "Precip",
  "Flu A",
  "Flu B",
  "RSV",
  "Rhino",
  "Coronavirus",
  "Parainfluenza",
  "Adeno",
  "Metapneumovirus",
  "Bocavirus",
]);
const PLACE_LABELS = new Set([
  "Imagery",
  "Place",
  "Street",
  "County",
  "State",
  "Country",
  "Postcode",
  "Site address",
  "Elevation",
  "Condition",
  "Temp",
  "Feels",
  "Humidity",
  "Dew point",
  "Pressure",
  "Wind",
  "Gust",
  "Precip",
  "Cloud",
  "Visibility",
  "UV",
  "Forecast",
  "Alert",
  "Next hours",
  "Days",
  "Look-at",
]);

const WIND_FROM: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

function EchoScale({ band }: { band: string }) {
  const marks = [
    { id: "light", label: "Light", color: "#38bdf8" },
    { id: "moderate", label: "Moderate", color: "#f5d90a" },
    { id: "heavy", label: "Heavy", color: "#ff4d1a" },
  ];
  return (
    <div className="mt-3">
      <div className="flex h-2 overflow-hidden rounded-full">
        {marks.map((mark) => (
          <div key={mark.id} className="h-full flex-1" style={{ background: mark.color, opacity: band === mark.id || band === "none" ? 1 : 0.35 }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-label text-subtle">
        {marks.map((mark) => (
          <span key={mark.id} className={band === mark.id ? "text-fg" : ""}>
            {mark.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function WindMark({ text }: { text: string }) {
  const cardinal = text.split(" ")[0] ?? "";
  const from = WIND_FROM[cardinal];
  if (from == null) return null;
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-primary" style={{ transform: `rotate(${from + 180}deg)` }} aria-hidden="true">
      <path d="M12 3 L16 14 H13.2 V21 H10.8 V14 H8 Z" fill="currentColor" />
    </svg>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-label text-subtle">
        {label === "Wind" ? <WindMark text={value} /> : null}
        {label}
      </p>
      <p className="mt-0.5 truncate font-display text-lg leading-none text-fg">{value}</p>
    </div>
  );
}

function FactList({ rows }: { rows: Array<{ label: string; value: string }> }) {
  if (!rows.length) return null;
  return (
    <dl className="divide-y divide-border">
      {rows.map((fact) => (
        <div key={fact.label} className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-[10px] uppercase tracking-label text-subtle">{fact.label}</dt>
          <dd className="max-w-[70%] text-right text-xs font-medium text-fg">{fact.value}</dd>
        </div>
      ))}
    </dl>
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
  const [nearby, setNearby] = useState<NearbyHit[]>([]);
  const [scanning, setScanning] = useState(false);
  const facts = object?.facts ?? [];
  const tiles = facts.filter((fact) => TILE_LABELS.has(fact.label) && fact.value.length < 28);
  const layerRows = facts.filter((fact) => !PLACE_LABELS.has(fact.label) && !TILE_LABELS.has(fact.label));
  const placeRows = facts.filter((fact) => PLACE_LABELS.has(fact.label) && !TILE_LABELS.has(fact.label) && fact.label !== "Look-at");
  const band = facts.find((fact) => fact.label === "Band")?.value ?? "";

  useEffect(() => {
    if (object?.lng == null || object.lat == null) {
      setNearby([]);
      return;
    }
    const lng = object.lng;
    const lat = object.lat;
    const ctrl = new AbortController();
    const pad = 4;
    setScanning(true);
    void (async () => {
      const box = `west=${lng - pad}&south=${lat - pad}&east=${lng + pad}&north=${lat + pad}&zoom=6`;
      const [quakes, alerts, events, flights] = await Promise.all([
        fetch(QUAKES_URL, { signal: ctrl.signal }).then((res) => (res.ok ? res.json() : null)).catch(() => null),
        fetch(`/api/live?kind=alerts&${box}`, { signal: ctrl.signal }).then((res) => (res.ok ? res.json() : null)).catch(() => null),
        fetch(`/api/live?kind=events`, { signal: ctrl.signal }).then((res) => (res.ok ? res.json() : null)).catch(() => null),
        fetch(`/api/live?kind=flights&${box}`, { signal: ctrl.signal }).then((res) => (res.ok ? res.json() : null)).catch(() => null),
      ]);
      if (ctrl.signal.aborted) return;
      const hits = [
        ...nearbyHits(hitsFromCollection(quakes, "Quake"), lng, lat, 500, 3),
        ...nearbyHits(hitsFromCollection(alerts, "Alert"), lng, lat, 250, 2),
        ...nearbyHits(hitsFromCollection(events, "Event"), lng, lat, 800, 2),
        ...nearbyHits(hitsFromCollection(flights, "Flight"), lng, lat, 120, 2),
      ].sort((a, b) => a.km - b.km);
      setNearby(hits.slice(0, 6));
      setScanning(false);
    })();
    return () => ctrl.abort();
  }, [object?.lat, object?.lng]);

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
            {object.photo ? (
              <img
                src={object.photo}
                alt={object.title}
                className="mt-3 h-36 w-full rounded-[var(--radius-sm)] object-cover"
                crossOrigin="anonymous"
              />
            ) : null}
            {object.trend && object.trend.length > 1 ? (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-label text-subtle">14-day trend</p>
                <Sparkline values={object.trend} />
              </div>
            ) : null}
            {tiles.length ? (
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {tiles.map((fact) => (
                  <MetricTile key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </div>
            ) : null}
            {band ? <EchoScale band={band} /> : null}
            {layerRows.length ? (
              <section className="mt-4">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-label text-subtle">This layer</p>
                <FactList rows={layerRows} />
              </section>
            ) : null}
            {placeRows.length ? (
              <section className="mt-4">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-label text-subtle">Also at this point</p>
                <FactList rows={placeRows} />
              </section>
            ) : null}
            <section className="mt-4">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-label text-subtle">Nearby</p>
              {scanning && !nearby.length ? (
                <p className="text-xs text-muted">Scanning the other layers…</p>
              ) : nearby.length ? (
                <ul className="flex flex-col gap-1.5">
                  {nearby.map((hit) => (
                    <li key={`${hit.layer}-${hit.title}-${hit.km.toFixed(1)}`} className="rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-label text-subtle">{hit.layer}</span>
                        <span className="font-mono text-[11px] text-primary">{formatKm(hit.km)}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium leading-snug text-fg">{hit.title}</p>
                      {hit.detail ? <p className="truncate text-xs text-muted">{hit.detail}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No quake, alert, flight, or open event in range.</p>
              )}
            </section>
            {frame?.overlays.length ? (
              <p className="mt-3 text-[11px] text-subtle">Layers on: {frame.overlays.join(" · ")}</p>
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
            {meta ? <p className="mt-3 text-xs leading-relaxed text-subtle">{meta.usage}</p> : null}
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
