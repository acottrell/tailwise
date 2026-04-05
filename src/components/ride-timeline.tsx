"use client";

import { RideWindow, SunTimes } from "@/lib/types";
import { compassDirection } from "@/lib/geo-utils";

interface RideTimelineProps {
  windows: RideWindow[];
  sunTimes: SunTimes[];
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function parseHour(isoTime: string): number {
  return parseInt(isoTime.split("T")[1].split(":")[0]);
}

function parseMinutes(isoTime: string): number {
  const parts = isoTime.split("T")[1].split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function getDateLabel(dateStr: string): string {
  const now = new Date();
  const target = new Date(dateStr + "T12:00:00");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffMs = targetDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  return target.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatSunTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Sunrise icon (half sun rising over horizon)
function SunriseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 inline-block" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M8 2v2M3.5 5.5l1 1M12.5 5.5l-1 1M2 10h12" />
      <path d="M4 10a4 4 0 0 1 8 0" />
    </svg>
  );
}

// Sunset icon (half sun setting below horizon)
function SunsetIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 inline-block" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M8 4v-2M3.5 5.5l1 1M12.5 5.5l-1 1M2 10h12" />
      <path d="M4 10a4 4 0 0 1 8 0" />
    </svg>
  );
}

export function RideTimeline({ windows, sunTimes }: RideTimelineProps) {
  if (windows.length === 0 || sunTimes.length === 0) return null;

  const firstWindowDate = windows[0]?.time.split("T")[0];
  const daySun = sunTimes.find((s) => s.date === firstWindowDate) || sunTimes[0];

  const sunriseMinutes = parseMinutes(daySun.sunrise);
  const sunsetMinutes = parseMinutes(daySun.sunset);

  // Earliest ride = 30 mins before sunrise (rounded to hour)
  const earliestHour = Math.ceil((sunriseMinutes - 30) / 60);
  const sunsetHour = Math.floor(sunsetMinutes / 60);

  // Filter to rideable daylight hours
  const daylightWindows = windows.filter(
    (w) => w.hour >= earliestHour && w.hour <= sunsetHour
  );
  if (daylightWindows.length === 0) return null;

  const maxScore = Math.max(...daylightWindows.map((w) => w.score));
  const minScore = Math.min(...daylightWindows.map((w) => w.score));

  const topWindows = [...daylightWindows]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const best = topWindows[0];
  const dateLabel = getDateLabel(firstWindowDate);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Best time to ride · {dateLabel}
        </h3>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <SunriseIcon /> {formatSunTime(daySun.sunrise)}
          </span>
          <span className="flex items-center gap-1">
            <SunsetIcon /> {formatSunTime(daySun.sunset)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {topWindows.map((w, i) => {
          const windDir = compassDirection(w.windDirectionDeg);
          const isBest = i === 0;
          return (
            <div
              key={w.time}
              className={`flex items-center justify-between rounded-md px-3 py-2 ${
                isBest
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-muted/50"
              }`}
            >
              <span
                className={`text-lg font-semibold tabular-nums ${
                  isBest ? "text-green-500" : "text-foreground"
                }`}
              >
                {formatHour(w.hour)}
              </span>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {windDir} {Math.round(w.windSpeedMph)}mph
                </span>
                {w.precipitationProbability > 0 && (
                  <span
                    className={
                      w.precipitationProbability > 30 ? "text-blue-400" : ""
                    }
                  >
                    {w.precipitationProbability}% rain
                  </span>
                )}
                <span>{Math.round(w.temperatureCelsius)}°C</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Daylight hour dots */}
      <div className="pt-1">
        <div className="flex gap-0.5">
          {daylightWindows.map((w) => {
            const isBestHour = w.time === best.time;
            const range = maxScore - minScore || 1;
            const normalized = (w.score - minScore) / range;
            return (
              <div
                key={w.time}
                className="flex-1"
                title={`${formatHour(w.hour)}: ${Math.round(w.windSpeedMph)}mph ${compassDirection(w.windDirectionDeg)}, ${w.precipitationProbability}% rain`}
              >
                <div
                  className={`w-full h-1.5 rounded-full ${
                    w.precipitationProbability > 50
                      ? "bg-blue-400/60"
                      : isBestHour
                        ? "bg-green-500"
                        : normalized > 0.5
                          ? "bg-green-500/40"
                          : "bg-muted-foreground/20"
                  }`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>{formatHour(earliestHour)}</span>
          <span>{formatHour(sunsetHour)}</span>
        </div>
      </div>
    </div>
  );
}
