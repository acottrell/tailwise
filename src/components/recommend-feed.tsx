"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRecommend } from "@/hooks/use-recommend";
import { track } from "@vercel/analytics";
import { RouteCard } from "@/components/route-card";
import { WindCompass } from "@/components/wind-compass";
import { compassDirection } from "@/lib/geo-utils";
import { getNamedRides } from "@/lib/named-rides";

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
  { key: "long+", label: "Epic", range: "80mi+" },
];

const DISTANCE_KM: Record<DistanceFilter, { min?: number; max?: number }> = {
  all: {},
  short: { max: 50 },
  medium: { min: 50, max: 85 },
  long: { min: 85, max: 130 },
  "long+": { min: 130 },
};

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

function calendarDaysBetween(from: Date, to: Date): number {
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const t = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
}

function getTimeLabel(departure: Date): { title: string; timeWord: string } {
  const days = calendarDaysBetween(new Date(), departure);
  if (days <= 0) return { title: "Today\u2019s best rides", timeWord: "today" };
  if (days === 1) return { title: "Tomorrow\u2019s best rides", timeWord: "tomorrow" };
  const weekday = departure.toLocaleDateString("en-GB", { weekday: "long" });
  return { title: `${weekday}\u2019s best rides`, timeWord: `on ${weekday}` };
}

function getWindSummary(windDeg: number, windMph: number, timeWord: string): string {
  const dir = compassDirection(windDeg);
  if (windMph < 8) return `Light winds ${timeWord}, ride any direction`;
  if (windMph >= 15) return `Strong ${dir} wind ${timeWord} — head into it for a tailwind home`;
  return `Head out ${dir} ${timeWord} for a tailwind home`;
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
  const [searchQuery, setSearchQuery] = useState("");
  const departureRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

    const named = getNamedRides(now);
    const tomorrowDay = tomorrow.getDay();
    const skipGeneric = new Set<string>();
    for (const ride of named) {
      if (ride.dayOfWeek !== tomorrowDay) continue;
      const h = ride.time.getHours();
      const m = ride.time.getMinutes();
      if (h === 8 && m === 30) skipGeneric.add("830");
      if (h === 12 && m === 0) skipGeneric.add("midday");
      if (h === 18 && m === 0) skipGeneric.add("6pm");
    }

    type Opt = { key: string; label: string; shortLabel: string; getTime: () => Date };

    const opts: Opt[] = [
      {
        key: "now",
        label: mounted ? `Now (${formatTime(now)})` : "Now",
        shortLabel: "Now",
        getTime: () => new Date(),
      },
    ];

    const tomorrowGeneric: Opt[] = [
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

    for (const opt of tomorrowGeneric) {
      if (!skipGeneric.has(opt.key)) opts.push(opt);
    }

    for (const ride of named) {
      const time = ride.time;
      opts.push({
        key: ride.key,
        label: ride.label,
        shortLabel: ride.shortLabel,
        getTime: () => new Date(time),
      });
    }

    opts.sort((a, b) => a.getTime().getTime() - b.getTime().getTime());
    return opts;
  }, [mounted]);

  const loadForDeparture = useCallback(
    (depKey: string) => {
      setVisibleCount(3);
      const opt = departureOptions.find((o) => o.key === depKey);
      const time = opt?.getTime();
      recommend("all", time)
        .then(() => track("recommend_loaded", { departure: depKey }))
        .catch(() => {});
    },
    [recommend, departureOptions]
  );

  // Reset to top 3 when tab becomes visible after being backgrounded
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setVisibleCount(3);
        setSearchQuery("");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Load all routes on mount
  useEffect(() => {
    loadForDeparture(departureKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDistanceChange = (d: DistanceFilter) => {
    setDistance(d);
    setVisibleCount(3);
  };

  const handleDepartureChange = (key: string) => {
    setDepartureKey(key);
    setShowDepartureMenu(false);
    setVisibleCount(3);
    loadForDeparture(key);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setVisibleCount(10);
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

  const filteredRecommendations = useMemo(() => {
    if (!result) return [];
    let routes = result.recommendations;

    // Apply distance filter
    if (distance !== "all") {
      const range = DISTANCE_KM[distance];
      routes = routes.filter((r) => {
        if (range.min && r.distanceKm < range.min) return false;
        if (range.max && r.distanceKm > range.max) return false;
        return true;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      routes = routes.filter((r) => {
        const name = r.name.toLowerCase();
        const cafe = (r.cafeStop ?? "").toLowerCase();
        const dest = (r.destination ?? "").toLowerCase();
        return name.includes(q) || cafe.includes(q) || dest.includes(q);
      });
    }

    return routes;
  }, [result, distance, searchQuery]);

  const { title: timeTitle, timeWord } = getTimeLabel(currentDeparture ?? new Date());

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
      {/* Title */}
      <h2 className="text-xl font-heading font-bold tracking-tight">
        {athleteName ? `${getGreeting()}, ${athleteName}` : timeTitle}
      </h2>

      {/* Sticky filter bar: weather + advice + filters + departure */}
      <div className="sticky top-[57px] z-10 -mx-4 px-4 py-3 bg-background border-b border-border/50 space-y-2.5">
        {/* Weather + departure row */}
        <div className="flex items-center justify-between">
          {weather ? (
            <div className="flex items-center gap-2.5">
              <WindCompass windDirectionDeg={weather.windDirectionDeg} size={40} />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  Wind {compassDirection(weather.windDirectionDeg)} {Math.round(weather.windSpeedMph)} mph
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

        {/* Distance filter pills */}
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

        {/* Search */}
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Or search by café or destination"
            className="w-full h-11 pl-9 pr-9 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setVisibleCount(3);
                searchRef.current?.blur();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
              aria-label="Clear search"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
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

      {result && filteredRecommendations.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {searchQuery.trim() && distance !== "all"
              ? `No routes matching "${searchQuery.trim()}" ${FILTERS.find((f) => f.key === distance)?.range?.toLowerCase() ?? ""}`
              : searchQuery.trim()
                ? `No routes matching "${searchQuery.trim()}"`
                : "No routes found for this distance range."}
          </p>
          {searchQuery.trim() && distance !== "all" && (
            <button
              onClick={() => handleDistanceChange("all")}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Try all distances
            </button>
          )}
        </div>
      )}

      {result && filteredRecommendations.length > 0 && (
        <div className={`space-y-3 ${loading ? "opacity-50" : ""}`}>
          {searchQuery.trim() && (
            <p className="text-xs text-muted-foreground">
              {filteredRecommendations.length} {filteredRecommendations.length === 1 ? "route" : "routes"}
            </p>
          )}
          {(searchQuery.trim()
            ? filteredRecommendations
            : filteredRecommendations.slice(0, visibleCount)
          ).map((route, i) => (
            <RouteCard
              key={route.id}
              route={route}
              rank={i + 1}
              onSelect={handleSelectRoute}
            />
          ))}
          {!searchQuery.trim() && filteredRecommendations.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + 3)}
              className="w-full rounded-lg border border-border bg-card py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors min-h-[48px]"
            >
              {filteredRecommendations.length - visibleCount} more rides
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
