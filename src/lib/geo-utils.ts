import { Coordinate } from "./types";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;

export function toRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

export function toDeg(rad: number): number {
  return rad * RAD_TO_DEG;
}

export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function bearing(from: Coordinate, to: Coordinate): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

export function vectorAverageDirection(
  directions: number[],
  weights?: number[]
): number {
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < directions.length; i++) {
    const w = weights ? weights[i] : 1;
    sumX += w * Math.cos(toRad(directions[i]));
    sumY += w * Math.sin(toRad(directions[i]));
  }
  return ((toDeg(Math.atan2(sumY, sumX)) % 360) + 360) % 360;
}

export function signedArea(coords: Coordinate[]): number {
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    area += coords[i].lng * coords[j].lat;
    area -= coords[j].lng * coords[i].lat;
  }
  return area / 2;
}

export function isClockwise(coords: Coordinate[]): boolean {
  return signedArea(coords) < 0;
}

export function centroid(coords: Coordinate[]): Coordinate {
  let lat = 0;
  let lng = 0;
  for (const c of coords) {
    lat += c.lat;
    lng += c.lng;
  }
  return { lat: lat / coords.length, lng: lng / coords.length };
}

export function totalDistance(coords: Coordinate[]): number {
  let dist = 0;
  for (let i = 1; i < coords.length; i++) {
    dist += haversineDistance(coords[i - 1], coords[i]);
  }
  return dist;
}

export function angleDifference(a: number, b: number): number {
  let diff = ((b - a) % 360 + 360) % 360;
  if (diff > 180) diff -= 360;
  return diff;
}

export function tailwindComponent(
  windFromDeg: number,
  windSpeedMph: number,
  rideBearingDeg: number
): number {
  // Wind blows TOWARD = windFrom + 180
  const windToward = (windFromDeg + 180) % 360;
  const diff = toRad(angleDifference(rideBearingDeg, windToward));
  return windSpeedMph * Math.cos(diff);
}

export function compassDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return dirs[index];
}

export function getPointAtDistance(
  coords: Coordinate[],
  targetDistKm: number
): Coordinate {
  let accumulated = 0;
  for (let i = 1; i < coords.length; i++) {
    const segDist = haversineDistance(coords[i - 1], coords[i]);
    if (accumulated + segDist >= targetDistKm) {
      const fraction = (targetDistKm - accumulated) / segDist;
      return {
        lat: coords[i - 1].lat + fraction * (coords[i].lat - coords[i - 1].lat),
        lng: coords[i - 1].lng + fraction * (coords[i].lng - coords[i - 1].lng),
      };
    }
    accumulated += segDist;
  }
  return coords[coords.length - 1];
}

export function getMidpointIndex(coords: Coordinate[], totalDist: number): number {
  let accumulated = 0;
  const half = totalDist / 2;
  for (let i = 1; i < coords.length; i++) {
    accumulated += haversineDistance(coords[i - 1], coords[i]);
    if (accumulated >= half) return i;
  }
  return Math.floor(coords.length / 2);
}

export function downsample(coords: Coordinate[], maxPoints: number): Coordinate[] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const result: Coordinate[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  return result;
}
