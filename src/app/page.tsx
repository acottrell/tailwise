"use client";

import { useState, useCallback } from "react";
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

export default function Home() {
  const [view, setView] = useState<View>({ type: "feed" });

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

  const handleSelectRoute = useCallback(
    async (routeId: string) => {
      setView({ type: "route-detail", routeId });
      track("route_viewed", { routeId });
      try {
        await loadDetail(routeId);
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
    setView({ type: "check-specific" });
    setCheckError(null);
  }, []);

  const handleSubmitRoute = useCallback(() => {
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
                  />
                  <RouteMap
                    coordinates={detail.route.coordinates}
                    segmentColors={detail.segmentColors}
                    windDirectionDeg={detail.weather.windDirectionDeg}
                    windSpeedMph={detail.weather.windSpeedMph}
                  />
                  <RideInfo
                    weather={detail.weather}
                    distanceMeters={detail.route.distanceKm * 1000}
                    elevationGainMeters={detail.route.elevationGainM ?? undefined}
                  />
                  <CafeInfo
                    routeName={detail.route.name}
                    coordinates={detail.route.coordinates}
                  />
                  <RoadClosures coordinates={detail.route.coordinates} />
                </div>
                <div className="pt-2">
                  <ShareButton routeId={detail.route.id} />
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
      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
        <a
          href="https://github.com/acottrell"
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
      </footer>
    </div>
  );
}
