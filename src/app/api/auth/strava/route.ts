import { NextRequest, NextResponse } from "next/server";
import { STRAVA_TOKEN_URL } from "@/constants";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Strava credentials not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: parsed.data.code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: "Strava token exchange failed", details: text },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athlete: {
      id: data.athlete?.id,
      firstName: data.athlete?.firstname,
      profileImage: data.athlete?.profile_medium,
    },
  });
}
