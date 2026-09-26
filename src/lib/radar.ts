/** RainViewer tile math and echo colors. Scheme 2 paints blue, then yellow, then red. */

export type RadarBand = "none" | "light" | "moderate" | "heavy";

export type RadarRead = {
  title: string;
  detail: string;
  band: RadarBand;
};

export function tileOf(lng: number, lat: number, zoom: number): { z: number; x: number; y: number; px: number; py: number } {
  const z = Math.max(0, Math.min(12, Math.round(zoom)));
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const clamped = Math.max(-85, Math.min(85, lat));
  const latR = (clamped * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  const xi = Math.min(n - 1, Math.max(0, Math.floor(x)));
  const yi = Math.min(n - 1, Math.max(0, Math.floor(y)));
  return {
    z,
    x: xi,
    y: yi,
    px: Math.min(255, Math.max(0, Math.floor((x - Math.floor(x)) * 256))),
    py: Math.min(255, Math.max(0, Math.floor((y - Math.floor(y)) * 256))),
  };
}

export function readRadarPixel(r: number, g: number, b: number, a: number): RadarRead {
  if (a < 40) {
    return {
      title: "No precipitation",
      detail: "The radar frame is clear under the tap. No echo on the latest RainViewer image.",
      band: "none",
    };
  }
  if (r > 200 && g < 120) {
    return {
      title: "Heavy rain",
      detail: "Red echo. This is the strong part of the cell, not the blue edge.",
      band: "heavy",
    };
  }
  if (r > 170 && g > 140 && b < 120) {
    return {
      title: "Moderate rain",
      detail: "Yellow echo. Steady precipitation, short of the red core.",
      band: "moderate",
    };
  }
  return {
    title: "Light rain",
    detail: "Blue echo. Light precipitation, or the outer edge of the cell.",
    band: "light",
  };
}
