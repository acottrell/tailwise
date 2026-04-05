import { NextRequest, NextResponse } from "next/server";
import { STRAVA_TOKEN_URL } from "@/constants";
import { z } from "zod";

const bodySchema = z.object({
  refreshToken: z.string().min(1),
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
      { error: "Missing refresh token" },
      { status: 400 }
    );
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: parsed.data.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  });
}
