import { OPEN_METEO_BASE_URL } from "@/constants";
import { HourlyWeather, SunTimes } from "./types";

interface WeatherServerResponse {
  hourly: HourlyWeather[];
  sunTimes: SunTimes[];
}

export async function fetchWeatherServer(
  lat: number,
  lng: number,
  forecastDays: number = 2
): Promise<WeatherServerResponse> {
  const url = new URL(OPEN_METEO_BASE_URL);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_direction_10m,precipitation_probability,temperature_2m"
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
    })
  );

  const sunTimes: SunTimes[] = daily.time.map((date: string, i: number) => ({
    date,
    sunrise: daily.sunrise[i],
    sunset: daily.sunset[i],
  }));

  return { hourly, sunTimes };
}
