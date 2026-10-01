/** Geohash, base32. Precision 4 is about ±20 km. Precision 5 is about ±2.4 km. */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function geohashEncode(lat: number, lng: number, precision = 5): string {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let hash = "";
  let bit = 0;
  let value = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        value = (value << 1) | 1;
        minLng = mid;
      } else {
        value <<= 1;
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        value = (value << 1) | 1;
        minLat = mid;
      } else {
        value <<= 1;
        maxLat = mid;
      }
    }
    even = !even;
    bit += 1;
    if (bit === 5) {
      hash += BASE32[value];
      bit = 0;
      value = 0;
    }
  }
  return hash;
}

export function geohashBounds(hash: string): [number, number, number, number] {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let even = true;
  for (const char of hash) {
    const value = BASE32.indexOf(char);
    if (value < 0) break;
    for (let mask = 16; mask > 0; mask >>= 1) {
      if (even) {
        const mid = (minLng + maxLng) / 2;
        if (value & mask) minLng = mid;
        else maxLng = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (value & mask) minLat = mid;
        else maxLat = mid;
      }
      even = !even;
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Geohash cells that touch a view. Precision 4 is the useful city step. */
export function geohashesCovering(
  west: number,
  south: number,
  east: number,
  north: number,
  precision = 4,
): string[] {
  const sample = geohashBounds("0".padEnd(precision, "0"));
  const stepLng = Math.max(sample[2] - sample[0], 0.2);
  const stepLat = Math.max(sample[3] - sample[1], 0.2);
  const found = new Set<string>();
  for (let lat = south; lat <= north + stepLat * 0.5; lat += stepLat) {
    for (let lng = west; lng <= east + stepLng * 0.5; lng += stepLng) {
      found.add(geohashEncode(Math.min(90, Math.max(-90, lat)), Math.min(180, Math.max(-180, lng)), precision));
      if (found.size >= 24) return [...found];
    }
  }
  return [...found];
}
