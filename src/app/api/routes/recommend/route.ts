import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findApprovedRoutes, dbRowToParsedRoute } from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, getWeatherSnapshot, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";
import { CLUB_HOME_LAT, CLUB_HOME_LNG } from "@/constants";

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

  // Single weather call at fixed club-home centroid so the banner
  // doesn't shift when the distance filter changes.
  const daysAhead = Math.max(
    2,
    Math.ceil((departure.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + 1
  );
  const { hourly, sunTimes } = await fetchWeatherServer(
    CLUB_HOME_LAT,
    CLUB_HOME_LNG,
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

  const ranked = limit ? scored.slice(0, limit) : scored;

  // Header weather is a snapshot at the departure hour so it stays
  // stable across filters. Per-route scoring keeps the ride-window average.
  const headerWeather = getWeatherSnapshot(hourly, departure);

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
    weather: headerWeather
      ? {
          windSpeedMph: headerWeather.windSpeedMph,
          windDirectionDeg: headerWeather.windDirectionDeg,
          precipitationProbability: headerWeather.precipitationProbability,
          temperatureCelsius: headerWeather.temperatureCelsius,
        }
      : null,
    ridingInsight,
    recommendations,
    totalRoutes: recommendations.length,
  });
}
