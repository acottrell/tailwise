import { Coordinate, HourlyWeather, SunTimes, WeatherData } from "./types";
import { centroid, vectorAverageDirection } from "./geo-utils";
import { ASSUMED_SPEED_KMH } from "@/constants";

interface WeatherResponse {
  hourly: HourlyWeather[];
  sunTimes: SunTimes[];
  utcOffsetSeconds: number;
}

// Forecast times are wall-clock strings in the route's timezone. Convert an
// absolute instant to that wall clock ("YYYY-MM-DDTHH") so comparisons never
// depend on the runtime's timezone (UTC on Vercel, local in the browser).
export function toWallClockHour(date: Date, utcOffsetSeconds: number): string {
  return new Date(date.getTime() + utcOffsetSeconds * 1000)
    .toISOString()
    .slice(0, 13);
}

export async function fetchWeather(
  coordinates: Coordinate[]
): Promise<WeatherResponse> {
  const center = centroid(coordinates);
  const params = new URLSearchParams({
    latitude: center.lat.toFixed(4),
    longitude: center.lng.toFixed(4),
  });

  const response = await fetch(`/api/weather?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch weather data");
  }

  const data = await response.json();
  return {
    hourly: data.hourly,
    sunTimes: data.sunTimes,
    utcOffsetSeconds: data.utcOffsetSeconds ?? 0,
  };
}

export function getWeatherForWindow(
  hourly: HourlyWeather[],
  sunTimes: SunTimes[],
  departureTime: Date,
  rideDurationHours: number,
  utcOffsetSeconds: number
): WeatherData {
  const startWall = toWallClockHour(departureTime, utcOffsetSeconds);
  const endWall = toWallClockHour(
    new Date(departureTime.getTime() + Math.ceil(rideDurationHours) * 3600_000),
    utcOffsetSeconds
  );

  const relevantHours = hourly.filter((h) => {
    const wall = h.time.slice(0, 13);
    return wall >= startWall && wall <= endWall;
  });

  const windowHours =
    relevantHours.length > 0
      ? relevantHours
      : hourly.slice(0, Math.max(2, Math.ceil(rideDurationHours)));

  const avgWindSpeed =
    windowHours.reduce((sum, h) => sum + h.windSpeedMph, 0) /
    windowHours.length;

  const avgWindDir = vectorAverageDirection(
    windowHours.map((h) => h.windDirectionDeg),
    windowHours.map((h) => h.windSpeedMph)
  );

  const maxPrecip = Math.max(
    ...windowHours.map((h) => h.precipitationProbability)
  );

  const avgTemp =
    windowHours.reduce((sum, h) => sum + h.temperatureCelsius, 0) /
    windowHours.length;

  const avgApparentTemp =
    windowHours.reduce((sum, h) => sum + h.apparentTemperatureCelsius, 0) /
    windowHours.length;

  const avgHumidity =
    windowHours.reduce((sum, h) => sum + h.relativeHumidity, 0) /
    windowHours.length;

  const firstTemp = windowHours[0].temperatureCelsius;
  const lastTemp = windowHours[windowHours.length - 1].temperatureCelsius;
  const warmingTrend = lastTemp - firstTemp;

  return {
    windSpeedMph: Math.round(avgWindSpeed * 10) / 10,
    windDirectionDeg: Math.round(avgWindDir),
    precipitationProbability: maxPrecip,
    temperatureCelsius: Math.round(avgTemp * 10) / 10,
    apparentTemperatureCelsius: Math.round(avgApparentTemp * 10) / 10,
    relativeHumidity: Math.round(avgHumidity),
    warmingTrend: Math.round(warmingTrend * 10) / 10,
    rideDurationHours,
    hourly,
    sunTimes,
  };
}

export function estimateRideDuration(distanceKm: number): number {
  return distanceKm / ASSUMED_SPEED_KMH;
}

export function getWeatherSnapshot(
  hourly: HourlyWeather[],
  at: Date,
  utcOffsetSeconds: number
): WeatherData | null {
  if (hourly.length === 0) return null;

  const targetWall = toWallClockHour(at, utcOffsetSeconds);
  const exact = hourly.find((h) => h.time.slice(0, 13) === targetWall);

  const hour = exact ?? hourly[0];
  return {
    windSpeedMph: Math.round(hour.windSpeedMph * 10) / 10,
    windDirectionDeg: Math.round(hour.windDirectionDeg),
    precipitationProbability: hour.precipitationProbability,
    temperatureCelsius: Math.round(hour.temperatureCelsius * 10) / 10,
    apparentTemperatureCelsius: Math.round(hour.apparentTemperatureCelsius * 10) / 10,
    relativeHumidity: Math.round(hour.relativeHumidity),
    warmingTrend: 0,
    rideDurationHours: 0,
    hourly,
    sunTimes: [],
  };
}
