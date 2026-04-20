"use client";

import { useState, useCallback } from "react";
import {
  Coordinate,
  Recommendation,
  SegmentColor,
  WeatherData,
} from "@/lib/types";

export interface RouteDetail {
  route: {
    id: string;
    name: string;
    destination: string | null;
    cafeStop: string | null;
    cafePosition: { distanceKm: number; percent: number; reversed?: boolean } | null;
    distanceKm: number;
    elevationGainM: number | null;
    routeType: string;
    sourceName: string;
    sourceUrl: string | null;
    stravaRouteId: string | null;
    coordinates: Coordinate[];
    polyline: string;
    status: "approved" | "pending";
  };
  weather: WeatherData;
  recommendation: Recommendation;
  segmentColors: SegmentColor[];
}

export function useRouteDetail() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RouteDetail | null>(null);

  const load = useCallback(
    async (routeId: string, departureTime?: Date) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (departureTime) {
          params.set("departureTime", departureTime.toISOString());
        }
        const qs = params.toString();
        const url = `/api/routes/${routeId}${qs ? `?${qs}` : ""}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to load route");
        }

        const data: RouteDetail = await response.json();
        setDetail(data);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { loading, error, detail, load };
}
