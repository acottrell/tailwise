"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RouteInputProps {
  onSubmit: (url: string) => void;
  loading?: boolean;
}

export function RouteInput({ onSubmit, loading }: RouteInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-16">
      <div className="w-full max-w-lg space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-center">
          Where are you riding?
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="url"
            placeholder="Paste a Strava route URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={loading}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full font-semibold"
            disabled={!url.trim() || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Analysing...
              </span>
            ) : (
              "Check Wind"
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center">
          e.g. https://www.strava.com/routes/2919948651706799330
        </p>
      </div>
    </div>
  );
}
