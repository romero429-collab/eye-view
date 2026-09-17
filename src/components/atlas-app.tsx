import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Compass, Radar } from "lucide-react";
import { CountryPanel } from "@/components/country-panel";
import { ObjectPanel } from "@/components/object-panel";
import { MapQuery } from "@/components/map-query";
import { MapLegend, OverlayKey } from "@/components/map-legend";
import { MapTooltip } from "@/components/map-tooltip";
import { MetricSwitcher } from "@/components/metric-switcher";
import { LayerPanel, CompactLayers } from "@/components/layer-panel";
import { HierarchyPanel } from "@/components/hierarchy-panel";
import { WalkHud } from "@/components/walk-hud";
import {
  WorldMap,
  resetTransform,
  type WorldMapHandle,
} from "@/components/world-map";
import { ZoomControls } from "@/components/zoom-controls";
import { Button } from "@/components/ui/button";
import { createChoroplethScale } from "@/lib/color-scale";
import { COUNTRIES, lookupCountry } from "@/lib/countries";
import { type MetricId } from "@/lib/metrics";
import type { GlobeRotation, HoverInfo, MapObject, MapTransform, ViewMode } from "@/lib/map-types";
import { HOME_ROTATION } from "@/lib/map-types";
import { altitudeFromZoom, DEFAULT_OVERLAYS, DISTRICT_VIEW, HOME_VIEW, type OverlayId } from "@/lib/basemaps";
import { assembleOverlays, type MapIntent, QUERY_EXAMPLES } from "@/lib/map-query";
import { coordinateToggle, evaluateRules, needsDistrictScale, type SceneSample } from "@/lib/zoning-rules";
import {
  loadAttention,
  noticeMany,
  persistAttention,
  rankQueries,
  type AttentionMap,
} from "@/lib/attention";
import { buildPerception, formatDecimal, groundOwnsInspector } from "@/lib/perception";
import {
  absorbLive,
  confirmPatch,
  dismissPatch,
  loadPatches,
  mergeAt,
  persistPatches,
  rememberObject,
  resolveZone,
  writePatch,
  type ZoneEdit,
  type ZonePatch,
} from "@/lib/zone-memory";
import {
  formatLat,
  formatLon,
  viewLatLon,
} from "@/components/orbit-chrome";
import { cn } from "@/lib/utils";

