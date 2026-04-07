"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { WindCompass } from "@/components/wind-compass";
import { Recommendation } from "@/lib/types";

const GROUP_LABELS: Record<string, string> = {
  G1: "Group 1",
  G2: "Group 2",
  G3: "Group 3",
  All: "All Groups",
  LBRCC: "LBRCC",
};

interface RideRoute {
  id: string;
  name: string;
  destination: string | null;
  cafeStop: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  routeType: string;
  stravaRouteId: string | null;
}

interface WeeklyRide {
  id: string;
  groupName: string;
  rideDate: string;
  departureTime: string | null;
  meetingPoint: string | null;
  notes: string | null;
  route: RideRoute;
  recommendation: Recommendation | null;
}

interface WeeklyAnnouncement {
  id: string;
  weekStart: string;
  title: string;
  body: string | null;
  url: string | null;
  route: {
    id: string;
    name: string;
    stravaRouteId: string | null;
    distanceKm: number;
    elevationGainM: number | null;
  } | null;
}

interface LbrccData {
  currentWeekStart: string;
  rides: WeeklyRide[];
  announcements: WeeklyAnnouncement[];
}

function formatRideDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

export default function LbrccPage() {
  const [data, setData] = useState<LbrccData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetch("/api/lbrcc?weeks=1")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleHome = useCallback(() => {
    window.location.href = "/";
  }, []);

  if (loading) {
    return (
      <div className="min-h-full flex flex-col">
        <Header onHome={handleHome} showBack />
        <main className="flex-1 flex flex-col">
          <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
            <div className="rounded-lg bg-muted animate-pulse h-12" />
            <div className="rounded-lg bg-muted animate-pulse h-40" />
            <div className="rounded-lg bg-muted animate-pulse h-40" />
          </div>
        </main>
      </div>
    );
  }

  const currentWeek = data?.currentWeekStart ?? "";
  const upcomingRides = data?.rides.filter((r) => r.rideDate >= currentWeek) ?? [];
  const pastRides = data?.rides.filter((r) => r.rideDate < currentWeek) ?? [];
  const currentAnnouncements =
    data?.announcements.filter((a) => a.weekStart >= currentWeek) ?? [];

  // Group upcoming rides by date
  const ridesByDate = new Map<string, WeeklyRide[]>();
  for (const ride of upcomingRides) {
    const existing = ridesByDate.get(ride.rideDate) ?? [];
    existing.push(ride);
    ridesByDate.set(ride.rideDate, existing);
  }

  const hasUpcoming = upcomingRides.length > 0 || currentAnnouncements.length > 0;

  return (
    <div className="min-h-full flex flex-col">
      <Header onHome={handleHome} showBack />
      <main className="flex-1 flex flex-col">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-heading font-bold tracking-tight">Club Rides</h1>
            <p className="text-sm text-muted-foreground">
              LBRCC, Leighton Buzzard Road Cycling Club
            </p>
          </div>

          {/* Announcements */}
          {currentAnnouncements.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-amber-400/60 bg-card p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                </svg>
                <h3 className="text-sm font-semibold">{a.title}</h3>
              </div>
              {a.body && (
                <p className="text-sm text-muted-foreground">{a.body}</p>
              )}
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:underline transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  More info
                </a>
              )}
              {a.route && a.route.stravaRouteId && (
                <a
                  href={`https://www.strava.com/routes/${a.route.stravaRouteId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                  >
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                  View on Strava
                </a>
              )}
            </div>
          ))}

          {/* Upcoming rides */}
          {hasUpcoming ? (
            Array.from(ridesByDate.entries()).map(([dateStr, rides], idx) => (
              <div key={dateStr} className="space-y-3">
                {idx > 0 && <hr className="border-border" />}
                <h2 className="text-base font-heading font-semibold">
                  {formatRideDate(dateStr)}
                </h2>
                <div className="space-y-3">
                  {rides.map((ride) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                No rides posted yet for this week
              </p>
              <p className="text-xs text-muted-foreground">
                Check back later or browse today&apos;s best wind-optimised
                rides
              </p>
            </div>
          )}

          {/* Link to main Tailwise */}
          <div className="border-t border-border pt-4">
            <button
              onClick={handleHome}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Browse today&apos;s best rides &rarr;
            </button>
          </div>

          {/* Past rides */}
          {pastRides.length > 0 && (
            <div className="border-t border-border pt-4 space-y-3">
              <button
                onClick={() => setShowPast(!showPast)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 transition-transform ${showPast ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                Past rides ({pastRides.length})
              </button>
              {showPast && (
                <div className="space-y-2">
                  {pastRides.map((ride) => (
                    <div
                      key={ride.id}
                      className="rounded-lg border border-border bg-card p-3 opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {GROUP_LABELS[ride.groupName] ?? ride.groupName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            &middot; {formatRideDate(ride.rideDate)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-medium mt-1">
                        {ride.route.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
        Powered by{" "}
        <a
          href="/"
          className="hover:text-foreground transition-colors font-medium"
        >
          Tailwise
        </a>
      </footer>
    </div>
  );
}

function RideCard({ ride }: { ride: WeeklyRide }) {
  const distanceMiles = (ride.route.distanceKm / 1.609344).toFixed(0);
  const distanceKm = ride.route.distanceKm.toFixed(0);
  const elevationFt = ride.route.elevationGainM
    ? Math.round(ride.route.elevationGainM * 3.28084).toLocaleString()
    : null;

  const rec = ride.recommendation;
  const meaningfulAdvantage = rec && rec.tailwindAdvantage >= 1;

  const directionLabel = !rec
    ? null
    : !meaningfulAdvantage
      ? "Ride either way"
      : rec.direction === "as-planned"
        ? "Ride as planned"
        : "Ride in reverse";

  const confidenceColor = !rec
    ? ""
    : rec.confidence === "strong"
      ? "text-wind"
      : rec.confidence === "moderate"
        ? "text-foreground"
        : "text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {GROUP_LABELS[ride.groupName] ?? ride.groupName}
            </span>
            <h3 className="text-sm font-heading font-semibold truncate">
              {ride.route.cafeStop || ride.route.destination || ride.route.name}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {distanceMiles}mi ({distanceKm}km)
            {elevationFt && ` \u00b7 ${elevationFt}ft`}
            {ride.departureTime && ` \u00b7 ${formatTime12(ride.departureTime)}`}
          </p>
        </div>
        {ride.route.stravaRouteId && (
          <a
            href={`https://www.strava.com/routes/${ride.route.stravaRouteId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full border border-border text-xs font-medium hover:bg-accent transition-colors min-h-[44px]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="currentColor"
            >
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Strava
          </a>
        )}
      </div>

      {rec && directionLabel && (
        <div className="space-y-0.5">
          <p className={`text-sm font-medium ${confidenceColor}`}>
            {directionLabel}
            {meaningfulAdvantage && (
              <span className="text-muted-foreground font-normal">
                {" "}
                &middot; {rec.tailwindAdvantage} mph advantage
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{rec.message}</p>
        </div>
      )}

      {ride.meetingPoint && (
        <p className="text-xs text-muted-foreground">
          Meeting point: {ride.meetingPoint}
        </p>
      )}
      {ride.notes && (
        <p className="text-xs text-muted-foreground">{ride.notes}</p>
      )}
    </div>
  );
}
