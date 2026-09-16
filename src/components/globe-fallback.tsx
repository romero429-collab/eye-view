import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  geoCentroid,
  geoEqualEarth,
  geoGraticule10,
  geoOrthographic,
  geoPath,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { countryValue, type MetricId } from "@/lib/metrics";
import { lookupCountry } from "@/lib/countries";
import type { ChoroplethScale } from "@/lib/color-scale";
import type {
  CountryFeature,
  GlobeRotation,
  HoverInfo,
  MapTransform,
  ViewMode,
} from "@/lib/map-types";
import { HOME_ROTATION } from "@/lib/map-types";
import { EarthLayer } from "@/components/earth-layer";
import { cn } from "@/lib/utils";

type GlobeFallbackProps = {
  metric: MetricId;
  scale: ChoroplethScale;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (info: HoverInfo | null) => void;
  onTransform: (next: MapTransform) => void;
  flyToId: string | null;
  flyNonce: number;
  viewMode: ViewMode;
  rotation: GlobeRotation;
  onRotation: (next: GlobeRotation) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
};

export function GlobeFallback({
  metric,
  scale,
  selectedId,
  onSelect,
  onHover,
  onTransform,
  flyToId,
  flyNonce,
  viewMode,
  rotation,
  onRotation,
  onSizeChange,
}: GlobeFallbackProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 520 });
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const clipId = useId();
  const globe = viewMode === "godsEye";
  const drag = useRef<{
    x: number;
    y: number;
    lambda: number;
    phi: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      const next = {
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(280, Math.floor(rect.height)),
      };
      setSize(next);
      onSizeChange?.(next);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onSizeChange]);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/countries-50m.json")
      .then((res) => res.json())
      .then((topology: Topology) => {
        if (cancelled || !topology.objects.countries) return;
        const fc = feature(topology, topology.objects.countries) as FeatureCollection<
          Geometry,
          { name: string }
        >;
        setFeatures(fc.features as CountryFeature[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const { projection, spherePath, graticulePath, paths } = useMemo(() => {
    const pad = 16;
    const proj = globe
      ? geoOrthographic()
          .rotate([rotation.lambda, rotation.phi])
          .clipAngle(90)
          .fitExtent(
            [
              [pad, pad],
              [size.width - pad, size.height - pad],
            ],
            { type: "Sphere" },
          )
      : geoEqualEarth().fitExtent(
          [
            [pad, pad],
            [size.width - pad, size.height - pad],
          ],
          { type: "Sphere" },
        );
    const path = geoPath(proj);
    return {
      projection: proj,
      spherePath: path({ type: "Sphere" }) ?? "",
      graticulePath: path(geoGraticule10()) ?? "",
      paths: (features as CountryFeature[]).map((feat) => ({
        key: String(feat.id ?? feat.properties.name),
        d: path(feat) ?? "",
        feature: feat,
        country: lookupCountry({
          id: feat.id,
          properties: feat.properties,
        }),
        atlasName: feat.properties.name,
      })),
    };
  }, [features, size.width, size.height, globe, rotation.lambda, rotation.phi]);

  useEffect(() => {
    onTransform({ x: 0, y: 0, k: 1.85 });
  }, [onTransform]);

  useEffect(() => {
    if (!flyToId) return;
    const target = paths.find((p) => p.key === flyToId);
    if (!target) return;
    const [lon, lat] = geoCentroid(target.feature);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    onRotation({ lambda: -lon, phi: -lat });
  }, [flyToId, flyNonce, paths, onRotation]);

  const groupTransform = `translate(${size.width / 2}px, ${size.height / 2}px) scale(1) translate(${-size.width / 2}px, ${-size.height / 2}px)`;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative h-full w-full overflow-hidden",
        globe ? "bg-void" : "bg-ocean",
      )}
    >
      {globe ? (
        <EarthLayer
          width={size.width}
          height={size.height}
          projection={projection}
          transform={groupTransform}
        />
      ) : null}
      <svg
        className="relative z-10 block h-full w-full touch-none select-none"
        viewBox={`0 0 ${size.width} ${size.height}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            lambda: rotation.lambda,
            phi: rotation.phi,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const dx = event.clientX - drag.current.x;
          const dy = event.clientY - drag.current.y;
          if (Math.hypot(dx, dy) > 3) drag.current.moved = true;
          if (globe) {
            onRotation({
              lambda: drag.current.lambda + dx * 0.32,
              phi: Math.max(-89, Math.min(89, drag.current.phi - dy * 0.32)),
            });
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onClick={() => onSelect(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={spherePath} />
          </clipPath>
        </defs>
        <path d={spherePath} fill={globe ? "transparent" : "var(--color-ocean)"} />
        <path
          d={graticulePath}
          fill="none"
          stroke="var(--color-graticule)"
          strokeWidth={0.6}
        />
        <g clipPath={`url(#${clipId})`}>
          {paths.map((p) => {
            if (!p.d) return null;
            const value = p.country ? countryValue(p.country, metric) : null;
            const isSel = p.key === selectedId;
            return (
              <path
                key={p.key}
                d={p.d}
                fill={scale.colorFor(value)}
                stroke="var(--color-land-stroke)"
                strokeWidth={isSel ? 1.2 : 0.45}
                className="cursor-pointer"
                style={{ fillOpacity: globe ? 0.58 : 0.96 }}
                onPointerEnter={(event) => {
                  const wrap = wrapRef.current;
                  if (!wrap) return;
                  const rect = wrap.getBoundingClientRect();
                  onHover({
                    country: p.country,
                    atlasName: p.atlasName,
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                  });
                }}
                onPointerLeave={() => onHover(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(p.key === selectedId ? null : p.key);
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export { HOME_ROTATION };
