import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { insertRoute, routeExistsByStravaId } from "@/lib/db/queries";
import { decodePolyline } from "@/lib/polyline";
import { analyzeRoute } from "@/lib/route-analyzer";
import { centroid } from "@/lib/geo-utils";
import { extractRouteId, fetchStravaRoute, getServerAccessToken } from "@/lib/strava";

const routeSchema = z.object({
  stravaUrl: z.string().url(),
  destination: z.string().optional(),
  cafeStop: z.string().optional(),
  sourceName: z.string().optional(),
  sourceUrl: z.string().optional(),
  eventName: z.string().optional(),
  eventDate: z.string().optional(), // ISO date e.g. "2026-04-12"
  eventUrl: z.string().url().optional(),
});

const bodySchema = z.object({
  routes: z.array(routeSchema),
});

export async function POST(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.issues },
      { status: 400 }
    );
  }

  let token: string;
  try {
    token = await getServerAccessToken();
  } catch {
    return NextResponse.json(
      { error: "Strava credentials not configured" },
      { status: 500 }
    );
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const route of parsed.data.routes) {
    try {
      const routeId = extractRouteId(route.stravaUrl);
      if (!routeId) {
        errors.push(`Invalid URL: ${route.stravaUrl}`);
        skipped++;
        continue;
      }

      const stravaRouteId = BigInt(routeId);
      if (await routeExistsByStravaId(stravaRouteId)) {
        skipped++;
        continue;
      }

      const strava = await fetchStravaRoute(routeId, token);
      if (!strava.polyline) {
        errors.push(`No polyline: ${route.stravaUrl}`);
        skipped++;
        continue;
      }

      const coordinates = decodePolyline(strava.polyline);
      const analyzed = analyzeRoute(coordinates, strava.name);
      const center = centroid(analyzed.coordinates);

      await insertRoute({
        id: nanoid(),
        stravaRouteId,
        name: strava.name,
        destination: route.destination || null,
        cafeStop: route.cafeStop || null,
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
        sourceName: route.sourceName || "Community",
        sourceUrl: route.sourceUrl || null,
        eventName: route.eventName || null,
        eventDate: route.eventDate || null,
        eventUrl: route.eventUrl || null,
        status: "approved",
      });

      inserted++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      errors.push(`${route.stravaUrl}: ${msg}`);
      skipped++;
    }
  }

  return NextResponse.json({ inserted, skipped, errors });
}
