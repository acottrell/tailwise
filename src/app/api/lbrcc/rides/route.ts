import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  insertWeeklyRide,
  deleteWeeklyRide,
  findRouteById,
  insertRoute,
  routeExistsByStravaId,
} from "@/lib/db/queries";
import { sanitizeOrReject, isValidStravaUrl } from "@/lib/sanitize";
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

const rideSchema = z.object({
  groupName: z.string().min(1).max(50),
  routeId: z.string().optional(),
  stravaUrl: z.string().optional(),
  rideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  meetingPoint: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = rideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { groupName, routeId, stravaUrl, rideDate, departureTime, meetingPoint, notes } =
    parsed.data;

  // Sanitize text inputs
  const cleanGroup = sanitizeOrReject(groupName, 50);
  if (!cleanGroup) {
    return NextResponse.json({ error: "Invalid group name" }, { status: 400 });
  }
  const cleanMeeting = meetingPoint ? sanitizeOrReject(meetingPoint, 200) : undefined;
  const cleanNotes = notes ? sanitizeOrReject(notes, 500) : undefined;

  let finalRouteId = routeId;

  // If a Strava URL is provided instead of a routeId, create the route on the spot
  if (!finalRouteId && stravaUrl) {
    if (!isValidStravaUrl(stravaUrl)) {
      return NextResponse.json({ error: "Invalid Strava URL" }, { status: 400 });
    }

    const routeIdStr = stravaUrl.match(/routes\/(\d+)/)?.[1];
    if (!routeIdStr) {
      return NextResponse.json({ error: "Could not extract route ID" }, { status: 400 });
    }

    const stravaRouteId = BigInt(routeIdStr);

    // Check if this Strava route already exists
    if (await routeExistsByStravaId(stravaRouteId)) {
      // Find and use the existing route
      // We need to look it up by strava ID — add a small helper query
      const { db } = await import("@/lib/db/index");
      const { routes } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      const existing = await db
        .select({ id: routes.id })
        .from(routes)
        .where(eq(routes.stravaRouteId, stravaRouteId))
        .limit(1);
      finalRouteId = existing[0]?.id;
    } else {
      // Fetch from Strava and create route (auto-approved for club admins)
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

        finalRouteId = nanoid();
        await insertRoute({
          id: finalRouteId,
          stravaRouteId,
          name: strava.name,
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
      } catch (e) {
        return NextResponse.json(
          {
            error:
              e instanceof Error
                ? e.message
                : "Failed to fetch route from Strava",
          },
          { status: 400 }
        );
      }
    }
  }

  if (!finalRouteId) {
    return NextResponse.json(
      { error: "Either routeId or stravaUrl is required" },
      { status: 400 }
    );
  }

  // Verify route exists
  const route = await findRouteById(finalRouteId);
  if (!route) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const id = nanoid();
  await insertWeeklyRide({
    id,
    groupName: cleanGroup,
    routeId: finalRouteId,
    rideDate: rideDate,
    departureTime: departureTime || null,
    meetingPoint: cleanMeeting || null,
    notes: cleanNotes || null,
  });

  return NextResponse.json({ id, routeId: finalRouteId }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await deleteWeeklyRide(id);
  return NextResponse.json({ ok: true });
}
