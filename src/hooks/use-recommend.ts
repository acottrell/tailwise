"use client";

import { useState, useCallback } from "react";
import { Recommendation } from "@/lib/types";

export interface RouteRecommendation {
  id: string;
  name: string;
  destination: string | null;
  cafeStop: string | null;
  cafeOpen: boolean | null;
  cafeRating: number | null;
  distanceKm: number;
  elevationGainM: number | null;
  routeType: string;
  sourceName: string;
  sourceUrl: string | null;
  stravaRouteId: string | null;
  eventName: string | null;
  eventDate: string | null;
  eventUrl: string | null;
  recommendation: Recommendation;
}

export interface RecommendResult {
  weather: {
    windSpeedMph: number;
    windDirectionDeg: number;
    precipitationProbability: number;
    temperatureCelsius: number;
  } | null;
  recommendations: RouteRecommendation[];
  totalRoutes: number;
}

type DistanceFilter = "all" | "short" | "medium" | "long" | "long+";

const DISTANCE_RANGES: Record<DistanceFilter, { min?: number; max?: number }> =
  {
    all: {},
    short: { max: 50 },
    medium: { min: 50, max: 85 },
    long: { min: 85, max: 130 },
    "long+": { min: 130 },
  };

export function useRecommend() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResult | null>(null);

  const recommend = useCallback(
    async (distance: DistanceFilter = "all", departureTime?: Date) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        const range = DISTANCE_RANGES[distance];
        if (range.min) params.set("minDistanceKm", String(range.min));
        if (range.max) params.set("maxDistanceKm", String(range.max));
        if (departureTime) {
          params.set("departureTime", departureTime.toISOString());
        }

        const response = await fetch(`/api/routes/recommend?${params}`);
        if (!response.ok) {
          throw new Error("Failed to load recommendations");
        }

        const data: RecommendResult = await response.json();
        setResult(data);
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

  return { loading, error, result, recommend };
}
