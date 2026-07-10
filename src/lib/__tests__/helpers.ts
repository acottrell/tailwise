import { Coordinate, HourlyWeather } from "../types";
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

// An elongated rectangular loop: east along the long edge, a short hop
// north, back west, and a short hop south to the start. The natural
// direction rides the long east leg first and the long west leg home.
export function rectangleLoop(
  start: Coordinate,
  eastKm: number = 30,
  northKm: number = 2
): Coordinate[] {
  const latStep = 1 / KM_PER_DEG_LAT;
  const lngStep = 1 / (KM_PER_DEG_LAT * Math.cos(toRad(start.lat)));
  const coords: Coordinate[] = [];

  for (let i = 0; i <= eastKm; i++) {
    coords.push({ lat: start.lat, lng: start.lng + i * lngStep });
  }
  for (let i = 1; i <= northKm; i++) {
    coords.push({ lat: start.lat + i * latStep, lng: start.lng + eastKm * lngStep });
  }
  for (let i = 1; i <= eastKm; i++) {
    coords.push({
      lat: start.lat + northKm * latStep,
      lng: start.lng + (eastKm - i) * lngStep,
    });
  }
  for (let i = 1; i <= northKm; i++) {
    coords.push({ lat: start.lat + (northKm - i) * latStep, lng: start.lng });
  }
  return coords;
}

// An hourly forecast series starting at `startWall` ("YYYY-MM-DDTHH:00",
// interpreted as wall-clock). `windFor` receives the hour-of-day.
export function hourlySeries(
  startWall: string,
  count: number,
  windFor: (hourOfDay: number) => { speedMph: number; fromDeg: number }
): HourlyWeather[] {
  const entries: HourlyWeather[] = [];
  const start = new Date(startWall + ":00Z");
  for (let i = 0; i < count; i++) {
    const t = new Date(start.getTime() + i * 3600_000);
    const wind = windFor(t.getUTCHours());
    entries.push({
      time: t.toISOString().slice(0, 16),
      windSpeedMph: wind.speedMph,
      windDirectionDeg: wind.fromDeg,
      precipitationProbability: 0,
      temperatureCelsius: 15,
      apparentTemperatureCelsius: 15,
      relativeHumidity: 60,
    });
  }
  return entries;
}
