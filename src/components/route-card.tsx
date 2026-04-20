"use client";

import { RouteRecommendation } from "@/hooks/use-recommend";
import { compassDirection } from "@/lib/geo-utils";

interface RouteCardProps {
  route: RouteRecommendation;
  rank: number;
  onSelect: (id: string) => void;
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function windLabel(advantage: number): { text: string; className: string } {
  if (advantage >= 5) return { text: "Strong tailwind", className: "text-wind" };
  if (advantage >= 2) return { text: "Good tailwind", className: "text-wind" };
  if (advantage >= 1) return { text: "Light tailwind", className: "text-foreground" };
  return { text: "Ride either direction", className: "text-muted-foreground" };
}

export function RouteCard({ route, rank, onSelect }: RouteCardProps) {
  const { recommendation } = route;
  const isEvent = !!route.eventName;
  const distanceMiles = (route.distanceKm / 1.609344).toFixed(0);
  const elevationFt = route.elevationGainM
    ? Math.round(route.elevationGainM * 3.28084).toLocaleString()
    : null;

  const meaningfulAdvantage = recommendation.tailwindAdvantage >= 1;
  const wind = windLabel(recommendation.tailwindAdvantage);

  const directionHint = !meaningfulAdvantage
    ? null
    : recommendation.direction === "as-planned"
      ? "as planned"
      : "in reverse";

  const title = route.cafeStop || route.destination || route.name;

  return (
    <button
      onClick={() => onSelect(route.id)}
      className={`w-full text-left rounded-lg border bg-card px-4 py-3.5 hover:bg-accent/50 active:bg-accent transition-colors ${isEvent ? "border-amber-400/60" : "border-border"}`}
    >
      {isEvent && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {route.eventName}
          {route.eventDate && ` · ${formatEventDate(route.eventDate)}`}
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="min-w-[18px] text-sm font-medium text-muted-foreground tabular-nums text-right shrink-0">
          {rank}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-sm font-heading font-semibold truncate">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {distanceMiles}mi
            {elevationFt && ` · ${elevationFt}ft`}
            {route.routeType !== "loop" && ` · ${route.routeType}`}
          </p>
          {meaningfulAdvantage && (
            <p className={`text-xs font-medium ${wind.className}`}>
              {wind.text}
              {directionHint && (
                <span className="text-muted-foreground font-normal">
                  {" "}· {directionHint}
                </span>
              )}
            </p>
          )}
          {(route.cafeStop || (route.sourceName && route.sourceName !== "Community")) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {route.cafeStop && (
                <span className="inline-flex items-baseline gap-1">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 self-center relative -top-px" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                  </svg>
                  {route.cafeStop}
                </span>
              )}
              {route.sourceName && route.sourceName !== "Community" && (
                <span>{route.sourceName}</span>
              )}
            </div>
          )}
        </div>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-muted-foreground shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}
