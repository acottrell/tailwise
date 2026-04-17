import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findApprovedRoutes, dbRowToParsedRoute } from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";

interface HourlyEntry {
  time: string;
  windSpeedMph: number;
  windDirectionDeg: number;
  precipitationProbability: number;
  temperatureCelsius: number;
}

function getRidingInsight(hourly: HourlyEntry[], departure: Date): string | null {
  const now = new Date();
  const isToday = departure.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = departure.toDateString() === tomorrow.toDateString();
  const weekday = departure.toLocaleDateString("en-GB", { weekday: "long" });

  // Get daylight hours (6am-8pm) for the departure day
  const dayStart = new Date(departure);
  dayStart.setHours(6, 0, 0, 0);
  const dayEnd = new Date(departure);
  dayEnd.setHours(20, 0, 0, 0);

  const dayHours = hourly.filter((h) => {
    const t = new Date(h.time);
    return t >= dayStart && t <= dayEnd;
  });

  if (dayHours.length < 4) return null;

  // Find current hour's wind for comparison
  const currentHour = dayHours.find((h) => {
    const t = new Date(h.time);
    return t.getHours() === departure.getHours();
  });
  const currentWind = currentHour?.windSpeedMph ?? dayHours[0].windSpeedMph;

  // Find the calmest 2-hour window
  let calmestStart = 0;
  let calmestAvg = Infinity;
  for (let i = 0; i < dayHours.length - 1; i++) {
    const avg = (dayHours[i].windSpeedMph + dayHours[i + 1].windSpeedMph) / 2;
    if (avg < calmestAvg) {
      calmestAvg = avg;
      calmestStart = i;
    }
  }

  const calmestHour = new Date(dayHours[calmestStart].time).getHours();
  const dayLabel = isToday ? "today" : isTomorrow ? "tomorrow" : `on ${weekday}`;

  // Check for rain
  const highRainHours = dayHours.filter((h) => h.precipitationProbability > 60);
  if (highRainHours.length > dayHours.length / 2) {
    return `Wet ${dayLabel}, pack waterproofs`;
  }

  // Check if wind is consistently light
  const avgWind = dayHours.reduce((s, h) => s + h.windSpeedMph, 0) / dayHours.length;
  if (avgWind < 5) {
    return `Light winds all day ${dayLabel}`;
  }

  // Check if wind changes significantly
  const laterHours = dayHours.filter((h) => new Date(h.time).getHours() >= 14);
  const laterAvg = laterHours.length > 0
    ? laterHours.reduce((s, h) => s + h.windSpeedMph, 0) / laterHours.length
    : avgWind;

  const earlyHours = dayHours.filter((h) => new Date(h.time).getHours() < 12);
  const earlyAvg = earlyHours.length > 0
    ? earlyHours.reduce((s, h) => s + h.windSpeedMph, 0) / earlyHours.length
    : avgWind;

  if (laterAvg < earlyAvg * 0.6 && earlyAvg > 8) {
    return `Wind eases after 2pm ${dayLabel}`;
  }
  if (earlyAvg < laterAvg * 0.6 && laterAvg > 8) {
    return `Calmer morning ${dayLabel}, wind picks up later`;
  }

  // If calmest window is meaningfully calmer than current
  if (calmestAvg < currentWind * 0.6 && currentWind > 8) {
    const timeLabel = calmestHour <= 12
      ? `${calmestHour}am`
      : `${calmestHour - 12}pm`;
    return `Calmest around ${timeLabel} ${dayLabel}`;
  }

  return null;
}

const querySchema = z.object({
  minDistanceKm: z.coerce.number().optional(),
  maxDistanceKm: z.coerce.number().optional(),
  departureTime: z.string().optional(),
  limit: z.coerce.number().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = querySchema.safeParse({
    minDistanceKm: searchParams.get("minDistanceKm") ?? undefined,
    maxDistanceKm: searchParams.get("maxDistanceKm") ?? undefined,
    departureTime: searchParams.get("departureTime") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { minDistanceKm, maxDistanceKm, departureTime: depStr, limit } = parsed.data;
  const departure = depStr ? new Date(depStr) : new Date();

  const allRoutes = await findApprovedRoutes(minDistanceKm, maxDistanceKm);
  if (allRoutes.length === 0) {
    return NextResponse.json({ weather: null, recommendations: [] });
  }

  // Single weather call — all routes are in the same area
  const firstRoute = allRoutes[0];
  const daysAhead = Math.max(
    2,
    Math.ceil((departure.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + 1
  );
  const { hourly, sunTimes } = await fetchWeatherServer(
    firstRoute.centroidLat,
    firstRoute.centroidLng,
    Math.min(daysAhead, 16)
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

  const isAllFilter = !minDistanceKm && !maxDistanceKm;

  let ranked: typeof scored;

  if (isAllFilter) {
    // "All" shows best from each of short/medium/long (excludes Long+)
    const buckets: { min: number; max: number }[] = [
      { min: 0, max: 50 },     // Short
      { min: 50, max: 85 },    // Medium
      { min: 85, max: 130 },   // Long
    ];
    const picks: typeof scored = [];
    for (const bucket of buckets) {
      const best = scored.find(
        (s) => s.row.distanceKm >= bucket.min && s.row.distanceKm < bucket.max
      );
      if (best) picks.push(best);
    }
    ranked = picks.slice(0, limit ?? 3);
  } else if (limit) {
    ranked = scored.slice(0, limit);
  } else {
    ranked = scored;
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

  const ridingInsight = getRidingInsight(hourly, departure);

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
    ridingInsight,
    recommendations,
    totalRoutes: recommendations.length,
  });
}
