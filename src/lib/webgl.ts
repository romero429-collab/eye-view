/** Software renderers cannot carry the globe. They use the SVG failsafe. */
export function classifyGpu(renderer: string): "weak" | "hardware" {
  if (/swiftshader|llvmpipe|softpipe|microsoft basic render|virtualbox|software/i.test(renderer)) {
    return "weak";
  }
  return "hardware";
}

export type WebglMode = "webgl2" | "webgl" | "fallback";

export type WebglProfile = {
  mode: WebglMode;
  pixelRatio: number;
  maxTileCacheSize: number;
};

export function webglProfile(): WebglProfile {
  const fallback: WebglProfile = { mode: "fallback", pixelRatio: 1, maxTileCacheSize: 20 };
  if (typeof document === "undefined") return fallback;
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    const gl =
      gl2 ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) return fallback;
    const gpu = gl as WebGLRenderingContext;
    const dbg = gpu.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? String(gpu.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? "") : "";
    const maxTex = Number(gpu.getParameter(gpu.MAX_TEXTURE_SIZE) ?? 0);
    const weak = classifyGpu(renderer) === "weak" || (maxTex > 0 && maxTex < 4096);
    const ratio =
      typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, weak ? 1 : 2);
    return {
      mode: gl2 ? "webgl2" : "webgl",
      pixelRatio: ratio,
      maxTileCacheSize: weak ? 40 : 120,
    };
  } catch {
    return fallback;
  }
}
