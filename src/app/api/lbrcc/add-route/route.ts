import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { insertRoute, routeExistsByStravaId } from "@/lib/db/queries";
import { isValidStravaUrl } from "@/lib/sanitize";
import { fetchStravaRoute } from "@/lib/strava";
import { decodePolyline } from "@/lib/polyline";
import { analyzeRoute } from "@/lib/route-analyzer";
import { centroid } from "@/lib/geo-utils";

function verifyAdmin(request: NextRequest): boolean {
  const secret = process.env.LBRCC_ADMIN_SECRET;
  if (!secret) return false;
  const cookie = request.cookies.get("lbrcc_admin")?.value;
  if (cookie === secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const schema = z.object({
  stravaUrl: z.string(),
  cafeStop: z.string().max(100).optional(),
  destination: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { stravaUrl, cafeStop, destination } = parsed.data;
  if (!isValidStravaUrl(stravaUrl)) {
    return NextResponse.json({ error: "Invalid Strava URL" }, { status: 400 });
  }

  const routeIdStr = stravaUrl.match(/routes\/(\d+)/)?.[1];
  if (!routeIdStr) {
    return NextResponse.json({ error: "Could not extract route ID" }, { status: 400 });
  }

  const stravaRouteId = BigInt(routeIdStr);

  // Check if already in library
  if (await routeExistsByStravaId(stravaRouteId)) {
    const { db } = await import("@/lib/db/index");
    const { routes } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const existing = await db
      .select({ id: routes.id })
      .from(routes)
      .where(eq(routes.stravaRouteId, stravaRouteId))
      .limit(1);
    return NextResponse.json(
      { id: existing[0]?.id, alreadyExists: true },
      { status: 200 }
    );
  }

  const token = process.env.STRAVA_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Strava integration not configured" },
      { status: 500 }
    );
  }

  try {
    const strava = await fetchStravaRoute(routeIdStr, token);
    if (!strava.polyline) {
      return NextResponse.json(
        { error: "Route has no polyline data" },
        { status: 400 }
      );
    }

    const coordinates = decodePolyline(strava.polyline);
    const analyzed = analyzeRoute(coordinates, strava.name);
    const center = centroid(analyzed.coordinates);

    const id = nanoid();
    await insertRoute({
      id,
      stravaRouteId,
      name: strava.name,
      destination: destination || null,
      cafeStop: cafeStop || null,
      distanceKm: strava.distance / 1000,
      elevationGainM: strava.elevationGain,
      routeType: analyzed.routeType,
      isClockwise: analyzed.isClockwise,
      centroidLat: center.lat,
      centroidLng: center.lng,
      midpointIndex: analyzed.midpointIndex,
      outboundBearing: analyzed.outboundBearing,
      homewardBearing: analyzed.homewardBearing,
      startLat: analyzed.coordinates[0].lat,
      startLng: analyzed.coordinates[0].lng,
      coordinates: analyzed.coordinates,
      polyline: strava.polyline,
      sourceName: "LBRCC",
      status: "approved",
    });

    return NextResponse.json({ id, alreadyExists: false }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to fetch route from Strava",
      },
      { status: 400 }
    );
  }
}
