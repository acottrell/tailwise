import { NextRequest, NextResponse } from "next/server";
import { findRouteById, dbRowToParsedRoute } from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";

/**
 * GET /api/lbrcc/preview?routeId=xxx&date=2026-04-06&time=09:00
 *
 * Returns wind recommendation for a specific route on a specific date.
 * Used by the LBRCC admin page to preview wind before posting a ride.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const routeId = searchParams.get("routeId");
  const dateStr = searchParams.get("date");
  const timeStr = searchParams.get("time") ?? "09:00";

  if (!routeId || !dateStr) {
    return NextResponse.json(
      { error: "routeId and date are required" },
      { status: 400 }
    );
  }

  const route = await findRouteById(routeId);
  if (!route) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  // Calculate how many days ahead the forecast needs to cover
  const now = new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const departure = new Date(dateStr + "T00:00:00");
  departure.setHours(h, m, 0, 0);

  const daysAhead = Math.ceil(
    (departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysAhead > 14) {
    return NextResponse.json({
      recommendation: null,
      message: "Forecast not available this far ahead",
    });
  }

  try {
    const forecastDays = Math.max(daysAhead + 1, 2);
    const { hourly, sunTimes } = await fetchWeatherServer(
      route.centroidLat,
      route.centroidLng,
      forecastDays
    );

    const parsedRoute = dbRowToParsedRoute(route);
    const duration = estimateRideDuration(route.distanceKm);
    const weather = getWeatherForWindow(hourly, sunTimes, departure, duration);
    const recommendation = getRecommendation(parsedRoute, weather);

    return NextResponse.json({
      recommendation,
      weather: {
        windSpeedMph: weather.windSpeedMph,
        windDirectionDeg: weather.windDirectionDeg,
        precipitationProbability: weather.precipitationProbability,
        temperatureCelsius: weather.temperatureCelsius,
      },
    });
  } catch {
    return NextResponse.json({
      recommendation: null,
      message: "Weather data unavailable",
    });
  }
}
