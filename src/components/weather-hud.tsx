import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { CloudSun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { briefFromProperties, toSpeed, toTemp, weatherLabel, type WeatherBrief, type WeatherUnits } from "@/lib/weather";
import { cn } from "@/lib/utils";

type WeatherHudProps = {
  lat: number;
  lng: number;
  className?: string;
};

function n(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return digits > 0 ? value.toFixed(digits) : String(Math.round(value));
}

function loadUnits(): WeatherUnits {
  try {
    return window.localStorage.getItem("eye-weather-units") === "si" ? "si" : "us";
  } catch {
    return "us";
  }
}

export function WeatherHud({ lat, lng, className }: WeatherHudProps) {
  const [brief, setBrief] = useState<WeatherBrief | null>(null);
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<WeatherUnits>(loadUnits);
  const [note, setNote] = useState("Reading the air…");
  const keyLat = Number.isFinite(lat) ? lat.toFixed(2) : "";
  const keyLng = Number.isFinite(lng) ? lng.toFixed(2) : "";
  const us = units === "us";
  const temp = (c: number | null | undefined) => n(toTemp(c, units));
  const speed = (kmh: number | null | undefined) => n(toSpeed(kmh, units));
  const speedUnit = us ? "mph" : "km/h";

  useEffect(() => {
    if (!keyLat || !keyLng) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/live?kind=weather&lat=${keyLat}&lng=${keyLng}`, { signal: ctrl.signal });
          if (!res.ok) {
            setNote("Forecast did not answer.");
            return;
          }
          const data = (await res.json()) as FeatureCollection;
          const next = briefFromProperties(data.features?.[0]?.properties as Record<string, unknown> | null);
          if (!next) {
            setNote("No forecast at this look-at.");
            setBrief(null);
            return;
          }
          setBrief(next);
          setNote("");
        } catch (err) {
          if ((err as { name?: string }).name === "AbortError") return;
          setNote("Forecast did not answer.");
        }
      })();
    }, 400);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [keyLat, keyLng]);

  return (
    <section
      className={cn(
        "pointer-events-auto w-[min(100%,17.5rem)] rounded-[var(--radius-md)] border border-border bg-surface/95 shadow-[var(--shadow-panel)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2 px-2.5 py-2">
        <CloudSun className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Weather</p>
          {brief ? (
            <p className="truncate text-sm font-medium text-fg">
              <span className="font-display text-lg leading-none">{temp(brief.temp)}°</span>
              <span className="ml-1.5 text-muted">{brief.condition}</span>
            </p>
          ) : (
            <p className="text-xs text-muted">{note}</p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setUnits((prev) => {
              const next = prev === "us" ? "si" : "us";
              try {
                window.localStorage.setItem("eye-weather-units", next);
              } catch {
                /* private mode */
              }
              return next;
            })
          }
        >
          {us ? "°F" : "°C"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : "Desk"}
        </Button>
      </div>
      {open && brief ? (
        <div className="max-h-[min(58vh,26rem)] space-y-2 overflow-y-auto border-t border-border px-2.5 py-2">
          <p className="text-xs leading-snug text-muted">
            Feels {temp(brief.feels)}°
            <span className="mx-1.5 text-border-strong">/</span>
            {brief.cardinal} {speed(brief.wind)} {speedUnit}
            {brief.gust != null ? ` gust ${speed(brief.gust)}` : ""}
          </p>
          <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-[11px]">
            <Stat label="Humidity" value={`${n(brief.humidity)}%`} />
            <Stat label="Dew" value={`${temp(brief.dew)}°`} />
            <Stat label="Pressure" value={brief.pressure == null ? "—" : us ? `${(brief.pressure / 33.8639).toFixed(2)}"` : `${n(brief.pressure)}`} />
            <Stat label="Cloud" value={`${n(brief.cloud)}%`} />
            <Stat
              label="Vis"
              value={
                brief.visibilityKm == null
                  ? "—"
                  : us
                    ? `${(brief.visibilityKm * 0.621371).toFixed(0)} mi`
                    : `${brief.visibilityKm.toFixed(0)} km`
              }
            />
            <Stat label="UV" value={n(brief.uv, 1)} />
            <Stat
              label="Precip"
              value={
                brief.precip == null ? "—" : us ? `${(brief.precip / 25.4).toFixed(2)} in` : `${n(brief.precip, 1)} mm`
              }
            />
            <Stat label="Wind" value={`${brief.dir == null ? "—" : n(brief.dir)}°`} />
            <Stat label="Source" value={brief.alerts.length ? "NWS" : "Model"} />
          </dl>
          {brief.alerts.length ? (
            <ul className="space-y-1">
              {brief.alerts.map((alert) => (
                <li key={alert.event} className="rounded-[var(--radius-sm)] border border-border bg-bg px-2 py-1">
                  <p className="text-xs font-medium text-fg">
                    {alert.event}
                    {alert.severity ? <span className="ml-1 font-normal text-muted">{alert.severity}</span> : null}
                  </p>
                  {alert.headline ? <p className="text-[11px] leading-snug text-muted">{alert.headline}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-subtle">No active warning at this point.</p>
          )}
          {brief.hours.length ? (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-subtle">Next hours</p>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {brief.hours.map((hour) => (
                  <div
                    key={hour.time}
                    className="w-10 shrink-0 rounded-[var(--radius-sm)] bg-bg px-1 py-1 text-center"
                  >
                    <p className="font-mono text-[10px] text-subtle">{hour.hour}</p>
                    <p className="text-xs font-medium text-fg">{temp(hour.temp)}°</p>
                    <p className="text-[10px] text-muted">{hour.pop == null ? "—" : `${Math.round(hour.pop)}%`}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {brief.days.length ? (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-subtle">Five days</p>
              <ul className="space-y-0.5">
                {brief.days.map((day) => (
                  <li key={day.date} className="grid grid-cols-[2.2rem_1fr_auto_auto] items-baseline gap-2 text-xs">
                    <span className="font-medium text-fg">{day.label}</span>
                    <span className="truncate text-muted">{day.summary || weatherLabel(day.code)}</span>
                    <span className="font-mono text-fg">
                      {temp(day.high)}°<span className="text-subtle">/{temp(day.low)}°</span>
                    </span>
                    <span className="w-8 text-right font-mono text-muted">{day.pop == null ? "—" : `${Math.round(day.pop)}%`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[10px] text-subtle">
            {brief.source}
            {brief.timezone ? ` · ${brief.timezone}` : ""}
            {brief.observed ? ` · ${brief.observed.replace("T", " ")}` : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-subtle">{label}</dt>
      <dd className="truncate font-mono text-fg">{value}</dd>
    </div>
  );
}
