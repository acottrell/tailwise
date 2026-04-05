"use client";

import { useState, useCallback } from "react";
import { ParsedRoute, StravaRoute } from "@/lib/types";
import { extractRouteId, fetchStravaRoute } from "@/lib/strava";
import { decodePolyline } from "@/lib/polyline";
import { analyzeRoute } from "@/lib/route-analyzer";
import { getDemoCoordinates, DEMO_STRAVA_ROUTE } from "@/lib/demo-route";

interface UseRoute {
  loading: boolean;
  error: string | null;
  parsedRoute: ParsedRoute | null;
  stravaRoute: StravaRoute | null;
  loadRoute: (url: string, accessToken: string) => Promise<{ parsed: ParsedRoute; strava: StravaRoute }>;
  loadDemo: () => { parsed: ParsedRoute; strava: StravaRoute };
}

export function useRoute(): UseRoute {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRoute, setParsedRoute] = useState<ParsedRoute | null>(null);
  const [stravaRoute, setStravaRoute] = useState<StravaRoute | null>(null);

  const loadRoute = useCallback(
    async (url: string, accessToken: string) => {
      setLoading(true);
      setError(null);

      try {
        const routeId = extractRouteId(url);
        if (!routeId) {
          throw new Error("Invalid Strava route URL");
        }

        const strava = await fetchStravaRoute(routeId, accessToken);
        if (!strava.polyline) {
          throw new Error("Route has no map data");
        }

        const coordinates = decodePolyline(strava.polyline);
        const parsed = analyzeRoute(coordinates, strava.name);

        setParsedRoute(parsed);
        setStravaRoute(strava);
        return { parsed, strava };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load route";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadDemo = useCallback(() => {
    const coordinates = getDemoCoordinates();
    const parsed = analyzeRoute(coordinates, DEMO_STRAVA_ROUTE.name);
    const strava = DEMO_STRAVA_ROUTE;
    setParsedRoute(parsed);
    setStravaRoute(strava);
    return { parsed, strava };
  }, []);

  return { loading, error, parsedRoute, stravaRoute, loadRoute, loadDemo };
}
