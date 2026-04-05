"use client";

import { useState, useMemo } from "react";
import { SunTimes } from "@/lib/types";

interface DeparturePickerProps {
  sunTimes: SunTimes[];
  onDepartureChange: (time: Date) => void;
  loading?: boolean;
}

interface DepartureOption {
  label: string;
  getTime: () => Date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function DeparturePicker({ sunTimes, onDepartureChange, loading }: DeparturePickerProps) {
  const [selected, setSelected] = useState("now");

  const options = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find tomorrow's sunrise from sunTimes data
    const tomorrowDateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const tomorrowSun = sunTimes.find((s) => s.date === tomorrowDateStr);

    // Parse sunrise time for display
    let sunriseLabel = "";
    let sunH = 6, sunM = 0;
    if (tomorrowSun) {
      // sunrise is an ISO string like "2026-03-29T06:15:00"
      const sunDate = new Date(tomorrowSun.sunrise);
      sunH = sunDate.getHours();
      sunM = sunDate.getMinutes();
      sunriseLabel = ` (${String(sunH).padStart(2, "0")}:${String(sunM).padStart(2, "0")})`;
    }

    // Build options in chronological order
    const opts: [string, DepartureOption][] = [
      ["now", {
        label: `Now (${formatTime(now)})`,
        getTime: () => new Date(),
      }],
    ];

    if (tomorrowSun) {
      const h = sunH, m = sunM;
      opts.push(["sunrise", {
        label: `Tomorrow at sunrise${sunriseLabel}`,
        getTime: () => {
          const d = new Date(tomorrow);
          d.setHours(h, m, 0, 0);
          return d;
        },
      }]);
    }

    opts.push(["830", {
      label: "Tomorrow at 8:30am",
      getTime: () => {
        const d = new Date(tomorrow);
        d.setHours(8, 30, 0, 0);
        return d;
      },
    }]);

    opts.push(["midday", {
      label: "Tomorrow at midday",
      getTime: () => {
        const d = new Date(tomorrow);
        d.setHours(12, 0, 0, 0);
        return d;
      },
    }]);

    return opts;
  }, [sunTimes]);

  const handleChange = (value: string) => {
    setSelected(value);
    const entry = options.find(([key]) => key === value);
    if (entry) {
      onDepartureChange(entry[1].getTime());
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-sm text-muted-foreground">
        Departing
      </div>
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className="bg-transparent text-sm font-medium text-right cursor-pointer focus:outline-none disabled:opacity-50"
      >
        {options.map(([key, opt]) => (
          <option key={key} value={key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
