import type { Feature, Position } from "geojson";
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from "maplibre-gl";
import earcut from "earcut";
import { TILES } from "./basemaps.ts";

/** Satellite imagery draped on 3D volumes. Roofs sample the photo.
 *  Walls use the same vertical projection, so the solid reads as the imagery. */

export type DrapePoly = {
  ring: Position[];
  height: number;
  base: number;
  ground: number;
};

export type TexFrame = { z: number; x0: number; y0: number; x1: number; y1: number };

export type DrapeMesh = {
  pos: Float32Array;
  uv: Float32Array;
  shade: Float32Array;
  idx: Uint32Array;
  frame: TexFrame;
};

function mercX(lng: number): number {
  return (lng + 180) / 360;
}

function mercY(lat: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return Math.min(1, Math.max(0, y));
}

function metersToMerc(lat: number): number {
  return 1 / (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * 6378137);
}

function openRing(ring: Position[]): Position[] {
  if (ring.length < 2) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a && b && a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  return ring;
}

export function texFrameForRing(ring: Position[], zoom: number): TexFrame {
  const pts = openRing(ring);
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const p of pts) {
    west = Math.min(west, p[0]);
    east = Math.max(east, p[0]);
    south = Math.min(south, p[1]);
    north = Math.max(north, p[1]);
  }
  const padLng = Math.max(0.00015, (east - west) * 0.15);
  const padLat = Math.max(0.00015, (north - south) * 0.15);
  west -= padLng;
  east += padLng;
  south -= padLat;
  north += padLat;
  let z = Math.max(14, Math.min(17, Math.floor(zoom)));
  const nOf = (zz: number) => 2 ** zz;
  let x0 = 0;
  let x1 = 0;
  let y0 = 0;
  let y1 = 0;
  for (; z >= 13; z--) {
    const n = nOf(z);
    x0 = Math.floor(mercX(west) * n);
    x1 = Math.floor(mercX(east) * n);
    y0 = Math.floor(mercY(north) * n);
    y1 = Math.floor(mercY(south) * n);
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (count <= 12 && count > 0) break;
  }
  return { z, x0, y0, x1, y1 };
}

export function meshFromPolys(polys: DrapePoly[], zoom: number): DrapeMesh | null {
  const pos: number[] = [];
  const uv: number[] = [];
  const shade: number[] = [];
  const idx: number[] = [];
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  const usable = polys.filter((p) => openRing(p.ring).length >= 3).slice(0, 140);
  if (!usable.length) return null;
  for (const poly of usable) {
    for (const p of openRing(poly.ring)) {
      west = Math.min(west, p[0]);
      east = Math.max(east, p[0]);
      south = Math.min(south, p[1]);
      north = Math.max(north, p[1]);
    }
  }
  const frame = texFrameForRing(
    [
      [west, south],
      [east, north],
    ],
    zoom,
  );
  const n = 2 ** frame.z;
  const mx0 = frame.x0 / n;
  const my0 = frame.y0 / n;
  const mx1 = (frame.x1 + 1) / n;
  const my1 = (frame.y1 + 1) / n;
  const du = mx1 - mx0 || 1;
  const dv = my1 - my0 || 1;

  const push = (lng: number, lat: number, alt: number, roof: boolean) => {
    const x = mercX(lng);
    const y = mercY(lat);
    const z = alt * metersToMerc(lat);
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push((x - mx0) / du, 1 - (y - my0) / dv);
    shade.push(roof ? 1 : 0.78);
    return i;
  };

  for (const poly of usable) {
    const ring = openRing(poly.ring);
    const flat: number[] = [];
    for (const p of ring) flat.push(mercX(p[0]), mercY(p[1]));
    const tris = earcut(flat);
    if (!tris.length) continue;
    const topAlt = poly.ground + poly.height;
    const botAlt = poly.ground + poly.base;
    const top: number[] = [];
    for (const p of ring) top.push(push(p[0], p[1], topAlt, true));
    for (let t = 0; t < tris.length; t += 3) {
      idx.push(top[tris[t]!]!, top[tris[t + 1]!]!, top[tris[t + 2]!]!);
    }
    for (let e = 0; e < ring.length; e++) {
      const a = ring[e]!;
      const b = ring[(e + 1) % ring.length]!;
      const a0 = push(a[0], a[1], botAlt, false);
      const b0 = push(b[0], b[1], botAlt, false);
      const a1 = push(a[0], a[1], topAlt, false);
      const b1 = push(b[0], b[1], topAlt, false);
      idx.push(a0, b0, b1, a0, b1, a1);
    }
  }
  if (!idx.length) return null;
  return {
    pos: new Float32Array(pos),
    uv: new Float32Array(uv),
    shade: new Float32Array(shade),
    idx: new Uint32Array(idx),
    frame,
  };
}

