"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/header";
import { RecommendFeed } from "@/components/recommend-feed";
import { RouteInput } from "@/components/route-input";
import { SubmitRoute } from "@/components/submit-route";
import { DirectionCard } from "@/components/direction-card";
import { RideInfo } from "@/components/ride-info";
import { ShareButton } from "@/components/share-button";
import { RoadClosures } from "@/components/road-closures";
import { CafeInfo } from "@/components/cafe-info";
import { useRouteDetail } from "@/hooks/use-route-detail";
import { useStravaAuth } from "@/hooks/use-strava-auth";
import { useRoute } from "@/hooks/use-route";
import { useWeather } from "@/hooks/use-weather";
import { Button } from "@/components/ui/button";
import { RouteType } from "@/lib/types";
import { track } from "@vercel/analytics";

const RouteMap = dynamic(
  () => import("@/components/route-map").then((mod) => mod.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[50vh] sm:h-[60vh] rounded-lg bg-muted animate-pulse" />
    ),
  }
);

type View =
  | { type: "feed" }
  | { type: "route-detail"; routeId: string }
  | { type: "check-specific" }
  | { type: "submit" };

function formatDepartureLabel(departure?: Date): string | null {
  if (!departure) return null;
  const now = new Date();
  const isToday = departure.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = departure.toDateString() === tomorrow.toDateString();

  const h = departure.getHours();
  const m = departure.getMinutes();
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  const time = m === 0 ? `${h12}${period}` : `${h12}:${m.toString().padStart(2, "0")}${period}`;

  if (isToday) return `Conditions now`;
  if (isTomorrow) return `Conditions for tomorrow ${time}`;
  return `Conditions for ${departure.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${time}`;
}

