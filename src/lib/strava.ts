import { STRAVA_API_BASE } from "@/constants";
import { StravaRoute } from "./types";

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
