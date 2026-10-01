/** Globe tiles are cut from one whole-Earth picture, so a tile edge cannot
 *  slice the planet. Missed orbits are filled from earlier passes, then the
 *  vertical brightness bands of those orbits are pulled back toward their neighbors. */

const LAYERS = {
  viirs: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
  modis: "MODIS_Terra_CorrectedReflectance_TrueColor",
} as const;

export type GapKind = keyof typeof LAYERS;

const LOOKBACK = 6;
const WORLD_Z = 3;
const WORLD_LOOKBACK = 4;
const cache = new Map<string, ArrayBuffer>();
const worlds = new Map<GapKind, Promise<ImageData>>();

let registered = false;

const CLEAR_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);

function dayIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function gapTileUrl(kind: GapKind): string {
  return `gap://${kind}/{z}/{y}/{x}`;
}

function gibsUrl(kind: GapKind, z: string, y: string, x: string, daysAgo: number): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAYERS[kind]}/default/${dayIso(daysAgo)}/GoogleMapsCompatible_Level9/${z}/${y}/${x}.jpg`;
}

function unseen(r: number, g: number, b: number): boolean {
  return r < 14 && g < 14 && b < 14;
}

async function readDay(url: string, signal?: AbortSignal): Promise<ImageData | null> {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) return null;
  const bitmap = await createImageBitmap(await res.blob());
  try {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(bitmap.width, bitmap.height)
        : Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

function feather(color: Uint8ClampedArray, age: Uint8Array, width: number, height: number) {
  const next = new Uint8ClampedArray(color.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      if (age[p] === 0) continue;
      let r = color[i]!;
      let g = color[i + 1]!;
      let b = color[i + 2]!;
      let n = 1;
      let edge = false;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (age[q] === 0) continue;
        if (age[q] !== age[p]) edge = true;
        const j = q * 4;
        r += color[j]!;
        g += color[j + 1]!;
        b += color[j + 2]!;
        n += 1;
      }
      if (edge) {
        next[i] = r / n;
        next[i + 1] = g / n;
        next[i + 2] = b / n;
        next[i + 3] = 255;
      } else {
        next[i] = color[i]!;
        next[i + 1] = color[i + 1]!;
        next[i + 2] = color[i + 2]!;
        next[i + 3] = 255;
      }
    }
  }
  color.set(next);
}

function fillGaps(color: Uint8ClampedArray, width: number, height: number) {
  const span = 48;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (color[i + 3] !== 0) continue;
      let left = -1;
      let right = -1;
      for (let k = 1; k <= span; k++) {
        if (left < 0 && x - k >= 0 && color[(y * width + (x - k)) * 4 + 3] !== 0) left = x - k;
        if (right < 0 && x + k < width && color[(y * width + (x + k)) * 4 + 3] !== 0) right = x + k;
        if (left >= 0 && right >= 0) break;
      }
      if (left < 0 && right < 0) continue;
      const a = left >= 0 ? (y * width + left) * 4 : (y * width + right) * 4;
      const b = right >= 0 ? (y * width + right) * 4 : a;
      const t = left >= 0 && right >= 0 ? (x - left) / (right - left) : 0;
      color[i] = color[a]! * (1 - t) + color[b]! * t;
      color[i + 1] = color[a + 1]! * (1 - t) + color[b + 1]! * t;
      color[i + 2] = color[a + 2]! * (1 - t) + color[b + 2]! * t;
      color[i + 3] = 255;
    }
  }
}

function destripe(color: Uint8ClampedArray, width: number, height: number) {
  const mean = new Float64Array(width);
  const count = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (color[i + 3] === 0) continue;
      mean[x] += color[i]! * 0.2126 + color[i + 1]! * 0.7152 + color[i + 2]! * 0.0722;
      count[x] += 1;
    }
  }
  for (let x = 0; x < width; x++) {
    if (count[x]) mean[x] /= count[x]!;
  }
  const radius = Math.max(12, Math.round(width / 8));
  const smooth = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k++) {
      const xx = Math.min(width - 1, Math.max(0, x + k));
      if (!count[xx]) continue;
      sum += mean[xx]!;
      n += 1;
    }
    smooth[x] = n ? sum / n : mean[x]!;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (color[i + 3] === 0 || !count[x] || mean[x]! < 8) continue;
      const delta = (mean[x]! - smooth[x]!) * 0.92;
      color[i] = Math.max(0, Math.min(255, color[i]! - delta));
      color[i + 1] = Math.max(0, Math.min(255, color[i + 1]! - delta));
      color[i + 2] = Math.max(0, Math.min(255, color[i + 2]! - delta));
    }
  }
}

function softenSeams(color: Uint8ClampedArray, width: number, height: number, tile: number) {
  const next = new Uint8ClampedArray(color);
  const band = 18;
  const onSeam = (value: number, limit: number) => {
    if (tile <= 0) return false;
    const along = value % tile;
    return along < band || along > tile - band;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!onSeam(x, width) && !onSeam(y, height)) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const j = (yy * width + xx) * 4;
          if (color[j + 3] === 0) continue;
          r += color[j]!;
          g += color[j + 1]!;
          b += color[j + 2]!;
          n += 1;
        }
      }
      if (!n) continue;
      const i = (y * width + x) * 4;
      next[i] = r / n;
      next[i + 1] = g / n;
      next[i + 2] = b / n;
      next[i + 3] = color[i + 3]!;
    }
  }
  color.set(next);
}

function stack(frames: Array<ImageData | null>): ImageData | null {
  const sample = frames.find((frame) => frame);
  if (!sample) return null;
  const { width, height } = sample;
  const color = new Uint8ClampedArray(width * height * 4);
  const age = new Uint8Array(width * height);
  frames.forEach((frame, generation) => {
    if (!frame || frame.width !== width || frame.height !== height) return;
    const src = frame.data;
    for (let p = 0, i = 0; p < width * height; p++, i += 4) {
      const r = src[i]!;
      const g = src[i + 1]!;
      const b = src[i + 2]!;
      if (unseen(r, g, b)) continue;
      color[i] = r;
      color[i + 1] = g;
      color[i + 2] = b;
      color[i + 3] = 255;
      age[p] = generation + 1;
    }
  });
  feather(color, age, width, height);
  feather(color, age, width, height);
  return new ImageData(color, width, height);
}

async function encode(image: ImageData): Promise<ArrayBuffer> {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(image.width, image.height)
      : Object.assign(document.createElement("canvas"), { width: image.width, height: image.height });
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return CLEAR_PNG.buffer;
  ctx.putImageData(image, 0, 0);
  if (canvas instanceof OffscreenCanvas) {
    return (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer();
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? blob.arrayBuffer() : CLEAR_PNG.buffer;
}

async function buildWorld(kind: GapKind): Promise<ImageData> {
  const n = 2 ** WORLD_Z;
  const days = Array.from({ length: WORLD_LOOKBACK }, (_, index) => 2 + WORLD_LOOKBACK - 1 - index);
  const frames = await Promise.all(
    Array.from({ length: n * n }, (_, index) => {
      const x = index % n;
      const y = Math.floor(index / n);
      return Promise.all(days.map((ago) => readDay(gibsUrl(kind, String(WORLD_Z), String(y), String(x), ago)).catch(() => null)));
    }),
  );
  const stacked = frames.map((tileFrames) => stack(tileFrames));
  const sample = stacked.find((tile) => tile);
  if (!sample) return new ImageData(new Uint8ClampedArray(4), 1, 1);
  const tileW = sample.width;
  const tileH = sample.height;
  const width = tileW * n;
  const height = tileH * n;
  const color = new Uint8ClampedArray(width * height * 4);
  stacked.forEach((tile, index) => {
    if (!tile) return;
    const tx = index % n;
    const ty = Math.floor(index / n);
    for (let row = 0; row < tileH; row++) {
      const src = row * tileW * 4;
      const dest = ((ty * tileH + row) * width + tx * tileW) * 4;
      color.set(tile.data.subarray(src, src + tileW * 4), dest);
    }
  });
  fillGaps(color, width, height);
  softenSeams(color, width, height, tileW);
  destripe(color, width, height);
  return new ImageData(color, width, height);
}

function worldImage(kind: GapKind): Promise<ImageData> {
  const existing = worlds.get(kind);
  if (existing) return existing;
  const pending = buildWorld(kind).catch((error) => {
    worlds.delete(kind);
    throw error;
  });
  worlds.set(kind, pending);
  return pending;
}

function sliceWorld(world: ImageData, zoom: number, x: number, y: number): ImageData {
  const n = 2 ** zoom;
  const sw = world.width / n;
  const sh = world.height / n;
  const sx = x * sw;
  const sy = y * sh;
  const out = new Uint8ClampedArray(256 * 256 * 4);
  for (let py = 0; py < 256; py++) {
    const yy = Math.min(world.height - 1, Math.floor(sy + (py / 256) * sh));
    for (let px = 0; px < 256; px++) {
      const xx = Math.min(world.width - 1, Math.floor(sx + (px / 256) * sw));
      const s = (yy * world.width + xx) * 4;
      const d = (py * 256 + px) * 4;
      out[d] = world.data[s]!;
      out[d + 1] = world.data[s + 1]!;
      out[d + 2] = world.data[s + 2]!;
      out[d + 3] = world.data[s + 3]!;
    }
  }
  return new ImageData(out, 256, 256);
}

async function fillTile(kind: GapKind, z: string, y: string, x: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const key = `${kind}/${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const days = Array.from({ length: LOOKBACK }, (_, index) => 2 + LOOKBACK - 1 - index);
  const frames = await Promise.all(days.map((ago) => readDay(gibsUrl(kind, z, y, x, ago), signal).catch(() => null)));
  const sample = frames.find((frame) => frame);
  if (!sample) return CLEAR_PNG.buffer;
  const { width, height } = sample;
  const color = new Uint8ClampedArray(width * height * 4);
  const age = new Uint8Array(width * height);
  frames.forEach((frame, generation) => {
    if (!frame || frame.width !== width || frame.height !== height) return;
    const src = frame.data;
    for (let p = 0, i = 0; p < width * height; p++, i += 4) {
      const r = src[i]!;
      const g = src[i + 1]!;
      const b = src[i + 2]!;
      if (unseen(r, g, b)) continue;
      color[i] = r;
      color[i + 1] = g;
      color[i + 2] = b;
      color[i + 3] = 255;
      age[p] = generation + 1;
    }
  });
  feather(color, age, width, height);
  feather(color, age, width, height);
  destripe(color, width, height);
  const png = await encode(new ImageData(color, width, height));
  if (cache.size > 180) cache.clear();
  cache.set(key, png);
  return png;
}

type Protocol = {
  addProtocol: (
    name: string,
    loader: (
      req: { url: string },
      abort: AbortController,
    ) => Promise<{ data: ArrayBuffer }>,
  ) => void;
};

export function registerGapTiles(maplibre: Protocol) {
  if (registered) return;
  registered = true;
  maplibre.addProtocol("gap", async (req, abort) => {
    const url = new URL(req.url);
    const kind = url.hostname as GapKind;
    const [z, y, x] = url.pathname.split("/").filter(Boolean);
    if (!LAYERS[kind] || !z || !y || !x) return { data: CLEAR_PNG.buffer };
    const zoom = Number(z);
    if (zoom <= WORLD_Z) {
      const world = await worldImage(kind);
      return { data: await encode(sliceWorld(world, zoom, Number(x), Number(y))) };
    }
    return { data: await fillTile(kind, z, y, x, abort.signal) };
  });
}