export function AtlasApp() {
  const mapRef = useRef<WorldMapHandle>(null);
  const [metric, setMetric] = useState<MetricId>("gdpPerCapita");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [transform, setTransform] = useState<MapTransform>(resetTransform());
  const [flyToId, setFlyToId] = useState<string | null>(null);
  const [flyNonce, setFlyNonce] = useState(0);
  const [mapSize, setMapSize] = useState({ width: 800, height: 520 });
  const [viewMode, setViewMode] = useState<ViewMode>("godsEye");
  const [rotation, setRotation] = useState<GlobeRotation>(HOME_ROTATION);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const [liveNote, setLiveNote] = useState("");
  const [hudOpen, setHudOpen] = useState(true);
  const [picked, setPicked] = useState<MapObject | null>(null);
  const [intent, setIntent] = useState<MapIntent | null>(null);
  const [scene, setScene] = useState<SceneSample | null>(null);
  const [attention, setAttention] = useState<AttentionMap>(() => loadAttention());
  const [patches, setPatches] = useState<ZonePatch[]>(() => loadPatches());
  const [reclass, setReclass] = useState("residential");
  const absorbKey = useRef("");

  const scale = useMemo(() => createChoroplethScale(metric), [metric]);
  const selected = selectedId
    ? (COUNTRIES.find((c) => c.id === selectedId) ??
      lookupCountry({ id: selectedId }))
    : undefined;
  const globe = viewMode === "godsEye";
  const walking = viewMode === "walk";
  const look = viewLatLon(rotation);
  const tooHigh = needsDistrictScale(scene?.zoom);
  const learned = scene
    ? resolveZone(patches, scene.lng, scene.lat, scene.zoneClass, scene.zoneLabel)
    : null;
  const hits = useMemo(
    () => evaluateRules({ overlays, scene, zoneFilter: intent?.zoneClass ?? null, patches }),
    [overlays, scene, intent, patches],
  );
  const perception = useMemo(
    () => buildPerception({ scene, overlays, object: picked, rules: hits, attention, patches }),
    [scene, overlays, picked, hits, attention, patches],
  );
  const queryExamples = useMemo(
    () => rankQueries(QUERY_EXAMPLES, attention),
    [attention],
  );
  const inspectGround = groundOwnsInspector(overlays, scene?.zoom);

  const inspectCountry = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setPicked(null);
  }, []);

  const onPickObject = useCallback((object: MapObject | null) => {
    setPicked(object);
    if (!object) return;
    setAttention((prev) => {
      const next = noticeMany(prev, [object.kind, object.layer, scene?.zoneClass]);
      persistAttention(next);
      return next;
    });
  }, [scene?.zoneClass]);

  const goToCountry = useCallback((id: string | null) => {
    inspectCountry(id);
    if (id) {
      setFlyToId(id);
      setFlyNonce((n) => n + 1);
    }
  }, [inspectCountry]);

  const commitPatches = useCallback((next: ZonePatch[]) => {
    persistPatches(next);
    setPatches(next);
  }, []);

  const confirmLearned = useCallback(
    (id: string) => {
      const next = confirmPatch(patches, id);
      commitPatches(next);
      setPicked((prev) => (prev ? rememberObject({ ...prev, status: "accepted" }, next) : prev));
      setLiveNote("Confirmed — rule engine updated this tick");
    },
    [patches, commitPatches],
  );

  const dismissLearned = useCallback(
    (id: string) => {
      const next = dismissPatch(patches, id);
      commitPatches(next);
      setPicked((prev) => (prev?.patchId === id ? null : prev));
      setLiveNote("Dismissed — that block stays independent");
    },
    [patches, commitPatches],
  );

  const applyEdit = useCallback(
    (action: ZoneEdit, klass: string | null, source: "walk" | "query", note?: string, at?: { lng: number; lat: number }) => {
      const point = at ?? (scene ? { lng: scene.lng, lat: scene.lat } : DISTRICT_VIEW);
      setOverlays((prev) => ({ ...prev, zoning: true, metric: false }));
      const next =
        action === "merge"
          ? mergeAt(patches, point.lng, point.lat, klass)
          : writePatch(patches, {
              lng: point.lng,
              lat: point.lat,
              action,
              class: klass,
              note:
                note ??
                (action === "tag"
                  ? "Observed on foot — OSM missed this."
                  : action === "split"
                    ? "Subdivided at look-at"
                    : `Taught ${klass ?? "district"}`),
              source,
            });
      commitPatches(next);
      if (source !== "walk") {
        const resolved = resolveZone(next, point.lng, point.lat, klass, klass ?? "District");
        onPickObject({
          kind: "zone",
          title: resolved.label,
          detail: resolved.immediate
            ? "Mutable district. Applied immediately at this look-at. Adjacent blocks stay independent until you confirm."
            : resolved.note || "Tagged this look-at.",
          layer: "Zoning",
          source: "Query",
          lng: point.lng,
          lat: point.lat,
          patchId: (resolved.patch ?? resolved.flags[0])?.id,
          status: (resolved.patch ?? resolved.flags[0])?.status,
          mutable: true,
          facts: [
            { label: "Layer", value: "Zoning" },
            { label: "Status", value: resolved.immediate ? "Applied now" : "Proposed" },
            resolved.queued > 0 ? { label: "Queued", value: `${resolved.queued} adjacent` } : null,
            { label: "Mutation", value: resolved.immediate ? "Immediate" : "Queued" },
          ].filter((row): row is { label: string; value: string } => Boolean(row)),
        });
      }
      setLiveNote(
        action === "reclass"
          ? `Taught ${klass ?? "this"} at the look-at — rule engine updated this tick`
          : action === "split"
            ? "Split a local district here"
            : action === "merge"
              ? "Merged nearby learned districts"
              : "Tagged this look-at",
      );
    },
    [scene, patches, commitPatches, onPickObject],
  );

  useEffect(() => {
    if (!scene) return;
    const key = [
      scene.lng.toFixed(3),
      scene.lat.toFixed(3),
      scene.zoneClass,
      scene.wildlife,
      scene.transit,
      scene.events,
      scene.alerts,
      scene.quakes,
      overlays.wildlife,
      overlays.transit,
      overlays.events,
      overlays.alerts,
      overlays.quakes,
    ].join("|");
    if (key === absorbKey.current) return;
    absorbKey.current = key;
    const next = absorbLive(patches, scene, overlays);
    if (next !== patches && JSON.stringify(next) !== JSON.stringify(patches)) {
      commitPatches(next);
    }
  }, [scene, overlays, patches, commitPatches]);

  const applyIntent = useCallback(
    (next: MapIntent, address?: MapObject) => {
      setIntent(next);
      if (next.edit) {
        setOverlays(assembleOverlays(next));
        inspectCountry(null);
        const run = (lng: number, lat: number) =>
          applyEdit(next.edit!, next.zoneClass, "query", next.summary, { lng, lat });
        if (needsDistrictScale(scene?.zoom)) {
          setViewMode("atlas");
          window.setTimeout(() => {
            mapRef.current?.dropToDistricts(next.zoneClass);
            if (scene) run(scene.lng, scene.lat);
          }, 320);
        } else if (scene) {
          run(scene.lng, scene.lat);
        }
        if (next.walk) {
          setViewMode("walk");
          window.setTimeout(() => mapRef.current?.enterWalk(), 400);
        }
        return;
      }
      if (next.kind === "place" && next.countryId) {
        goToCountry(next.countryId);
        return;
      }
      if (next.overlays.length || next.walk || next.zoneClass) {
        setOverlays(assembleOverlays(next));
        if (!next.countryId) inspectCountry(null);
      }
      const goWalk = (lng?: number, lat?: number) => {
        setViewMode("walk");
        window.setTimeout(() => mapRef.current?.enterWalk(lng, lat), 40);
      };
      if (address?.lng != null && address.lat != null) {
        if (next.walk) goWalk(address.lng, address.lat);
        else mapRef.current?.flyTo(address.lng, address.lat, 16);
        setPicked(address);
        return;
      }
      if (next.countryId) {
        goToCountry(next.countryId);
        if (next.walk) window.setTimeout(() => mapRef.current?.enterWalk(), 800);
        return;
      }
      if (next.walk) {
        goWalk();
        return;
      }
      if (next.locationText && !next.here && !next.countryId) {
        inspectCountry(null);
        void (async () => {
          try {
            const res = await fetch(
              `/api/live?kind=geocode&name=${encodeURIComponent(next.locationText ?? "")}`,
            );
            if (!res.ok) return;
            const data = (await res.json()) as GeoJSON.FeatureCollection;
            const feat = data.features?.[0];
            const coords =
              feat?.geometry?.type === "Point" ? feat.geometry.coordinates : null;
            if (!coords) return;
            mapRef.current?.flyTo(coords[0], coords[1], 14);
          } catch {
            /* stay put */
          }
        })();
        return;
      }
      const needsDistrict =
        next.here ||
        Boolean(next.zoneClass) ||
        next.overlays.includes("zoning") ||
        next.overlays.includes("transit") ||
        next.overlays.includes("plots");
      if (needsDistrict) {
        setViewMode("atlas");
        window.setTimeout(() => mapRef.current?.dropToDistricts(next.zoneClass), 280);
      }
    },
    [goToCountry, inspectCountry, applyEdit, scene],
  );

  const onMetricChange = (id: MetricId) => {
    setMetric(id);
    setHover(null);
  };

  const onViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setHover(null);
    if (mode === "walk") {
      setOverlays((prev) => ({ ...prev, streets: true, plots: true, labels: true }));
      window.setTimeout(() => mapRef.current?.enterWalk(), 40);
    }
  };

  const toggleOverlay = (id: OverlayId) => {
    setOverlays((prev) => coordinateToggle(prev, id));
  };

  const onReset = () => {
    if (walking) setViewMode("godsEye");
    mapRef.current?.reset();
  };

  const canReset =
    Math.abs(transform.k - HOME_VIEW.zoom) > 0.12 ||
    Math.abs(rotation.lambda + HOME_VIEW.lng) > 2 ||
    Math.abs(rotation.phi + HOME_VIEW.lat) > 2 ||
    walking;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (walking) {
          setViewMode("godsEye");
          return;
        }
        setSelectedId(null);
        setPicked(null);
        setHover(null);
        setIntent(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [walking]);

  return (
    <div className={cn("flex h-dvh flex-col bg-bg text-fg", (globe || walking) && "orbit")}>
      {hudOpen ? (
      <header className="z-20 flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-3 py-2 md:flex-row md:items-center md:gap-4 md:px-5 md:py-3">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-fg">
              {globe || walking ? (
                <Radar className="size-4" strokeWidth={1.75} />
              ) : (
                <Compass className="size-4" strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0">
              <p className="font-display text-base leading-none font-medium tracking-display md:text-lg">
                Kiyoshi's Eye View
              </p>
              <p className="mt-0.5 text-xs uppercase tracking-label text-subtle">
                {walking ? "Ground walk" : globe ? "Globe" : "World atlas"}
              </p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <MapQuery onAsk={applyIntent} onPickCountry={goToCountry} examples={queryExamples} />
        </div>
        <div className="min-w-0 md:max-w-xl md:flex-1">
          <MetricSwitcher value={metric} onChange={onMetricChange} />
        </div>
      </header>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <WorldMap
            ref={mapRef}
            metric={metric}
            scale={scale}
            selectedId={selectedId}
            onSelect={inspectCountry}
            hover={hover}
            onHover={setHover}
            transform={transform}
            onTransform={setTransform}
            flyToId={flyToId}
            flyNonce={flyNonce}
            viewMode={viewMode}
            rotation={rotation}
            onRotation={setRotation}
            onSizeChange={setMapSize}
            overlays={overlays}
            onLiveNote={setLiveNote}
            onPickObject={onPickObject}
            zoneFilter={intent?.zoneClass ?? null}
            onScene={setScene}
            patches={patches}
          />
          <MapTooltip
            hover={hover}
            metric={metric}
            containerWidth={mapSize.width}
          />
          <p className="pointer-events-none absolute top-3 left-3 font-mono text-xs leading-relaxed font-medium tracking-widest text-subtle uppercase md:top-4 md:left-4">
            {scene
              ? formatDecimal(scene.lng, scene.lat)
              : `${formatLat(look.lat)} / ${formatLon(look.lon)}`}
            <span className="mx-2 text-border-strong">/</span>
            {walking
              ? `${Math.round(transform.k * 10) / 10} z`
              : `${altitudeFromZoom(scene?.zoom ?? transform.k).toLocaleString()} km`}
          </p>
          {!walking ? (
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <span className="block size-2 rounded-full border border-primary bg-primary/30" />
            </div>
          ) : null}
          {walking ? (
            <WalkHud
              zoneLabel={learned?.label ?? scene?.zoneLabel ?? ""}
              learned={learned?.patch ? learned.label : null}
              queued={learned?.queued ?? 0}
              immediate={Boolean(learned?.immediate)}
              reclass={reclass}
              onReclassChange={setReclass}
              onReclass={() => applyEdit("reclass", reclass, "walk")}
              onTag={() => applyEdit("tag", learned?.class ?? scene?.zoneClass ?? null, "walk")}
              onSplit={() => applyEdit("split", reclass, "walk")}
              onMerge={() => applyEdit("merge", reclass, "walk")}
              onExit={() => setViewMode("godsEye")}
              onHold={(code, down) => mapRef.current?.holdKey(code, down)}
            />
          ) : null}
          {intent && !walking ? (
            <p className="pointer-events-none absolute top-3 right-3 max-w-[min(100%,18rem)] truncate rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs text-muted shadow-[var(--shadow-panel)] md:top-4 md:right-4">
              {intent.summary}
            </p>
          ) : null}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 md:inset-x-4 md:bottom-4">
            <div className="pointer-events-auto flex min-w-0 flex-col gap-2">
              {hudOpen ? (
                <>
                  <div className="hidden md:block">
                    <LayerPanel
                      value={overlays}
                      onToggle={toggleOverlay}
                      liveNote={
                        overlays.radar ||
                        overlays.quakes ||
                        overlays.transit ||
                        overlays.flights ||
                        overlays.alerts ||
                        overlays.events ||
                        overlays.wildlife ||
                        overlays.livestock ||
                        overlays.health ||
                        overlays.rail ||
                        overlays.plots ||
                        overlays.zoning
                          ? liveNote
                          : undefined
                      }
                    />
                  </div>
                  <div className="md:hidden">
                    <CompactLayers value={overlays} onToggle={toggleOverlay} />
                    {liveNote ? (
                      <p className="mt-1 max-w-[17rem] px-1 text-xs text-subtle">{liveNote}</p>
                    ) : null}
                  </div>
                  <HierarchyPanel
                    hits={hits}
                    zoneLabel={learned?.label ?? scene?.zoneLabel}
                    onDropIn={() => {
                      setOverlays((prev) => ({ ...prev, zoning: true, streets: true }));
                      setViewMode("atlas");
                      window.setTimeout(() => mapRef.current?.dropToDistricts(), 280);
                    }}
                    onWalk={() => {
                      setOverlays((prev) => ({
                        ...prev,
                        streets: true,
                        plots: true,
                        labels: true,
                        zoning: true,
                      }));
                      setViewMode("walk");
                      window.setTimeout(() => mapRef.current?.enterWalk(), 40);
                    }}
                    onConfirm={confirmLearned}
                    onDismiss={dismissLearned}
                    calibration={perception.calibration}
                    skillCount={perception.minds.skills}
                  />
                  {overlays.metric && !overlays.zoning && !overlays.wildlife && !overlays.plants && !overlays.quakes ? (
                    <MapLegend metric={metric} stops={scale.stops} />
                  ) : null}
                  {overlays.zoning || overlays.wildlife || overlays.quakes || overlays.livestock || overlays.plants || overlays.transit || overlays.bugs || overlays.ground ? (
                    <OverlayKey
                      zoning={overlays.zoning && !tooHigh}
                      wildlife={overlays.wildlife}
                      quakes={overlays.quakes}
                      livestock={overlays.livestock}
                      plants={overlays.plants}
                      transit={overlays.transit}
                      bugs={overlays.bugs}
                    />
                  ) : null}
                </>
              ) : (
                <CompactLayers value={overlays} onToggle={toggleOverlay} />
              )}
            </div>
            <div className="pointer-events-auto">
              <ZoomControls
                viewMode={viewMode}
                onViewMode={onViewMode}
                onZoomIn={() => mapRef.current?.zoomIn()}
                onZoomOut={() => mapRef.current?.zoomOut()}
                onReset={onReset}
                canReset={canReset}
                hudOpen={hudOpen}
                onHudOpen={setHudOpen}
              />
            </div>
          </div>
        </div>

        {picked || inspectGround ? (
          <ObjectPanel
            object={picked}
            frame={perception}
            onClose={() => setPicked(null)}
            onConfirm={confirmLearned}
            onDismiss={dismissLearned}
            className="hidden w-80 shrink-0 lg:flex"
          />
        ) : hudOpen ? (
          <CountryPanel
            country={selected ?? null}
            metric={metric}
            onSelect={goToCountry}
            onClose={() => setSelectedId(null)}
            className="hidden w-80 shrink-0 lg:flex"
          />
        ) : null}
      </div>

      <MobileSheet
        open={Boolean(picked || selected)}
        onClose={() => {
          setPicked(null);
          setSelectedId(null);
        }}
      >
        {picked ? (
          <ObjectPanel
            object={picked}
            frame={perception}
            onClose={() => setPicked(null)}
            onConfirm={confirmLearned}
            onDismiss={dismissLearned}
            showKey={false}
            className="border-l-0"
          />
        ) : selected ? (
          <CountryPanel
            country={selected}
            metric={metric}
            onSelect={goToCountry}
            onClose={() => setSelectedId(null)}
            className="border-l-0"
          />
        ) : null}
      </MobileSheet>
    </div>
  );
}

function MobileSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <button
        type="button"
        aria-label="Dismiss country details"
        className={cn(
          "fixed inset-0 z-30 bg-fg/20 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex h-[min(72dvh,34rem)] flex-col overflow-hidden rounded-t-[var(--radius-xl)] border border-border bg-surface shadow-[var(--shadow-panel)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-y-0" : "translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
