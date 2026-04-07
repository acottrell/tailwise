"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Header } from "@/components/header";
import { DirectionCard } from "@/components/direction-card";
import { RideInfo } from "@/components/ride-info";
import { ShareButton } from "@/components/share-button";
import { RoadClosures } from "@/components/road-closures";
import { CafeInfo } from "@/components/cafe-info";
import { useRouteDetail } from "@/hooks/use-route-detail";
import { Button } from "@/components/ui/button";
import { RouteType } from "@/lib/types";

const RouteMap = dynamic(
  () => import("@/components/route-map").then((mod) => mod.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[50vh] sm:h-[60vh] rounded-lg bg-muted animate-pulse" />
    ),
  }
);

export default function RoutePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const routeId = params.id as string;
  const departParam = searchParams.get("depart");

  const { loading, error, detail, load } = useRouteDetail();

  useEffect(() => {
    const departureTime = departParam ? new Date(departParam) : undefined;
    load(routeId, departureTime).catch(() => {});
  }, [routeId, departParam, load]);

  const handleHome = useCallback(() => {
    window.location.href = "/";
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <Header onHome={handleHome} showBack />
      <main className="flex-1 flex flex-col">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
          {loading && !detail && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted animate-pulse h-32" />
              <div className="w-full h-[50vh] rounded-lg bg-muted animate-pulse" />
              <div className="rounded-lg bg-muted animate-pulse h-64" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleHome}
              >
                View today&apos;s rides
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
                <RideInfo
                  weather={detail.weather}
                  distanceMeters={detail.route.distanceKm * 1000}
                  elevationGainMeters={detail.route.elevationGainM ?? undefined}
                />
                <CafeInfo
                  routeName={detail.route.name}
                  cafeStop={detail.route.cafeStop}
                  coordinates={detail.route.coordinates}
                />
                <RoadClosures coordinates={detail.route.coordinates} />
                <ShareButton
                  routeId={detail.route.id}
                  routeName={detail.route.name}
                />
              </div>
              <div className="text-center pt-2">
                <button
                  onClick={handleHome}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  View today&apos;s rides
                </button>
              </div>
            </>
          )}
        </div>
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
