"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRecommend } from "@/hooks/use-recommend";
import { track } from "@vercel/analytics";
import { RouteCard } from "@/components/route-card";
import { compassDirection } from "@/lib/geo-utils";

type DistanceFilter = "all" | "short" | "medium" | "long" | "long+";

interface RecommendFeedProps {
  onSelectRoute: (routeId: string) => void;
  onCheckSpecific: () => void;
  onSubmitRoute: () => void;
}

const FILTERS: { key: DistanceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "short", label: "Short" },
  { key: "medium", label: "Medium" },
  { key: "long", label: "Long" },
  { key: "long+", label: "Long+" },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecommendFeed({
  onSelectRoute,
  onCheckSpecific,
  onSubmitRoute,
}: RecommendFeedProps) {
  const { loading, error, result, recommend } = useRecommend();
  const [distance, setDistance] = useState<DistanceFilter>("all");
  const [departureKey, setDepartureKey] = useState("now");
  const [visibleCount, setVisibleCount] = useState(3);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const departureOptions = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      {
        key: "now",
        label: mounted ? `Now (${formatTime(now)})` : "Now",
        getTime: () => new Date(),
      },
      {
        key: "830",
        label: "Tomorrow at 8:30am",
        getTime: () => {
          const d = new Date(tomorrow);
          d.setHours(8, 30, 0, 0);
          return d;
        },
      },
      {
        key: "midday",
        label: "Tomorrow at midday",
        getTime: () => {
          const d = new Date(tomorrow);
          d.setHours(12, 0, 0, 0);
          return d;
        },
      },
      {
        key: "6pm",
        label: "Tomorrow at 6pm",
        getTime: () => {
          const d = new Date(tomorrow);
          d.setHours(18, 0, 0, 0);
          return d;
        },
      },
    ];
  }, [mounted]);

  const loadRecommendations = useCallback(
    (dist: DistanceFilter, depKey: string) => {
      const opt = departureOptions.find((o) => o.key === depKey);
      const time = opt?.getTime();
      recommend(dist, time)
        .then(() => track("recommend_loaded", { distance: dist, departure: depKey }))
        .catch(() => {});
    },
    [recommend, departureOptions]
  );

  // Load on mount
  useEffect(() => {
    loadRecommendations(distance, departureKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDistanceChange = (d: DistanceFilter) => {
    setDistance(d);
    setVisibleCount(3);
    loadRecommendations(d, departureKey);
  };

  const handleDepartureChange = (key: string) => {
    setDepartureKey(key);
    setVisibleCount(3);
    loadRecommendations(distance, key);
  };

  const weather = result?.weather;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Today&apos;s best rides</h2>
        {weather && (
          <p className="text-xs text-muted-foreground">
            {compassDirection(weather.windDirectionDeg)}{" "}
            {Math.round(weather.windSpeedMph)} mph wind ·{" "}
            {Math.round(weather.temperatureCelsius)}°C ·{" "}
            {weather.precipitationProbability}% rain
          </p>
        )}
      </div>

      {/* Distance filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleDistanceChange(f.key)}
            disabled={loading}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              distance === f.key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Departure picker */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">Departing</span>
        <select
          value={departureKey}
          onChange={(e) => handleDepartureChange(e.target.value)}
          disabled={loading}
          className="bg-transparent text-sm font-medium text-right cursor-pointer focus:outline-none disabled:opacity-50"
        >
          {departureOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Route cards */}
      {loading && !result && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-4 h-28 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {result && result.recommendations.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No routes found for this distance range.
          </p>
        </div>
      )}

      {result && result.recommendations.length > 0 && (
        <div className={`space-y-3 ${loading ? "opacity-50" : ""}`}>
          {result.recommendations.slice(0, visibleCount).map((route, i) => (
            <RouteCard
              key={route.id}
              route={route}
              rank={i + 1}
              onSelect={onSelectRoute}
            />
          ))}
          {result.recommendations.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + 3)}
              className="w-full rounded-lg border border-border bg-card py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              Show more {distance !== "all" ? `${FILTERS.find((f) => f.key === distance)?.label} ` : ""}rides
            </button>
          )}
        </div>
      )}

      {/* Secondary actions */}
      <div className="border-t border-border pt-4 text-center">
        <button
          onClick={onSubmitRoute}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Submit a route
        </button>
      </div>
    </div>
  );
}
