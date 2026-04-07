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
  const distanceKm = route.distanceKm.toFixed(0);
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

  return (
    <button
      onClick={() => onSelect(route.id)}
      className={`w-full text-left rounded-lg border bg-card p-4 space-y-2.5 hover:bg-accent/50 active:bg-accent transition-colors ${isEvent ? "border-amber-400/60" : "border-border"}`}
    >
      {isEvent && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 -mt-0.5 mb-1">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {route.eventName}
          {route.eventDate && ` · ${formatEventDate(route.eventDate)}`}
        </div>
      )}

      {/* Top row: rank + name + wind badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {rank}
            </span>
            <h3 className="text-sm font-heading font-semibold truncate">
              {route.cafeStop || route.destination || route.name}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            {distanceMiles}mi ({distanceKm}km)
            {elevationFt && ` · ${elevationFt}ft`}
            {route.routeType !== "loop" && ` · ${route.routeType}`}
          </p>
        </div>
        <div className="flex items-center shrink-0">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>

      {/* Wind summary — the key line */}
      <div className="pl-5">
        <p className={`text-sm font-medium ${wind.className}`}>
          {wind.text}
          {meaningfulAdvantage && directionHint && (
            <span className="text-muted-foreground font-normal">
              {" "}· ride {directionHint}
            </span>
          )}
        </p>
      </div>

      {(route.cafeStop || route.sourceName || route.stravaRouteId) && (
        <div className="pl-5 flex items-center gap-3 text-xs text-muted-foreground">
          {route.cafeStop && (
            <span className="flex items-center gap-1">
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              </svg>
              {route.cafeStop}
            </span>
          )}
          {route.sourceName && route.sourceName !== "Community" && (
            <span>Route by {route.sourceName}</span>
          )}
          {route.stravaRouteId && (
            <a
              href={`https://www.strava.com/routes/${route.stravaRouteId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto py-1 min-h-[44px]"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Strava
            </a>
          )}
        </div>
      )}
    </button>
  );
}
