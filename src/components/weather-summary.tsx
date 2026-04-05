"use client";

import { WeatherData } from "@/lib/types";
import { compassDirection } from "@/lib/geo-utils";

interface WeatherSummaryProps {
  weather: WeatherData;
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function WeatherSummary({ weather }: WeatherSummaryProps) {
  const windDir = compassDirection(weather.windDirectionDeg);

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M17.7 7.7a7.5 7.5 0 1 0-5.4 12.8" />
            <path d="M14 14l3 3-3 3" />
            <path d="M21 17H14" />
          </svg>
        }
        label="Wind"
        value={`${windDir} ${Math.round(weather.windSpeedMph)}mph`}
      />
      <StatCard
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M16 14v6M8 14v6M12 16v6" />
          </svg>
        }
        label="Rain chance"
        value={`${weather.precipitationProbability}%`}
      />
      <StatCard
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
          </svg>
        }
        label="Temp"
        value={`${Math.round(weather.temperatureCelsius)}°C`}
      />
    </div>
  );
}
