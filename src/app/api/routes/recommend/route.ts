import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findApprovedRoutes, dbRowToParsedRoute } from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";

const querySchema = z.object({
  minDistanceKm: z.coerce.number().optional(),
  maxDistanceKm: z.coerce.number().optional(),
  departureTime: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = querySchema.safeParse({
    minDistanceKm: searchParams.get("minDistanceKm") ?? undefined,
    maxDistanceKm: searchParams.get("maxDistanceKm") ?? undefined,
    departureTime: searchParams.get("departureTime") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { minDistanceKm, maxDistanceKm, departureTime: depStr } = parsed.data;
  const departure = depStr ? new Date(depStr) : new Date();

  const allRoutes = await findApprovedRoutes(minDistanceKm, maxDistanceKm);
  if (allRoutes.length === 0) {
    return NextResponse.json({ weather: null, recommendations: [] });
  }

  // Single weather call — all routes are in the same area
  const firstRoute = allRoutes[0];
  const { hourly, sunTimes } = await fetchWeatherServer(
    firstRoute.centroidLat,
    firstRoute.centroidLng
  );

  // Score each route
  const scored = allRoutes.map((row) => {
    const parsedRoute = dbRowToParsedRoute(row);
    const duration = estimateRideDuration(row.distanceKm);
    const weather = getWeatherForWindow(hourly, sunTimes, departure, duration);
    const recommendation = getRecommendation(parsedRoute, weather);

    const score =
      recommendation.homewardTailwindMph -
      weather.precipitationProbability * 0.1;

    return {
      row,
      recommendation,
      weather,
      score,
    };
  });

  // Sort by score descending, tiebreak by shorter distance
  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.5) {
      return a.row.distanceKm - b.row.distanceKm;
    }
    return b.score - a.score;
  });

  // Feature upcoming event routes (within 7 days) at the top
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const eventRoutes = scored.filter((s) => {
    if (!s.row.eventDate) return false;
    const eventDate = new Date(s.row.eventDate + "T00:00:00");
    const diff = eventDate.getTime() - now.getTime();
    return diff >= -24 * 60 * 60 * 1000 && diff <= sevenDaysMs;
  });

  const isAllFilter = !minDistanceKm && !maxDistanceKm;

  let ranked: typeof scored;

  if (isAllFilter) {
    // "All" shows best from each of short/medium/long (excludes Long+)
    const buckets: { min: number; max: number }[] = [
      { min: 0, max: 50 },     // Short
      { min: 50, max: 85 },    // Medium
      { min: 85, max: 130 },   // Long
    ];
    const nonEventScored = scored.filter((s) => !eventRoutes.includes(s));
    const picks: typeof scored = [];
    for (const bucket of buckets) {
      const best = nonEventScored.find(
        (s) => s.row.distanceKm >= bucket.min && s.row.distanceKm < bucket.max
      );
      if (best) picks.push(best);
    }
    // Event routes go first, then fill remaining slots with spread picks
    ranked = [...eventRoutes, ...picks].slice(0, 3);
  } else {
    // Specific filter: all routes ranked by score, events first
    const nonEventRoutes = scored.filter((s) => !eventRoutes.includes(s));
    ranked = [...eventRoutes, ...nonEventRoutes];
  }

  // Use weather from first route (representative for the area)
  const representativeWeather = ranked[0]?.weather;

  const recommendations = ranked.map(({ row, recommendation }) => ({
    id: row.id,
    name: row.name,
    destination: row.destination,
    cafeStop: row.cafeStop,
    cafeOpen: null as boolean | null,
    cafeRating: null as number | null,
    distanceKm: row.distanceKm,
    elevationGainM: row.elevationGainM,
    routeType: row.routeType,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    stravaRouteId: row.stravaRouteId ? row.stravaRouteId.toString() : null,
    eventName: row.eventName,
    eventDate: row.eventDate,
    eventUrl: row.eventUrl,
    recommendation,
  }));

  return NextResponse.json({
    weather: representativeWeather
      ? {
          windSpeedMph: representativeWeather.windSpeedMph,
          windDirectionDeg: representativeWeather.windDirectionDeg,
          precipitationProbability:
            representativeWeather.precipitationProbability,
          temperatureCelsius: representativeWeather.temperatureCelsius,
        }
      : null,
    recommendations,
    totalRoutes: recommendations.length,
  });
}
