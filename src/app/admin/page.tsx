"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface PendingRoute {
  id: string;
  name: string;
  destination: string | null;
  cafeStop: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  routeType: string;
  sourceName: string;
  stravaRouteId: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [routes, setRoutes] = useState<PendingRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPending = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setRoutes(data.routes);
    } catch {
      setAuthenticated(false);
      setSecret("");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setAuthenticated(true);
      fetchPending(secret);
    },
    [secret, fetchPending]
  );

  const handleApprove = useCallback(
    async (id: string) => {
      setActionLoading(id);
      try {
        const res = await fetch(`/api/routes/${id}/approve`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (res.ok) {
          setRoutes((prev) => prev.filter((r) => r.id !== id));
        }
      } finally {
        setActionLoading(null);
      }
    },
    [secret]
  );

  const handleReject = useCallback(
    async (id: string) => {
      setActionLoading(id);
      try {
        const res = await fetch(`/api/routes/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (res.ok) {
          setRoutes((prev) => prev.filter((r) => r.id !== id));
        }
      } finally {
        setActionLoading(null);
      }
    },
    [secret]
  );

  if (!authenticated) {
    return (
      <div className="min-h-full flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <h1 className="text-lg font-semibold text-center">Tailwise Admin</h1>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin secret"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            autoFocus
          />
          <Button type="submit" className="w-full">
            Log in
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pending submissions</h1>
        <span className="text-sm text-muted-foreground">
          {routes.length} pending
        </span>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-4 h-28 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && routes.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No pending submissions
          </p>
        </div>
      )}

      {routes.map((route) => {
        const distanceMiles = (route.distanceKm / 1.609344).toFixed(0);
        const elevationFt = route.elevationGainM
          ? Math.round(route.elevationGainM * 3.28084).toLocaleString()
          : null;
        const isActioning = actionLoading === route.id;

        return (
          <div
            key={route.id}
            className="rounded-lg border border-border bg-card p-4 space-y-3"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{route.name}</h3>
              <p className="text-xs text-muted-foreground">
                {distanceMiles}mi ({route.distanceKm.toFixed(0)}km)
                {elevationFt && ` · ${elevationFt}ft`}
                {` · ${route.routeType}`}
              </p>
              {route.cafeStop && (
                <p className="text-xs text-muted-foreground">
                  Cafe: {route.cafeStop}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                By: {route.sourceName}
                {route.stravaRouteId && (
                  <>
                    {" · "}
                    <a
                      href={`https://www.strava.com/routes/${route.stravaRouteId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      View on Strava
                    </a>
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(route.id)}
                disabled={isActioning}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReject(route.id)}
                disabled={isActioning}
              >
                Reject
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
