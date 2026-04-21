import { NextRequest, NextResponse } from "next/server";
import { findRouteById, deleteRoute, dbRowToParsedRoute } from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";
import { colorizeSegments } from "@/lib/segment-colorizer";
import { cafePositionOnRoute } from "@/lib/geo-utils";
import { Coordinate } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = await findRouteById(id);
  if (!row) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const depStr = request.nextUrl.searchParams.get("departureTime");
  const departure = depStr ? new Date(depStr) : new Date();

  const daysAhead = Math.max(
    2,
    Math.ceil((departure.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + 1
  );
  const { hourly, sunTimes } = await fetchWeatherServer(
    row.centroidLat,
    row.centroidLng,
    Math.min(daysAhead, 16)
  );

  const parsedRoute = dbRowToParsedRoute(row);
  const duration = estimateRideDuration(row.distanceKm);
  const weather = getWeatherForWindow(hourly, sunTimes, departure, duration);
  const recommendation = getRecommendation(parsedRoute, weather);

  const shouldReverse = recommendation.direction === "reverse";
  const meaningfulAdvantage = recommendation.tailwindAdvantage >= 1;
  const segmentColors = colorizeSegments(
    row.coordinates as Coordinate[],
    weather.windDirectionDeg,
    weather.windSpeedMph,
    shouldReverse
  );

  const isLoop = row.routeType === "loop";
  const flipCafe = isLoop && shouldReverse && meaningfulAdvantage;
  const coords = row.coordinates as Coordinate[];
  const totalKm = row.distanceKm;

  function computeCafePosition(lat: number, lng: number) {
    const pos = cafePositionOnRoute(coords, { lat, lng });
    if (pos.offRouteMeters > 1000) return null;
    const adjusted = flipCafe
      ? { distanceKm: totalKm - pos.distanceKm, percent: 1 - pos.percent }
      : pos;
    return { distanceKm: adjusted.distanceKm, percent: adjusted.percent, reversed: flipCafe };
  }

  let cafePosition: { distanceKm: number; percent: number; reversed: boolean } | null = null;
  if (row.cafeLat != null && row.cafeLng != null) {
    cafePosition = computeCafePosition(row.cafeLat, row.cafeLng);
  }

  type CafeStopInput = { name: string; lat: number; lng: number };
  const rawStops = row.cafeStops as CafeStopInput[] | null;
  let cafeStops: { name: string; position: { distanceKm: number; percent: number; reversed: boolean } }[] | null = null;

  if (Array.isArray(rawStops) && rawStops.length > 0) {
    cafeStops = rawStops
      .map((c) => {
        const pos = computeCafePosition(c.lat, c.lng);
        return pos ? { name: c.name, position: pos } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.position.distanceKm - b.position.distanceKm);
    if (cafeStops.length === 0) cafeStops = null;
  }

  return NextResponse.json({
    route: {
      id: row.id,
      name: row.name,
      destination: row.destination,
      cafeStop: row.cafeStop,
      cafePosition,
      cafeStops,
      distanceKm: row.distanceKm,
      elevationGainM: row.elevationGainM,
      routeType: row.routeType,
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl,
      stravaRouteId: row.stravaRouteId ? row.stravaRouteId.toString() : null,
      coordinates: row.coordinates,
      polyline: row.polyline,
      status: row.status,
    },
    weather,
    recommendation,
    segmentColors,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const route = await findRouteById(id);
  if (!route) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  await deleteRoute(id);
  return NextResponse.json({ message: "Route deleted" });
}
