import type { GeoProjection } from "d3-geo";
import { geoPath } from "d3-geo";
import type { Place, Parcel, PlotType } from "@/lib/places";
import { PLOT_FILL } from "@/lib/places";
import type { PlaceKind } from "@/lib/places";
import { cn } from "@/lib/utils";

type PlacesLayerProps = {
  projection: GeoProjection;
  places: Place[];
  parcels: Parcel[];
  tier: PlaceKind;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (place: Place, x: number, y: number) => void;
  onHoverEnd: () => void;
};

const RADIUS: Record<PlaceKind, number> = {
  country: 2.4,
  state: 3.2,
  county: 3.6,
  city: 4.2,
  plot: 3,
};

export function PlacesLayer({
  projection,
  places,
  parcels,
  tier,
  selectedId,
  onSelect,
  onHover,
  onHoverEnd,
}: PlacesLayerProps) {
  const path = geoPath(projection);
  const showLabels = tier !== "country";

  return (
    <g className="places-layer">
      {parcels.map((parcel) => {
        const d = path({ type: "Polygon", coordinates: [parcel.ring] });
        if (!d) return null;
        const selected = parcel.id === selectedId;
        return (
          <path
            key={parcel.id}
            d={d}
            fill={PLOT_FILL[(parcel.plotType ?? "mixed") as PlotType]}
            fillOpacity={selected ? 0.72 : 0.42}
            stroke="var(--color-fg)"
            strokeOpacity={selected ? 0.85 : 0.28}
            strokeWidth={selected ? 1.2 : 0.5}
            vectorEffect="non-scaling-stroke"
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(parcel.id);
            }}
            onPointerEnter={(event) => {
              onHover(parcel, event.clientX, event.clientY);
            }}
            onPointerLeave={onHoverEnd}
          />
        );
      })}
      {places.map((place) => {
        const xy = projection([place.lon, place.lat]);
        if (!xy) return null;
        const [x, y] = xy;
        const selected = place.id === selectedId;
        const r = RADIUS[place.kind] + (selected ? 1.4 : 0);
        return (
          <g
            key={place.id}
            transform={`translate(${x} ${y})`}
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(place.id);
            }}
            onPointerEnter={(event) =>
              onHover(place, event.clientX, event.clientY)
            }
            onPointerLeave={onHoverEnd}
          >
            <circle
              r={r + 4}
              fill="var(--color-surface)"
              fillOpacity={0.9}
              stroke="var(--color-border-strong)"
              strokeWidth={selected ? 1.6 : 0.8}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              r={Math.max(1.6, r - 1.4)}
              fill={
                selected ? "var(--color-primary)" : "var(--color-fg)"
              }
            />
            {showLabels ? (
              <text
                x={r + 6}
                y={3}
                className={cn(
                  "pointer-events-none",
                  selected ? "fill-fg" : "fill-muted",
                )}
                fontSize={10}
                fontWeight={selected ? 600 : 500}
              >
                {place.name}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
