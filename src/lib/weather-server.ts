import { OPEN_METEO_BASE_URL } from "@/constants";
import { HourlyWeather, SunTimes } from "./types";

interface WeatherServerResponse {
  hourly: HourlyWeather[];
  sunTimes: SunTimes[];
}

// In-memory cache — survives across requests in dev and serverless warm starts
const weatherCache = new Map<
  string,
  { data: WeatherServerResponse; timestamp: number }
>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCacheKey(lat: number, lng: number, forecastDays: number): string {
  // Round coordinates to 2 decimal places (~1km) for cache hits
  return `${lat.toFixed(2)},${lng.toFixed(2)},${forecastDays}`;
}

export async function fetchWeatherServer(
  lat: number,
  lng: number,
  forecastDays: number = 2
): Promise<WeatherServerResponse> {
  const cacheKey = getCacheKey(lat, lng, forecastDays);
  const cached = weatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const url = new URL(OPEN_METEO_BASE_URL);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_direction_10m,precipitation_probability,temperature_2m,apparent_temperature,relative_humidity_2m"
  );
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(Math.min(forecastDays, 16)));

  const response = await fetch(url.toString(), {
    next: { revalidate: 1800 },
  });

  if (!response.ok) {
    throw new Error("Weather service unavailable");
  }

  const data = await response.json();
  const hourlyData = data.hourly;
  const daily = data.daily;

  const hourly: HourlyWeather[] = hourlyData.time.map(
    (time: string, i: number) => ({
      time,
      windSpeedMph: hourlyData.wind_speed_10m[i],
      windDirectionDeg: hourlyData.wind_direction_10m[i],
      precipitationProbability: hourlyData.precipitation_probability[i],
      temperatureCelsius: hourlyData.temperature_2m[i],
      apparentTemperatureCelsius: hourlyData.apparent_temperature[i],
      relativeHumidity: hourlyData.relative_humidity_2m[i],
    })
  );

  const sunTimes: SunTimes[] = daily.time.map((date: string, i: number) => ({
    date,
    sunrise: daily.sunrise[i],
    sunset: daily.sunset[i],
  }));

  const result = { hourly, sunTimes };
  weatherCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}
