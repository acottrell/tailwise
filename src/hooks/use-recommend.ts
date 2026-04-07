"use client";

import { useState, useCallback, useRef } from "react";
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
  ridingInsight: string | null;
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

// Client-side cache: 5 minute TTL
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: RecommendResult; timestamp: number }>();

function getCacheKey(distance: DistanceFilter, departureTime?: Date): string {
  // Round departure to the nearest hour to improve cache hits
  const depKey = departureTime
    ? new Date(
        departureTime.getFullYear(),
        departureTime.getMonth(),
        departureTime.getDate(),
        departureTime.getHours()
      ).toISOString()
    : "now";
  return `${distance}:${depKey}`;
}

export function useRecommend() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const recommend = useCallback(
    async (distance: DistanceFilter = "all", departureTime?: Date) => {
      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const cacheKey = getCacheKey(distance, departureTime);
      const cached = cache.get(cacheKey);

      // If cache is fresh, return immediately
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setResult(cached.data);
        setLoading(false);
        setError(null);
        return cached.data;
      }

      // If cache is stale but exists, show stale data immediately while revalidating
      if (cached) {
        setResult(cached.data);
      }

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

        const response = await fetch(`/api/routes/recommend?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to load recommendations");
        }

        const data: RecommendResult = await response.json();
        cache.set(cacheKey, { data, timestamp: Date.now() });
        setResult(data);
        return data;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return; // Silently ignore aborted requests
        }
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