export function polysFromFeatures(features: Feature[], fallbackHeight: number): DrapePoly[] {
  const out: DrapePoly[] = [];
  const seen = new Set<string>();
  for (const feat of features) {
    const g = feat.geometry;
    if (!g || g.type !== "Polygon") continue;
    const ring = g.coordinates[0] as Position[];
    if (!ring || ring.length < 4) continue;
    const key = `${ring[0]?.[0]?.toFixed(5)},${ring[0]?.[1]?.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const height = Number(props.render_height ?? props.height ?? fallbackHeight);
    const base = Number(props.render_min_height ?? props.min_height ?? props.base ?? 0);
    out.push({
      ring,
      height: Number.isFinite(height) ? height : fallbackHeight,
      base: Number.isFinite(base) ? base : 0,
      ground: 0,
    });
    if (out.length >= 140) break;
  }
  return out;
}

function tileUrl(z: number, x: number, y: number): string {
  return TILES.imagery.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
}

async function canvasForFrame(frame: TexFrame): Promise<HTMLCanvasElement | null> {
  const cols = frame.x1 - frame.x0 + 1;
  const rows = frame.y1 - frame.y0 + 1;
  if (cols <= 0 || rows <= 0 || cols * rows > 16) return null;
  const canvas = document.createElement("canvas");
  canvas.width = cols * 256;
  canvas.height = rows * 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const jobs: Array<Promise<void>> = [];
  let painted = 0;
  for (let x = frame.x0; x <= frame.x1; x++) {
    for (let y = frame.y0; y <= frame.y1; y++) {
      jobs.push(
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            painted += 1;
            ctx.drawImage(img, (x - frame.x0) * 256, (y - frame.y0) * 256, 256, 256);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = tileUrl(frame.z, x, y);
        }),
      );
    }
  }
  await Promise.all(jobs);
  return painted > 0 ? canvas : null;
}

const VERT = `#version 300 es
in vec3 a_pos;
in vec2 a_uv;
in float a_shade;
uniform mat4 u_matrix;
out vec2 v_uv;
out float v_shade;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 1.0);
  v_uv = a_uv;
  v_shade = a_shade;
}`;

const FRAG = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
in vec2 v_uv;
in float v_shade;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, clamp(v_uv, 0.0, 1.0));
  fragColor = vec4(c.rgb * v_shade, 1.0);
}`;

export type DrapeLayer = CustomLayerInterface & {
  setMesh: (mesh: DrapeMesh | null, map: MapLibreMap) => void;
};

function asMat4(value: unknown): Float32Array {
  if (value instanceof Float32Array && value.length >= 16) return value;
  return new Float32Array(value as ArrayLike<number>);
}

export function createSatelliteDrapeLayer(onActive: (active: boolean) => void): DrapeLayer {
  let program: WebGLProgram | null = null;
  let posBuf: WebGLBuffer | null = null;
  let uvBuf: WebGLBuffer | null = null;
  let shadeBuf: WebGLBuffer | null = null;
  let idxBuf: WebGLBuffer | null = null;
  let tex: WebGLTexture | null = null;
  let mesh: DrapeMesh | null = null;
  let indexCount = 0;
  let dirty = false;
  let texKey = "";
  let ready = false;
  let mapRef: MapLibreMap | null = null;
  let uMatrix: WebGLUniformLocation | null = null;
  let aPos = 0;
  let aUv = 0;
  let aShade = 0;
  let pending: HTMLCanvasElement | null = null;

  const layer: DrapeLayer = {
    id: "sat-drape",
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      mapRef = map;
      const vs = gl.createShader(gl.VERTEX_SHADER);
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      if (!vs || !fs) return;
      gl.shaderSource(vs, VERT);
      gl.compileShader(vs);
      gl.shaderSource(fs, FRAG);
      gl.compileShader(fs);
      program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      uMatrix = gl.getUniformLocation(program, "u_matrix");
      aPos = gl.getAttribLocation(program, "a_pos");
      aUv = gl.getAttribLocation(program, "a_uv");
      aShade = gl.getAttribLocation(program, "a_shade");
      posBuf = gl.createBuffer();
      uvBuf = gl.createBuffer();
      shadeBuf = gl.createBuffer();
      idxBuf = gl.createBuffer();
      tex = gl.createTexture();
    },
    onRemove(_map, gl) {
      if (program) gl.deleteProgram(program);
      if (posBuf) gl.deleteBuffer(posBuf);
      if (uvBuf) gl.deleteBuffer(uvBuf);
      if (shadeBuf) gl.deleteBuffer(shadeBuf);
      if (idxBuf) gl.deleteBuffer(idxBuf);
      if (tex) gl.deleteTexture(tex);
      program = null;
      ready = false;
    },
    setMesh(next, map) {
      mapRef = map;
      mesh = next;
      dirty = true;
      indexCount = next ? next.idx.length : 0;
      if (!next) {
        ready = false;
        texKey = "";
        onActive(false);
        map.triggerRepaint();
        return;
      }
      const key = `${next.frame.z}:${next.frame.x0}:${next.frame.y0}:${next.frame.x1}:${next.frame.y1}`;
      if (key === texKey && ready) {
        onActive(true);
        map.triggerRepaint();
        return;
      }
      texKey = key;
      ready = false;
      void canvasForFrame(next.frame).then((canvas) => {
        if (!canvas || texKey !== key) return;
        pending = canvas;
        map.triggerRepaint();
      });
    },
    render(gl, options) {
      if (!program || !mesh || !posBuf || !uvBuf || !shadeBuf || !idxBuf || !tex) return;
      if (pending) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pending);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        pending = null;
        ready = true;
        queueMicrotask(() => onActive(true));
      }
      if (!ready) return;
      const input = options as CustomRenderMethodInput;
      if (dirty) {
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuf);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.shade, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.DYNAMIC_DRAW);
        dirty = false;
      }
      gl.useProgram(program);
      gl.uniformMatrix4fv(uMatrix, false, asMat4(input.modelViewProjectionMatrix));
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuf);
      gl.enableVertexAttribArray(aShade);
      gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
    },
  };
  return layer;
}
