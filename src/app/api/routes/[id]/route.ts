import { NextRequest, NextResponse } from "next/server";
import { findRouteById, deleteRoute, dbRowToParsedRoute } from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";
import { colorizeSegments } from "@/lib/segment-colorizer";
import { Coordinate } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = await findRouteById(id);
  if (!row || row.status !== "approved") {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const depStr = request.nextUrl.searchParams.get("departureTime");
  const departure = depStr ? new Date(depStr) : new Date();

  const { hourly, sunTimes } = await fetchWeatherServer(
    row.centroidLat,
    row.centroidLng
  );

  const parsedRoute = dbRowToParsedRoute(row);
  const duration = estimateRideDuration(row.distanceKm);
  const weather = getWeatherForWindow(hourly, sunTimes, departure, duration);
  const recommendation = getRecommendation(parsedRoute, weather);

  const shouldReverse = recommendation.direction === "reverse";
  const segmentColors = colorizeSegments(
    row.coordinates as Coordinate[],
    weather.windDirectionDeg,
    weather.windSpeedMph,
    shouldReverse
  );

  return NextResponse.json({
    route: {
      id: row.id,
      name: row.name,
      destination: row.destination,
      cafeStop: row.cafeStop,
      distanceKm: row.distanceKm,
      elevationGainM: row.elevationGainM,
      routeType: row.routeType,
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl,
      stravaRouteId: row.stravaRouteId ? row.stravaRouteId.toString() : null,
      coordinates: row.coordinates,
      polyline: row.polyline,
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
