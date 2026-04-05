import { NextRequest, NextResponse } from "next/server";
import {
  findWeeklyRides,
  findWeeklyAnnouncements,
  dbRowToParsedRoute,
} from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const weeksParam = searchParams.get("weeks") ?? "1";
  const weeks = Math.min(parseInt(weeksParam, 10) || 1, 5);

  const now = new Date();
  const monday = getMonday(now);

  // Look forward N weeks and back 4 weeks for past rides
  const futureEnd = new Date(monday);
  futureEnd.setDate(futureEnd.getDate() + weeks * 7 + 6);
  const pastStart = new Date(monday);
  pastStart.setDate(pastStart.getDate() - 28);

  const fromDate = pastStart.toISOString().split("T")[0];
  const toDate = futureEnd.toISOString().split("T")[0];

  const [rides, announcements] = await Promise.all([
    findWeeklyRides(fromDate, toDate),
    findWeeklyAnnouncements(fromDate, toDate),
  ]);

  // Fetch weather for wind analysis on upcoming rides
  let weatherData: Awaited<ReturnType<typeof fetchWeatherServer>> | null = null;
  const upcomingRides = rides.filter((r) => r.rideDate >= monday);

  if (upcomingRides.length > 0) {
    const firstRoute = upcomingRides[0].route;
    try {
      weatherData = await fetchWeatherServer(
        firstRoute.centroidLat,
        firstRoute.centroidLng,
        7
      );
    } catch {
      // Weather unavailable — continue without wind analysis
    }
  }

  const rideResults = rides.map((ride) => {
    const { route, ...rideData } = ride;
    let recommendation = null;

    if (weatherData && rideData.rideDate >= monday) {
      const parsedRoute = dbRowToParsedRoute(route);
      const departureStr = rideData.departureTime || "09:00";
      const [h, m] = departureStr.split(":").map(Number);
      const departure = new Date(rideData.rideDate + "T00:00:00");
      departure.setHours(h, m, 0, 0);

      const duration = estimateRideDuration(route.distanceKm);
      const weather = getWeatherForWindow(
        weatherData.hourly,
        weatherData.sunTimes,
        departure,
        duration
      );
      recommendation = getRecommendation(parsedRoute, weather);
    }

    return {
      id: rideData.id,
      groupName: rideData.groupName,
      rideDate: rideData.rideDate,
      departureTime: rideData.departureTime,
      meetingPoint: rideData.meetingPoint,
      notes: rideData.notes,
      route: {
        id: route.id,
        name: route.name,
        destination: route.destination,
        cafeStop: route.cafeStop,
        distanceKm: route.distanceKm,
        elevationGainM: route.elevationGainM,
        routeType: route.routeType,
        stravaRouteId: route.stravaRouteId
          ? route.stravaRouteId.toString()
          : null,
      },
      recommendation,
    };
  });

  const announcementResults = announcements.map((a) => ({
    id: a.id,
    weekStart: a.weekStart,
    title: a.title,
    body: a.body,
    route: a.route
      ? {
          id: a.route.id,
          name: a.route.name,
          stravaRouteId: a.route.stravaRouteId
            ? a.route.stravaRouteId.toString()
            : null,
          distanceKm: a.route.distanceKm,
          elevationGainM: a.route.elevationGainM,
        }
      : null,
  }));

  return NextResponse.json({
    currentWeekStart: monday,
    rides: rideResults,
    announcements: announcementResults,
  });
}
