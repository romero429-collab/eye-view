import type { GlobeRotation } from "@/lib/map-types";

type RingProps = {
  cx: number;
  cy: number;
  r: number;
  transform: string;
};

export function formatLat(lat: number): string {
  const a = Math.abs(lat).toFixed(2);
  return `${a}° ${lat >= 0 ? "N" : "S"}`;
}

export function formatLon(lon: number): string {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  const a = Math.abs(wrapped).toFixed(2);
  return `${a}° ${wrapped >= 0 ? "E" : "W"}`;
}

export function viewLatLon(rotation: GlobeRotation): {
  lat: number;
  lon: number;
} {
  return { lon: -rotation.lambda, lat: -rotation.phi };
}

export function altitudeKm(zoom: number): number {
  return Math.round(18500 / Math.max(1, zoom));
}

export function Starfield() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      aria-hidden
    >
      {STAR_SEED.map((star) => (
        <circle
          key={star.i}
          cx={`${star.x}%`}
          cy={`${star.y}%`}
          r={star.r}
          fill="var(--color-fg)"
          opacity={star.o}
        />
      ))}
    </svg>
  );
}

export function OrbitRings({ cx, cy, r, transform }: RingProps) {
  const ticks = TICKS.map((deg) => {
    const a = (deg * Math.PI) / 180;
    const major = deg % 30 === 0;
    const inner = r + 2;
    const outer = r + (major ? 9 : 5);
    return {
      deg,
      major,
      x1: round(cx + Math.cos(a) * inner),
      y1: round(cy + Math.sin(a) * inner),
      x2: round(cx + Math.cos(a) * outer),
      y2: round(cy + Math.sin(a) * outer),
    };
  });

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
      aria-hidden
    >
      <g style={{ transform, transformOrigin: "0 0" }}>
        <circle
          cx={cx}
          cy={cy}
          r={r + 14}
          fill="none"
          stroke="var(--color-scope)"
          strokeWidth={1}
        />
        {ticks.map((tick) => (
          <line
            key={tick.deg}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="var(--color-scope)"
            strokeWidth={tick.major ? 1.2 : 0.7}
          />
        ))}
        <line
          x1={cx - 16}
          y1={cy}
          x2={cx - 5}
          y2={cy}
          stroke="var(--color-primary)"
          strokeWidth={1.2}
        />
        <line
          x1={cx + 5}
          y1={cy}
          x2={cx + 16}
          y2={cy}
          stroke="var(--color-primary)"
          strokeWidth={1.2}
        />
        <line
          x1={cx}
          y1={cy - 16}
          x2={cx}
          y2={cy - 5}
          stroke="var(--color-primary)"
          strokeWidth={1.2}
        />
        <line
          x1={cx}
          y1={cy + 5}
          x2={cx}
          y2={cy + 16}
          stroke="var(--color-primary)"
          strokeWidth={1.2}
        />
        <circle
          cx={cx}
          cy={cy}
          r={2.2}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={1}
        />
      </g>
    </svg>
  );
}

const TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

const STAR_SEED = (() => {
  const out: { i: number; x: number; y: number; r: number; o: number }[] = [];
  let s = 7;
  for (let i = 0; i < 160; i++) {
    s = (s * 16807) % 2147483647;
    const ySeed = (s * 48271) % 2147483647;
    out.push({
      i,
      x: (s % 1000) / 10,
      y: (ySeed % 1000) / 10,
      r: (s % 3) * 0.25 + 0.35,
      o: 0.18 + (s % 40) / 140,
    });
  }
  return out;
})();
