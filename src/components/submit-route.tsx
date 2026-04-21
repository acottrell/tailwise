"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { track } from "@vercel/analytics";

const LOADING_MESSAGES = [
  "Fetching route from Strava...",
  "Analysing wind exposure...",
  "Mapping segments...",
];

interface SubmitRouteProps {
  onBack: () => void;
}

export function SubmitRoute({ onBack }: SubmitRouteProps) {
  const [stravaUrl, setStravaUrl] = useState("");
  const [cafeStop, setCafeStop] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setMessageIndex(0);
    const interval = setInterval(() => {
      setMessageIndex((i) =>
        i < LOADING_MESSAGES.length - 1 ? i + 1 : i
      );
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        const body: Record<string, string> = { stravaUrl };
        if (cafeStop.trim()) body.cafeStop = cafeStop.trim();
        if (sourceName.trim()) body.sourceName = sourceName.trim();

        const res = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409 && data.existingRouteId) {
            window.location.href = `/route/${data.existingRouteId}`;
            return;
          }
          setError(data.error || "Submission failed");
          return;
        }

        track("submission_created");
        window.location.href = `/route/${data.id}`;
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [stravaUrl, cafeStop, sourceName]
  );

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in duration-300">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          <p
            key={messageIndex}
            className="text-sm text-muted-foreground animate-in fade-in duration-300"
          >
            {LOADING_MESSAGES[messageIndex]}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Submit a route</h2>
        <p className="text-sm text-muted-foreground">
          Share a Strava route and get instant wind analysis.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="strava-url">
            Strava route URL
          </label>
          <input
            id="strava-url"
            type="url"
            value={stravaUrl}
            onChange={(e) => setStravaUrl(e.target.value)}
            placeholder="https://www.strava.com/routes/123456"
            required
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="cafe-stop">
            Cafe stops (optional)
          </label>
          <p className="text-xs text-muted-foreground">
            For longer routes, separate multiple stops with a comma
          </p>
          <input
            id="cafe-stop"
            type="text"
            value={cafeStop}
            onChange={(e) => setCafeStop(e.target.value)}
            placeholder="e.g. Norsk, Church Farm Cafe"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="source-name">
            Name or club (optional)
          </label>
          <p className="text-xs text-muted-foreground">
            Shown publicly on Tailwise alongside this route
          </p>
          <input
            id="source-name"
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="e.g. LBRCC"
            maxLength={50}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          Submit route
        </Button>
      </form>

    </div>
  );
}
