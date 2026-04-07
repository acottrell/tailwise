import { STRAVA_API_BASE, STRAVA_TOKEN_URL } from "@/constants";
import { StravaRoute } from "./types";

// Server-side token cache — auto-refreshes using the refresh token
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getServerAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() / 1000 + 300) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("STRAVA_CONFIG_MISSING");
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("UNAUTHORIZED");
  }

  const data = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: data.expires_at,
  };

  return data.access_token;
}

export function extractRouteId(url: string): string | null {
  const match = url.match(/strava\.com\/routes\/(\d+)/);
  return match ? match[1] : null;
}

export async function fetchStravaRoute(
  routeId: string,
  accessToken: string
): Promise<StravaRoute> {
  const response = await fetch(`${STRAVA_API_BASE}/routes/${routeId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    throw new Error(`Failed to fetch route: ${response.status}`);
  }

  const data = await response.json();

  return {
    id: data.id,
    name: data.name,
    distance: data.distance,
    elevationGain: data.elevation_gain,
    polyline: data.map?.polyline || data.map?.summary_polyline,
  };
}

export function getStravaAuthUrl(redirectUri: string): string {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  return (
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=read` +
    `&approval_prompt=auto`
  );
}
