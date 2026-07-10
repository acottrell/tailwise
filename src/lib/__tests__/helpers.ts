import { Coordinate } from "../types";
import { toRad } from "../geo-utils";

export const KM_PER_DEG_LAT = 111.195; // 6371 km * PI / 180

// A straight line heading due north from `start`, `lengthKm` long.
export function straightLineNorth(
  start: Coordinate,
  lengthKm: number,
  points: number = 41
): Coordinate[] {
  const coords: Coordinate[] = [];
  const stepDeg = lengthKm / KM_PER_DEG_LAT / (points - 1);
  for (let i = 0; i < points; i++) {
    coords.push({ lat: start.lat + i * stepDeg, lng: start.lng });
  }
  return coords;
}

// Out to the north and back along the exact same path.
export function outAndBackNorth(
  start: Coordinate,
  outLengthKm: number,
  points: number = 41
): Coordinate[] {
  const out = straightLineNorth(start, outLengthKm, points);
  const back = [...out].reverse().slice(1);
  return [...out, ...back];
}

// A circular loop. clockwise=true traces east-then-south from the
// northernmost point (negative signed area in lng/lat space).
export function circleLoop(
  center: Coordinate,
  radiusKm: number,
  points: number = 120,
  clockwise: boolean = true
): Coordinate[] {
  const rLat = radiusKm / KM_PER_DEG_LAT;
  const rLng = radiusKm / (KM_PER_DEG_LAT * Math.cos(toRad(center.lat)));
  const coords: Coordinate[] = [];
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    const sign = clockwise ? 1 : -1;
    coords.push({
      lat: center.lat + rLat * Math.cos(theta),
      lng: center.lng + sign * rLng * Math.sin(theta),
    });
  }
  return coords;
}

export const LEIGHTON_BUZZARD: Coordinate = { lat: 51.9158, lng: -0.6594 };
