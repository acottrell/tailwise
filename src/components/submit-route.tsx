"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { track } from "@vercel/analytics";

interface SubmitRouteProps {
  onBack: () => void;
}

export function SubmitRoute({ onBack }: SubmitRouteProps) {
  const [stravaUrl, setStravaUrl] = useState("");
  const [cafeStop, setCafeStop] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
          setError(data.error || "Submission failed");
          return;
        }

        track("submission_created");
        setSubmitted(true);
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [stravaUrl, cafeStop, sourceName]
  );

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Thanks for submitting!</h2>
          <p className="text-sm text-muted-foreground">
            We review routes manually to keep quality high. Yours should appear
            in the recommendations within a couple of days.
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to today&apos;s rides
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Submit a route</h2>
        <p className="text-sm text-muted-foreground">
          Share a Strava route with the community. Your name or club will be
          shown alongside this route on Tailwise.
        </p>
        <p className="text-xs text-muted-foreground">
          Don&apos;t have Strava? Ask a clubmate to share the route link with you.
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
            Cafe stop (optional)
          </label>
          <input
            id="cafe-stop"
            type="text"
            value={cafeStop}
            onChange={(e) => setCafeStop(e.target.value)}
            placeholder="e.g. Norsk, Haddenham"
            maxLength={100}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="source-name">
            Your name or club (optional)
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
          {loading ? "Submitting..." : "Submit route"}
        </Button>
      </form>

    </div>
  );
}
