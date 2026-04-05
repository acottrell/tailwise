import { NextRequest, NextResponse } from "next/server";
import { searchRoutes } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  if (query.length < 2) {
    return NextResponse.json({ routes: [] });
  }

  const results = await searchRoutes(query);

  return NextResponse.json({
    routes: results.map((r) => ({
      id: r.id,
      name: r.name,
      destination: r.destination,
      cafeStop: r.cafeStop,
      distanceKm: r.distanceKm,
      elevationGainM: r.elevationGainM,
      routeType: r.routeType,
      stravaRouteId: r.stravaRouteId ? r.stravaRouteId.toString() : null,
    })),
  });
}
