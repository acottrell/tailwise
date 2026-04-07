"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRecommend } from "@/hooks/use-recommend";
import { track } from "@vercel/analytics";
import { RouteCard } from "@/components/route-card";
import { WindCompass } from "@/components/wind-compass";
import { compassDirection } from "@/lib/geo-utils";

type DistanceFilter = "all" | "short" | "medium" | "long" | "long+";

interface RecommendFeedProps {
  onSelectRoute: (routeId: string, departureTime?: Date) => void;
  onCheckSpecific: () => void;
  onSubmitRoute: () => void;
  athleteName?: string;
}

const FILTERS: { key: DistanceFilter; label: string; range?: string }[] = [
  { key: "all", label: "All" },
  { key: "short", label: "Short", range: "Under 30mi" },
  { key: "medium", label: "Medium", range: "30–50mi" },
  { key: "long", label: "Long", range: "50–80mi" },
  { key: "long+", label: "Long+", range: "80mi+" },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

function getTimeLabel(departureKey: string): { title: string; timeWord: string } {
  if (departureKey === "now") return { title: "Today\u2019s best rides", timeWord: "today" };
  return { title: "Tomorrow\u2019s best rides", timeWord: "tomorrow" };
}

function getWindSummary(windDeg: number, windMph: number, timeWord: string): string {
  const dir = compassDirection(windDeg);
  if (windMph < 5) return `Light winds ${timeWord}, ride any direction`;
  const opposite: Record<string, string> = {
    N: "south", NE: "southwest", E: "west", SE: "northwest",
    S: "north", SW: "northeast", W: "east", NW: "southeast",
  };
  const best = opposite[dir] || "downwind";
  if (windMph >= 15) return `Strong wind ${timeWord}, consider riding ${best}`;
  return `Consider riding ${best} ${timeWord}`;
}

export function RecommendFeed({
  onSelectRoute,
  onCheckSpecific,
  onSubmitRoute,
  athleteName,
}: RecommendFeedProps) {
  const { loading, error, result, recommend } = useRecommend();
  const [distance, setDistance] = useState<DistanceFilter>("all");
  const [departureKey, setDepartureKey] = useState("now");
  const [visibleCount, setVisibleCount] = useState(3);
  const [mounted, setMounted] = useState(false);
  const [showDepartureMenu, setShowDepartureMenu] = useState(false);
  const departureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close departure menu on outside click
  useEffect(() => {
    if (!showDepartureMenu) return;
    function handleClick(e: MouseEvent) {
      if (departureRef.current && !departureRef.current.contains(e.target as Node)) {
        setShowDepartureMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDepartureMenu]);

  const departureOptions = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      {
        key: "now",
        label: mounted ? `Now (${formatTime(now)})` : "Now",
        shortLabel: "Now",
        getTime: () => new Date(),
      },
      {
        key: "830",
        label: "Tomorrow 8:30am",
        shortLabel: "8:30am",
        getTime: () => {
          const d = new Date(tomorrow);
          d.setHours(8, 30, 0, 0);
          return d;
        },
      },
      {
        key: "midday",
        label: "Tomorrow midday",
        shortLabel: "Midday",
        getTime: () => {
          const d = new Date(tomorrow);
          d.setHours(12, 0, 0, 0);
          return d;
        },
      },
      {
        key: "6pm",
        label: "Tomorrow 6pm",
        shortLabel: "6pm",
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
    setShowDepartureMenu(false);
    setVisibleCount(3);
    loadRecommendations(distance, key);
  };

  const weather = result?.weather;
  const currentDepartureOpt = departureOptions.find((o) => o.key === departureKey);

  const currentDeparture = useMemo(() => {
    const opt = departureOptions.find((o) => o.key === departureKey);
    return opt?.getTime();
  }, [departureOptions, departureKey]);

  const handleSelectRoute = useCallback(
    (routeId: string) => {
      onSelectRoute(routeId, currentDeparture);
    },
    [onSelectRoute, currentDeparture]
  );

  const { title: timeTitle, timeWord } = getTimeLabel(departureKey);

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
      {/* Title */}
      <h2 className="text-xl font-heading font-bold tracking-tight">
        {athleteName ? `${getGreeting()}, ${athleteName}` : timeTitle}
      </h2>

      {/* Sticky filter bar: weather + advice + filters + departure */}
      <div className="sticky top-[57px] z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/50 space-y-2.5">
        {/* Weather + departure row */}
        <div className="flex items-center justify-between">
          {weather ? (
            <div className="flex items-center gap-2.5">
              <WindCompass windDirectionDeg={weather.windDirectionDeg} size={28} />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  Wind {compassDirection(weather.windDirectionDeg)} {Math.round(weather.windSpeedMph)} mph
                  <span className="font-normal text-muted-foreground"> ({Math.round(weather.windSpeedMph * 1.60934)} km/h)</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(weather.temperatureCelsius)}°C · {weather.precipitationProbability}% rain
                </span>
              </div>
            </div>
          ) : (
            <div />
          )}

          {/* Departure dropdown */}
          <div className="relative" ref={departureRef}>
            <button
              onClick={() => setShowDepartureMenu(!showDepartureMenu)}
              disabled={loading}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {currentDepartureOpt?.shortLabel ?? "Now"}
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 opacity-50" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showDepartureMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-card shadow-lg py-1 z-20">
                {departureOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleDepartureChange(opt.key)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors min-h-[44px] ${
                      departureKey === opt.key
                        ? "bg-accent font-medium"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Wind advice */}
        {weather && (
          <p className="text-sm text-muted-foreground">
            {getWindSummary(weather.windDirectionDeg, weather.windSpeedMph, timeWord)}
          </p>
        )}

        {/* Distance filter pills — own row, full width */}
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => handleDistanceChange(f.key)}
              disabled={loading}
              className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors text-center ${
                distance === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {distance !== "all" && (
          <p className="text-xs text-muted-foreground text-center">
            {FILTERS.find((f) => f.key === distance)?.range}
          </p>
        )}
      </div>

      {/* Route cards */}
      {loading && !result && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-muted" />
                    <div className="h-4 bg-muted rounded w-3/5" />
                  </div>
                  <div className="h-3 bg-muted rounded w-2/5 ml-6" />
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-4 bg-muted rounded w-12" />
                  <div className="w-3 h-3 bg-muted rounded" />
                </div>
              </div>
              <div className="ml-6 h-4 bg-muted rounded w-2/3" />
              <div className="ml-6 flex gap-2">
                <div className="h-3 bg-muted rounded w-20" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>
            </div>
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
              onSelect={handleSelectRoute}
            />
          ))}
          {result.recommendations.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + 3)}
              className="w-full rounded-lg border border-border bg-card py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors min-h-[48px]"
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
          className="text-base text-muted-foreground hover:text-foreground transition-colors py-3"
        >
          Submit a route
        </button>
      </div>
    </div>
  );
}
