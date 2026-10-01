/** Esri draws a flat gray tile that says "Map data not yet available" past the
 *  last real photo. That tile is bright and almost flat. A real photo is not. */

export function looksEmpty(mean: number, variance: number): boolean {
  return mean > 175 && variance < 120;
}

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
const cache = new Map<string, ImageData | null>();

let registered = false;

function sample(img: ImageData): { mean: number; variance: number } {
  const { data } = img;
  let n = 0;
  let sum = 0;
  let sum2 = 0;
  for (let i = 0; i < data.length; i += 64) {
    const v = ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3;
    sum += v;
    sum2 += v * v;
    n++;
  }
  const mean = sum / Math.max(1, n);
  return { mean, variance: sum2 / Math.max(1, n) - mean * mean };
}

async function pixels(z: number, x: number, y: number, signal: AbortSignal): Promise<ImageData | null> {
  const key = `${z}/${y}/${x}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const res = await fetch(`${ESRI}/${z}/${y}/${x}`, { signal });
  if (!res.ok) {
    cache.set(key, null);
    return null;
  }
  const bitmap = await createImageBitmap(await res.blob());
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const stats = sample(img);
    const empty = looksEmpty(stats.mean, stats.variance);
    cache.set(key, empty ? null : img);
    if (cache.size > 400) cache.clear();
    return empty ? null : img;
  } finally {
    bitmap.close();
  }
}

function zoomFrom(parent: ImageData, levels: number, x: number, y: number): OffscreenCanvas {
  const scale = 2 ** levels;
  const size = parent.width / scale;
  const sx = (x & (scale - 1)) * size;
  const sy = (y & (scale - 1)) * size;
  const src = new OffscreenCanvas(parent.width, parent.height);
  src.getContext("2d")?.putImageData(parent, 0, 0);
  const out = new OffscreenCanvas(256, 256);
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, sx, sy, size, size, 0, 0, 256, 256);
  return out;
}

async function tileBytes(z: number, x: number, y: number, signal: AbortSignal): Promise<ArrayBuffer | null> {
  const direct = await pixels(z, x, y, signal);
  if (direct) {
    const canvas = new OffscreenCanvas(direct.width, direct.height);
    canvas.getContext("2d")?.putImageData(direct, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
    return blob.arrayBuffer();
  }
  for (let level = 1; level <= 6 && z - level >= 1; level++) {
    const parent = await pixels(z - level, x >> level, y >> level, signal);
    if (!parent) continue;
    const blob = await zoomFrom(parent, level, x, y).convertToBlob({ type: "image/jpeg", quality: 0.82 });
    return blob.arrayBuffer();
  }
  return null;
}

type Protocol = {
  addProtocol: (
    name: string,
    loader: (req: { url: string }, abort: AbortController) => Promise<{ data: ArrayBuffer }>,
  ) => void;
};

const CLEAR = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);

export function registerOverzoom(maplibre: Protocol) {
  if (registered) return;
  registered = true;
  maplibre.addProtocol("img", async (req, abort) => {
    const url = new URL(req.url);
    const [z, y, x] = url.pathname.split("/").filter(Boolean);
    const zoom = Number(z);
    const col = Number(x);
    const row = Number(y);
    if (!Number.isFinite(zoom) || !Number.isFinite(col) || !Number.isFinite(row)) {
      return { data: CLEAR.buffer };
    }
    try {
      const data = await tileBytes(zoom, col, row, abort.signal);
      return { data: data ?? CLEAR.buffer };
    } catch {
      return { data: CLEAR.buffer };
    }
  });
}
