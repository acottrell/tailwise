"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Recommendation, RouteType } from "@/lib/types";

interface DirectionCardProps {
  recommendation: Recommendation;
  routeName?: string;
  routeType?: RouteType;
  stravaRouteId?: string | null;
}

export function DirectionCard({
  recommendation,
  routeName,
  routeType,
  stravaRouteId,
}: DirectionCardProps) {
  const { direction, confidence, message, tailwindAdvantage } = recommendation;

  const isNonLoop = routeType === "out-and-back" || routeType === "point-to-point";
  const isLowWind = confidence === "low";
  const noAdvantage = tailwindAdvantage === 0;

  const isReverse = direction === "reverse";
  const directionLabel = isReverse ? "Ride in reverse" : "Ride as planned";
  const directionIcon = isReverse ? "↺" : "→";

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="pt-6 pb-5 text-center space-y-3">
        {routeName && (
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            {routeName}
          </p>
        )}

        {isNonLoop ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Just get out there and ride!
            </h2>
            <p className="text-muted-foreground text-sm">
              {routeType === "out-and-back"
                ? "Out-and-back route. Wind evens out over the ride"
                : "Point-to-point route. Direction advice not applicable"}
            </p>
          </>
        ) : isLowWind && noAdvantage ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Ride either way
            </h2>
            <p className="text-muted-foreground text-sm">
              No meaningful wind advantage either direction
            </p>
          </>
        ) : isLowWind ? (
          <>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl sm:text-4xl opacity-40">
                {directionIcon}
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {directionLabel}
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Slight edge, {tailwindAdvantage}mph advantage
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl sm:text-4xl opacity-70">
                {directionIcon}
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {directionLabel}
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              {message}. {tailwindAdvantage}mph advantage
            </p>
          </>
        )}

        {stravaRouteId && (
          <a
            href={`https://www.strava.com/routes/${stravaRouteId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-1 px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Open in Strava
          </a>
        )}
      </CardContent>
    </Card>
  );
}