function WindTransition({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute left-0 h-0.5 bg-primary/30 rounded-full"
          style={{
            top: `${35 + i * 15}%`,
            width: "40%",
            animation: `windStreak 400ms ease-out ${i * 60}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>({ type: "feed" });
  const [transitioning, setTransitioning] = useState(false);
  const [selectedDeparture, setSelectedDeparture] = useState<Date | undefined>();

  // Route detail (from library)
  const {
    loading: detailLoading,
    error: detailError,
    detail,
    load: loadDetail,
  } = useRouteDetail();

  // Check-specific route (existing Strava auth flow)
  const { isConnected, athlete, connect, disconnect, getValidToken } =
    useStravaAuth();
  const {
    loading: routeLoading,
    loadRoute,
    parsedRoute,
    stravaRoute,
  } = useRoute();
  const {
    loading: weatherLoading,
    result: weatherResult,
    analyze,
  } = useWeather();
  const [checkError, setCheckError] = useState<string | null>(null);

  // Browser back button support
  useEffect(() => {
    const handlePopState = () => {
      setView({ type: "feed" });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectRoute = useCallback(
    async (routeId: string, departureTime?: Date) => {
      setSelectedDeparture(departureTime);
      setTransitioning(true);
      window.history.pushState({ view: "route-detail", routeId }, "");
      setTimeout(() => {
        setView({ type: "route-detail", routeId });
        setTransitioning(false);
      }, 250);
      track("route_viewed", { routeId });
      try {
        await loadDetail(routeId, departureTime);
      } catch {
        // error state handled by hook
      }
    },
    [loadDetail]
  );

  const handleDepartureChange = useCallback(
    async (time: Date) => {
      if (view.type !== "route-detail") return;
      try {
        await loadDetail(view.routeId, time);
      } catch {
        // error state handled by hook
      }
    },
    [view, loadDetail]
  );

  const handleCheckSpecific = useCallback(() => {
    window.history.pushState({ view: "check-specific" }, "");
    setView({ type: "check-specific" });
    setCheckError(null);
  }, []);

  const handleSubmitRoute = useCallback(() => {
    window.history.pushState({ view: "submit" }, "");
    setView({ type: "submit" });
  }, []);

  const handleHome = useCallback(() => {
    setView({ type: "feed" });
    setCheckError(null);
  }, []);

  const handleCheckSubmit = useCallback(
    async (url: string) => {
      setCheckError(null);
      try {
        const token = await getValidToken();
        const { parsed } = await loadRoute(url, token);
        await analyze(parsed);
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          disconnect();
          setCheckError("Strava session expired. Please reconnect.");
        } else {
          setCheckError(
            e instanceof Error ? e.message : "Something went wrong"
          );
        }
      }
    },
    [getValidToken, loadRoute, analyze, disconnect]
  );

  const checkLoading = routeLoading || weatherLoading;
  const showCheckResults =
    weatherResult && parsedRoute && stravaRoute && !checkError;

  return (
    <div className="min-h-full flex flex-col">
      <WindTransition active={transitioning} />
      <Header
        athleteName={athlete?.firstName}
        onDisconnect={disconnect}
        onHome={handleHome}
        showBack={view.type !== "feed"}
      />
      <main className="flex-1 flex flex-col">
        {view.type === "feed" && (
          <RecommendFeed
            onSelectRoute={handleSelectRoute}
            onCheckSpecific={handleCheckSpecific}
            onSubmitRoute={handleSubmitRoute}
            athleteName={athlete?.firstName}
          />
        )}

        {view.type === "route-detail" && (
          <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
            {detailLoading && !detail && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted animate-pulse h-32" />
                <div className="w-full h-[50vh] rounded-lg bg-muted animate-pulse" />
                <div className="rounded-lg bg-muted animate-pulse h-64" />
              </div>
            )}

            {detailError && (
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-sm text-muted-foreground">{detailError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleHome}
                >
                  Back to rides
                </Button>
              </div>
            )}

            {detail && (
              <>
                <div className="space-y-4">
                  <DirectionCard
                    recommendation={detail.recommendation}
                    routeName={detail.route.name}
                    routeType={detail.route.routeType as RouteType}
                    stravaRouteId={detail.route.stravaRouteId}
                    windDirectionDeg={detail.weather.windDirectionDeg}
                  />
                  <RouteMap
                    coordinates={detail.route.coordinates}
                    segmentColors={detail.segmentColors}
                    windDirectionDeg={detail.weather.windDirectionDeg}
                    windSpeedMph={detail.weather.windSpeedMph}
                  />
                  {selectedDeparture && formatDepartureLabel(selectedDeparture) && (
                    <p className="text-xs text-muted-foreground text-center">
                      {formatDepartureLabel(selectedDeparture)}
                    </p>
                  )}
                  <RideInfo
                    weather={detail.weather}
                    distanceMeters={detail.route.distanceKm * 1000}
                    elevationGainMeters={detail.route.elevationGainM ?? undefined}
                  />
                  <CafeInfo
                    routeName={detail.route.name}
                    cafeStop={detail.route.cafeStop}
                    coordinates={detail.route.coordinates}
                    cafePosition={detail.route.cafePosition}
                    totalDistanceKm={detail.route.distanceKm}
                  />
                  <RoadClosures coordinates={detail.route.coordinates} />
                  <ShareButton
                    routeId={detail.route.id}
                    routeName={detail.route.name}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {view.type === "check-specific" && (
          <>
            {showCheckResults ? (
              <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
                <div className="space-y-4">
                  <DirectionCard
                    recommendation={weatherResult.recommendation}
                    routeName={stravaRoute.name}
                    routeType={parsedRoute.routeType}
                    stravaRouteId={stravaRoute.id?.toString() ?? null}
                    windDirectionDeg={weatherResult.weather.windDirectionDeg}
                  />
                  <RouteMap
                    coordinates={parsedRoute.coordinates}
                    segmentColors={weatherResult.segmentColors}
                    windDirectionDeg={weatherResult.weather.windDirectionDeg}
                    windSpeedMph={weatherResult.weather.windSpeedMph}
                  />
                  <RideInfo
                    weather={weatherResult.weather}
                    distanceMeters={stravaRoute.distance}
                    elevationGainMeters={stravaRoute.elevationGain}
                  />
                  <CafeInfo
                    routeName={stravaRoute.name}
                    coordinates={parsedRoute.coordinates}
                    totalDistanceKm={stravaRoute.distance / 1000}
                  />
                  <RoadClosures coordinates={parsedRoute.coordinates} />
                </div>
                <div className="flex items-center justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={handleHome}>
                    Back to rides
                  </Button>
                </div>
              </div>
            ) : !isConnected ? (
              <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6 text-center">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">
                    Check a specific route
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Connect Strava to check any public route URL
                  </p>
                </div>
                <Button onClick={connect}>Connect Strava</Button>
                <div className="border-t border-border pt-4">
                  <button
                    onClick={handleHome}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back to today&apos;s rides
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <RouteInput onSubmit={handleCheckSubmit} loading={checkLoading} />
                {checkError && (
                  <div className="max-w-lg mx-auto px-4 pb-8">
                    <div className="rounded-lg border border-border bg-card p-4 text-center">
                      <p className="text-sm">{checkError}</p>
                      {checkError.includes("expired") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={connect}
                        >
                          Reconnect
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                <div className="max-w-lg mx-auto px-4 pb-8 text-center">
                  <button
                    onClick={handleHome}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back to today&apos;s rides
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {view.type === "submit" && <SubmitRoute onBack={handleHome} />}
      </main>
      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground space-y-1">
        <p>
          Route library thanks to{" "}
          <a
            href="https://lbrcc.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            LBRCC
          </a>
        </p>
        <p>
          <a
            href="https://acottrell.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Built by Aaron Cottrell
          </a>
          {" · "}
          Weather data from{" "}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Open-Meteo
          </a>
        </p>
      </footer>
    </div>
  );
}
