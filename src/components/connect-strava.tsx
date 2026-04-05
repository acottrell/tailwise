"use client";

import { Button } from "@/components/ui/button";

interface ConnectStravaProps {
  onConnect: () => void;
  onDemo?: () => void;
  demoLoading?: boolean;
}

export function ConnectStrava({ onConnect, onDemo, demoLoading }: ConnectStravaProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-16 text-center">
      <div className="max-w-sm space-y-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Wind at your back on the way home.
        </h1>
        <div className="flex justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground font-semibold text-xs">1</span>
            <span>Connect Strava</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground font-semibold text-xs">2</span>
            <span>Paste a route</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground font-semibold text-xs">3</span>
            <span>Ride smart</span>
          </div>
        </div>
        <div className="space-y-3">
          <Button
            size="lg"
            onClick={onConnect}
            className="bg-[#FC4C02] hover:bg-[#e04400] text-white font-semibold px-8 w-full sm:w-auto"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Connect with Strava
          </Button>
          {onDemo && (
            <div>
              <button
                onClick={onDemo}
                disabled={demoLoading}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                {demoLoading ? "Loading demo..." : "Try with a sample route"}
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          No data is stored.
        </p>
      </div>
    </div>
  );
}
