"use client";

import { Card, CardContent } from "@/components/ui/card";
import { WindCompass } from "@/components/wind-compass";
import { Recommendation, RouteType } from "@/lib/types";

interface DirectionCardProps {
  recommendation: Recommendation;
  routeName?: string;
  routeType?: RouteType;
  stravaRouteId?: string | null;
  windDirectionDeg?: number;
}

const fadeSlide = (delay: number) =>
  ({
    style: {
      opacity: 0,
      animation: `fadeSlideUp 400ms ease-out ${delay}ms forwards`,
    },
  }) as const;

export function DirectionCard({
  recommendation,
  routeName,
  routeType,
  stravaRouteId,
  windDirectionDeg,
}: DirectionCardProps) {
  const { direction, confidence, message, tailwindAdvantage } = recommendation;

  const isNonLoop = routeType === "out-and-back" || routeType === "point-to-point";
  const isLowWind = confidence === "low";
  const noAdvantage = tailwindAdvantage === 0;
  const isStrong = confidence === "strong" || confidence === "moderate";

  const isReverse = direction === "reverse";
  const directionLabel = isReverse ? "Ride in reverse" : "Ride as planned";

  // Determine if we should show the hero treatment
  const showHero = !isNonLoop && !isLowWind && tailwindAdvantage >= 2;

  if (isNonLoop) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6 pb-5 text-center space-y-3">
          {routeName && (
            <p className="text-xs text-muted-foreground tracking-widest uppercase" {...fadeSlide(0)}>
              {routeName}
            </p>
          )}
          <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight" {...fadeSlide(100)}>
            Just get out there and ride!
          </h2>
          <p className="text-muted-foreground text-sm" {...fadeSlide(200)}>
            {routeType === "out-and-back"
              ? "Out-and-back route. Wind evens out over the ride"
              : "Point-to-point route. Direction advice not applicable"}
          </p>
          {stravaRouteId && <StravaButton stravaRouteId={stravaRouteId} delay={300} />}
        </CardContent>
      </Card>
    );
  }

  if (isLowWind && noAdvantage) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6 pb-5 text-center space-y-3">
          {routeName && (
            <p className="text-xs text-muted-foreground tracking-widest uppercase" {...fadeSlide(0)}>
              {routeName}
            </p>
          )}
          <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight" {...fadeSlide(100)}>
            Ride either way
          </h2>
          <p className="text-muted-foreground text-sm" {...fadeSlide(200)}>
            No wind advantage either direction
          </p>
          {stravaRouteId && <StravaButton stravaRouteId={stravaRouteId} delay={300} />}
        </CardContent>
      </Card>
    );
  }

  // Hero treatment for strong/moderate tailwind
  if (showHero) {
    return (
      <Card className="border-0 shadow-lg bg-primary/[0.04] border-primary/15">
        <CardContent className="pt-6 pb-5 text-center space-y-4">
          {routeName && (
            <p className="text-xs text-muted-foreground tracking-widest uppercase" {...fadeSlide(0)}>
              {routeName}
            </p>
          )}

          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight" {...fadeSlide(100)}>
            {directionLabel}
          </h2>

          <div {...fadeSlide(200)}>
            <span className="text-6xl font-heading font-extrabold tabular-nums text-wind">
              {tailwindAdvantage}
            </span>
            <p className="text-sm text-muted-foreground mt-1">mph tailwind advantage</p>
          </div>

          {windDirectionDeg != null && (
            <div className="flex justify-center" {...fadeSlide(250)}>
              <WindCompass windDirectionDeg={windDirectionDeg} size={52} />
            </div>
          )}

          {stravaRouteId && <StravaButton stravaRouteId={stravaRouteId} delay={300} />}
        </CardContent>
      </Card>
    );
  }

  // Low wind with slight advantage
  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="pt-6 pb-5 text-center space-y-3">
        {routeName && (
          <p className="text-xs text-muted-foreground tracking-widest uppercase" {...fadeSlide(0)}>
            {routeName}
          </p>
        )}

        <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight" {...fadeSlide(100)}>
          {directionLabel}
        </h2>

        <p className="text-muted-foreground text-sm" {...fadeSlide(200)}>
          <span className="font-semibold text-wind">{tailwindAdvantage} mph</span> tailwind advantage
        </p>

        {windDirectionDeg != null && (
          <div className="flex justify-center" {...fadeSlide(250)}>
            <WindCompass windDirectionDeg={windDirectionDeg} size={40} />
          </div>
        )}

        {stravaRouteId && <StravaButton stravaRouteId={stravaRouteId} delay={300} />}
      </CardContent>
    </Card>
  );
}

function StravaButton({ stravaRouteId, delay }: { stravaRouteId: string; delay: number }) {
  return (
    <div {...fadeSlide(delay)}>
      <a
        href={`https://www.strava.com/routes/${stravaRouteId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 mt-1 px-4 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-accent transition-colors min-h-[44px]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        Open in Strava
      </a>
    </div>
  );
}
