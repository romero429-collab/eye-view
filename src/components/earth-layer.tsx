import { useEffect, useRef } from "react";
import type { GeoProjection } from "d3-geo";

type EarthLayerProps = {
  width: number;
  height: number;
  projection: GeoProjection;
  transform: string;
};

let earthPixels: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} | null = null;
let earthLoading: Promise<void> | null = null;

function loadEarth(): Promise<void> {
  if (earthPixels) return Promise.resolve();
  if (earthLoading) return earthLoading;
  earthLoading = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("No 2d context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const shot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      earthPixels = {
        data: shot.data,
        width: canvas.width,
        height: canvas.height,
      };
      resolve();
    };
    img.onerror = () => reject(new Error("Earth texture failed"));
    img.src = "/geo/earth.jpg";
  });
  return earthLoading;
}

function paint(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
) {
  const src = earthPixels;
  if (!src) return;
  const out = ctx.createImageData(width, height);
  const dst = out.data;
  const sw = src.width;
  const sh = src.height;
  const sdata = src.data;
  const invert = projection.invert?.bind(projection);
  if (!invert) return;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const geo = invert([x * scaleX, y * scaleY]);
      if (!geo || !Number.isFinite(geo[0]) || !Number.isFinite(geo[1])) continue;
      const lon = geo[0];
      const lat = geo[1];
      if (lat < -90 || lat > 90) continue;
      let sx = Math.floor(((lon + 180) / 360) * sw);
      let sy = Math.floor(((90 - lat) / 180) * sh);
      if (sx < 0) sx += sw;
      if (sx >= sw) sx -= sw;
      sy = Math.max(0, Math.min(sh - 1, sy));
      const si = (sy * sw + sx) * 4;
      const di = (y * width + x) * 4;
      dst[di] = sdata[si]!;
      dst[di + 1] = sdata[si + 1]!;
      dst[di + 2] = sdata[si + 2]!;
      dst[di + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

export function EarthLayer({
  width,
  height,
  projection,
  transform,
}: EarthLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projRef = useRef(projection);
  projRef.current = projection;

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || width < 2 || height < 2) return;
    const rw = Math.max(2, Math.round(width * 0.52));
    const rh = Math.max(2, Math.round(height * 0.52));
    canvas.width = rw;
    canvas.height = rh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scaleX = width / rw;
    const scaleY = height / rh;

    const run = () => {
      if (cancelled) return;
      paint(ctx, projRef.current, rw, rh, scaleX, scaleY);
    };

    loadEarth()
      .then(run)
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [width, height, projection]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute top-0 left-0 z-0"
      style={{
        width,
        height,
        transform,
        transformOrigin: "0 0",
      }}
      aria-hidden
    />
  );
}
