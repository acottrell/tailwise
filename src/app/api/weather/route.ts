import { NextRequest, NextResponse } from "next/server";
import { OPEN_METEO_BASE_URL } from "@/constants";
import { z } from "zod";

const querySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = querySchema.safeParse({
    latitude: searchParams.get("latitude"),
    longitude: searchParams.get("longitude"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid latitude/longitude" },
      { status: 400 }
    );
  }

  const { latitude, longitude } = parsed.data;

  const url = new URL(OPEN_METEO_BASE_URL);
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_direction_10m,precipitation_probability,temperature_2m"
  );
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "2");

  const response = await fetch(url.toString(), {
    next: { revalidate: 1800 },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Weather service unavailable" },
      { status: 502 }
    );
  }

  const data = await response.json();
  const hourly = data.hourly;
  const daily = data.daily;

  const hours = hourly.time.map((time: string, i: number) => ({
    time,
    windSpeedMph: hourly.wind_speed_10m[i],
    windDirectionDeg: hourly.wind_direction_10m[i],
    precipitationProbability: hourly.precipitation_probability[i],
    temperatureCelsius: hourly.temperature_2m[i],
  }));

  // Sunrise/sunset for each forecast day
  const sunTimes = daily.time.map((date: string, i: number) => ({
    date,
    sunrise: daily.sunrise[i],
    sunset: daily.sunset[i],
  }));

  return NextResponse.json({ hourly: hours, sunTimes });
}
