"use client";

import { useState, useCallback } from "react";
import { ParsedRoute, WeatherData, Recommendation, SegmentColor } from "@/lib/types";
import { fetchWeather, getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";
import { colorizeSegments } from "@/lib/segment-colorizer";

interface WeatherResult {
  weather: WeatherData;
  recommendation: Recommendation;
  segmentColors: SegmentColor[];
}

interface UseWeather {
  loading: boolean;
  error: string | null;
  result: WeatherResult | null;
  analyze: (route: ParsedRoute, departureTime?: Date) => Promise<WeatherResult>;
}

export function useWeather(): UseWeather {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WeatherResult | null>(null);

  const analyze = useCallback(
    async (route: ParsedRoute, departureTime?: Date): Promise<WeatherResult> => {
      setLoading(true);
      setError(null);

      try {
        const departure = departureTime || new Date();
        const duration = estimateRideDuration(route.totalDistanceKm);
        const { hourly, sunTimes } = await fetchWeather(route.coordinates);
        const weather = getWeatherForWindow(hourly, sunTimes, departure, duration);
        const recommendation = getRecommendation(route, weather);

        const shouldReverse = recommendation.direction === "reverse";

        const segmentColors = colorizeSegments(
          route.coordinates,
          weather.windDirectionDeg,
          weather.windSpeedMph,
          shouldReverse
        );

        const res: WeatherResult = {
          weather,
          recommendation,
          segmentColors,
        };

        setResult(res);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { loading, error, result, analyze };
}
