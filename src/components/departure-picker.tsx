"use client";

import { useState, useMemo, useEffect } from "react";
import { SunTimes } from "@/lib/types";
import { getNamedRides } from "@/lib/named-rides";

interface DeparturePickerProps {
  sunTimes: SunTimes[];
  initialDepartureTime?: Date;
  onDepartureChange: (time?: Date) => void;
  loading?: boolean;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${m.toString().padStart(2, "0")}${period}`;
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  const time = m === 0 ? `${h12}${period}` : `${h12}:${m.toString().padStart(2, "0")}${period}`;
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  const day = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${day} ${time}`;
}

function sameSlot(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
    && a.getHours() === b.getHours()
    && Math.abs(a.getMinutes() - b.getMinutes()) <= 5;
}

export function DeparturePicker({ sunTimes, initialDepartureTime, onDepartureChange, loading }: DeparturePickerProps) {
  const { options, defaultKey } = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const named = getNamedRides(now);
    const tomorrowDay = tomorrow.getDay();
    const skipGeneric = new Set<string>();
    for (const ride of named) {
      if (ride.dayOfWeek !== tomorrowDay) continue;
      const h = ride.time.getHours();
      const m = ride.time.getMinutes();
      if (h === 8 && m === 30) skipGeneric.add("830");
      if (h === 12 && m === 0) skipGeneric.add("midday");
      if (h === 18 && m === 0) skipGeneric.add("6pm");
    }

    const future: { key: string; label: string; time: Date }[] = [];

    const genericSlots: { key: string; label: string; h: number; m: number }[] = [
      { key: "830", label: "Tomorrow 8:30am", h: 8, m: 30 },
      { key: "midday", label: "Tomorrow midday", h: 12, m: 0 },
      { key: "6pm", label: "Tomorrow 6pm", h: 18, m: 0 },
    ];

    for (const slot of genericSlots) {
      if (!skipGeneric.has(slot.key)) {
        const d = new Date(tomorrow);
        d.setHours(slot.h, slot.m, 0, 0);
        future.push({ key: slot.key, label: slot.label, time: d });
      }
    }

    for (const ride of named) {
      future.push({ key: ride.key, label: ride.label, time: ride.time });
    }

    const tomorrowDateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const tomorrowSun = sunTimes.find((s) => s.date === tomorrowDateStr);

    if (tomorrowSun) {
      const sunDate = new Date(tomorrowSun.sunrise);
      const h = sunDate.getHours();
      const m = sunDate.getMinutes();
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const sunriseTime = new Date(tomorrow);
      sunriseTime.setHours(h, m, 0, 0);
      future.push({ key: "sunrise", label: `Tomorrow at sunrise (${timeStr})`, time: sunriseTime });
    }

    future.sort((a, b) => a.time.getTime() - b.time.getTime());

    type OptEntry = [string, { label: string; getTime: () => Date | undefined }];
    const opts: OptEntry[] = [
      ["now", { label: `Now (${formatTime(now)})`, getTime: () => undefined }],
    ];
    for (const f of future) {
      const t = f.time;
      opts.push([f.key, { label: f.label, getTime: () => t }]);
    }

    let matched = "now";
    const isNowish = initialDepartureTime && Math.abs(initialDepartureTime.getTime() - now.getTime()) < 60 * 60 * 1000;
    if (initialDepartureTime && !isNowish) {
      const match = future.find((f) => sameSlot(f.time, initialDepartureTime));
      if (match) {
        matched = match.key;
      } else {
        const key = "initial";
        const label = formatDateLabel(initialDepartureTime);
        const t = initialDepartureTime;
        opts.push([key, { label, getTime: () => t }]);
        opts.sort((a, b) => {
          if (a[0] === "now") return -1;
          if (b[0] === "now") return 1;
          const ta = a[1].getTime()?.getTime() ?? 0;
          const tb = b[1].getTime()?.getTime() ?? 0;
          return ta - tb;
        });
        matched = key;
      }
    }

    return { options: opts, defaultKey: matched };
  }, [sunTimes, initialDepartureTime]);

  const [selected, setSelected] = useState(defaultKey);

  useEffect(() => {
    setSelected(defaultKey);
  }, [defaultKey]);

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
