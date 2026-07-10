import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { insertRoute, findRouteIdByStravaId } from "@/lib/db/queries";
import { decodePolyline } from "@/lib/polyline";
import { analyzeRoute } from "@/lib/route-analyzer";
import { centroid, cafePositionOnRoute } from "@/lib/geo-utils";
import { Coordinate } from "@/lib/types";
import { extractRouteId, fetchStravaRoute, getServerAccessToken, resolveStravaAppLink } from "@/lib/strava";
import { sanitizeOrReject, isValidStravaUrl, isStravaAppLink } from "@/lib/sanitize";

const submitSchema = z.object({
  stravaUrl: z.string().url(),
  cafeStop: z.string().optional(),
  sourceName: z.string().optional(),
});

// Simple in-memory rate limiter: 5 submissions per hour per IP
const submissions = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const times = (submissions.get(ip) || []).filter((t) => t > hourAgo);
  submissions.set(ip, times);
  if (times.length >= 5) return true;
  times.push(now);
  return false;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { stravaUrl, cafeStop, sourceName } = parsed.data;

  // Strict URL validation
  if (!isValidStravaUrl(stravaUrl)) {
    return NextResponse.json(
      { error: "Invalid Strava route URL" },
      { status: 400 }
    );
  }

  // Resolve app.link short URLs to canonical Strava URLs
  let resolvedUrl = stravaUrl;
  if (isStravaAppLink(stravaUrl)) {
    try {
      resolvedUrl = await resolveStravaAppLink(stravaUrl);
    } catch {
      return NextResponse.json(
        { error: "Could not resolve this Strava link to a route. Try pasting the full strava.com/routes/… URL instead." },
        { status: 400 }
      );
    }
  }

  // Sanitize optional text fields
  const cleanCafe = cafeStop ? sanitizeOrReject(cafeStop, 100) : null;
  const cleanSource = sourceName ? sanitizeOrReject(sourceName, 50) : null;

  if (cafeStop && cleanCafe === null) {
    return NextResponse.json(
      { error: "Cafe name contains invalid characters" },
      { status: 400 }
    );
  }
  if (sourceName && cleanSource === null) {
    return NextResponse.json(
      { error: "Name contains invalid characters" },
      { status: 400 }
    );
  }

  const routeIdStr = extractRouteId(resolvedUrl);
  if (!routeIdStr) {
    return NextResponse.json(
      { error: "Could not extract route ID from URL" },
      { status: 400 }
    );
  }

  const stravaRouteId = BigInt(routeIdStr);
  const existingId = await findRouteIdByStravaId(stravaRouteId);
  if (existingId) {
    return NextResponse.json(
      { error: "This route has already been submitted", existingRouteId: existingId },
      { status: 409 }
    );
  }

  try {
    const token = await getServerAccessToken();
    const strava = await fetchStravaRoute(routeIdStr, token);
    if (!strava.polyline) {
      return NextResponse.json(
        { error: "Could not load route data from Strava" },
        { status: 400 }
      );
    }

    const coordinates = decodePolyline(strava.polyline);
    const analyzed = analyzeRoute(coordinates, strava.name);
    const center = centroid(analyzed.coordinates);

    const cafeNames = cleanCafe
      ? cleanCafe.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    let cafeLat: number | null = null;
    let cafeLng: number | null = null;
    const cafeStopsJson: { name: string; lat?: number; lng?: number }[] | null =
      cafeNames.length > 1 ? [] : null;

    if (cafeNames.length > 0) {
      const coords = await geocodeCafes(cafeNames, analyzed.coordinates);
      cafeLat = coords[0]?.lat ?? null;
      cafeLng = coords[0]?.lng ?? null;
      if (cafeStopsJson) {
        for (let i = 0; i < cafeNames.length; i++) {
          const loc = coords[i];
          cafeStopsJson.push({
            name: cafeNames[i],
            ...(loc && { lat: loc.lat, lng: loc.lng }),
          });
        }
      }
    }

    const id = nanoid();
    await insertRoute({
      id,
      stravaRouteId,
      name: strava.name,
      destination: null,
      cafeStop: cleanCafe,
      cafeLat,
      cafeLng,
      cafeStops: cafeStopsJson,
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
      sourceName: cleanSource || "Community",
      sourceUrl: null,
      status: "pending",
    });

    // Send email notification
    await sendNotification(strava.name, stravaUrl, cleanSource, id).catch(
      () => {} // Don't fail the submission if email fails
    );

    return NextResponse.json(
      { message: "Route submitted for review", id },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "UNAUTHORIZED" || msg === "STRAVA_CONFIG_MISSING") {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function geocodeCafes(
  names: string[],
  routeCoords: Coordinate[]
): Promise<({ lat: number; lng: number } | null)[]> {
  // Nominatim (OpenStreetMap): free, no key. Its usage policy caps at one
  // request per second, so cafes are geocoded sequentially. Cafe names are
  // often generic ("The Hub"), so rather than trusting the top hit, take
  // up to ten candidates near the route and keep the one closest to the
  // polyline — and only if it's within 1km of it.
  const center = centroid(routeCoords);
  const box = 0.4;
  const viewbox = `${center.lng - box},${center.lat + box},${center.lng + box},${center.lat - box}`;
  const results: ({ lat: number; lng: number } | null)[] = [];

  for (const name of names) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=10&viewbox=${viewbox}&bounded=1`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "tailwise/1.0 (https://tailwise-cycle.vercel.app)",
        },
      });
      const data: { lat: string; lon: string }[] = await res.json();
      let best: { lat: number; lng: number } | null = null;
      let bestOff = Infinity;
      for (const hit of Array.isArray(data) ? data : []) {
        const loc = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
        const off = cafePositionOnRoute(routeCoords, loc).offRouteMeters;
        if (off < bestOff) {
          bestOff = off;
          best = loc;
        }
      }
      results.push(bestOff <= 1000 ? best : null);
    } catch {
      results.push(null);
    }
    if (names.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  return results;
}

async function sendNotification(
  routeName: string,
  stravaUrl: string,
  submitter: string | null,
  routeId: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tailwise.app";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "Tailwise <onboarding@resend.dev>",
      to: adminEmail,
      subject: `New route submission: ${routeName}`,
      html: `
        <p>A new route has been submitted to Tailwise.</p>
        <ul>
          <li><strong>Route:</strong> ${routeName}</li>
          <li><strong>Strava:</strong> <a href="${stravaUrl}">${stravaUrl}</a></li>
          <li><strong>Preview:</strong> <a href="${appUrl}/route/${routeId}">${routeName} on Tailwise</a></li>
          ${submitter ? `<li><strong>Submitted by:</strong> ${submitter}</li>` : ""}
        </ul>
        <p><a href="${appUrl}/admin">Review in admin</a></p>
      `,
    }),
  });
}
