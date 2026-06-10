import { NextRequest, NextResponse } from "next/server";
import { findPendingRoutes } from "@/lib/db/queries";
import { isAuthorizedAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const routes = await findPendingRoutes();

  return NextResponse.json({
    routes: routes.map((r) => ({
      id: r.id,
      name: r.name,
      destination: r.destination,
      cafeStop: r.cafeStop,
      distanceKm: r.distanceKm,
      elevationGainM: r.elevationGainM,
      routeType: r.routeType,
      sourceName: r.sourceName,
      stravaRouteId: r.stravaRouteId ? r.stravaRouteId.toString() : null,
      createdAt: r.createdAt?.toISOString() || null,
    })),
  });
}
