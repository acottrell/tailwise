import { Coordinate, HourlyWeather, SunTimes, WeatherData } from "./types";
import { centroid, vectorAverageDirection } from "./geo-utils";
import { ASSUMED_SPEED_KMH } from "@/constants";

interface WeatherResponse {
  hourly: HourlyWeather[];
  sunTimes: SunTimes[];
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
  return { hourly: data.hourly, sunTimes: data.sunTimes };
}

export function getWeatherForWindow(
  hourly: HourlyWeather[],
  sunTimes: SunTimes[],
  departureTime: Date,
  rideDurationHours: number
): WeatherData {
  const startHour = departureTime.getHours();
  const endHour = startHour + Math.ceil(rideDurationHours);

  const departureDate = departureTime.toISOString().split("T")[0];
  const relevantHours = hourly.filter((h) => {
    const hourDate = h.time.split("T")[0];
    const hourNum = parseInt(h.time.split("T")[1].split(":")[0]);
    return hourDate === departureDate && hourNum >= startHour && hourNum <= endHour;
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
  at: Date
): WeatherData | null {
  if (hourly.length === 0) return null;

  const targetDate = at.toISOString().split("T")[0];
  const targetHour = at.getHours();

  const exact = hourly.find((h) => {
    const [d, t] = h.time.split("T");
    return d === targetDate && parseInt(t.split(":")[0]) === targetHour;
  });

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
