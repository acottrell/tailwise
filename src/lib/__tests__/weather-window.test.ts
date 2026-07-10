import { describe, it, expect, vi, afterEach } from "vitest";
import {
  toWallClockHour,
  getWeatherForWindow,
  getWeatherSnapshot,
} from "../weather-client";
import { findBestRideWindows } from "../ride-window";
import { analyzeRoute } from "../route-analyzer";
import { HourlyWeather } from "../types";
import { straightLineNorth, LEIGHTON_BUZZARD } from "./helpers";

const BST = 3600; // Europe/London summer offset, seconds
const GMT = 0;

// Build an hourly series of wall-clock forecast entries starting at
// `startWall` ("YYYY-MM-DDTHH:00"). Wind speed encodes the hour-of-day so
// assertions can verify exactly which hours were selected.
function makeHourly(startWall: string, count: number): HourlyWeather[] {
  const entries: HourlyWeather[] = [];
  const start = new Date(startWall + ":00Z");
  for (let i = 0; i < count; i++) {
    const t = new Date(start.getTime() + i * 3600_000);
    const wall = t.toISOString().slice(0, 16);
    entries.push({
      time: wall,
      windSpeedMph: t.getUTCHours(),
      windDirectionDeg: 180,
      precipitationProbability: 0,
      temperatureCelsius: 15,
      apparentTemperatureCelsius: 15,
      relativeHumidity: 60,
    });
  }
  return entries;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("toWallClockHour", () => {
  it("applies the BST offset: 08:00 UTC is 09:00 London wall clock", () => {
    const instant = new Date("2026-07-11T08:00:00Z");
    expect(toWallClockHour(instant, BST)).toBe("2026-07-11T09");
  });

  it("is identity in winter (GMT)", () => {
    const instant = new Date("2026-01-10T09:00:00Z");
    expect(toWallClockHour(instant, GMT)).toBe("2026-01-10T09");
  });

  it("rolls the date across midnight", () => {
    const instant = new Date("2026-07-11T23:30:00Z"); // 00:30 London, next day
    expect(toWallClockHour(instant, BST)).toBe("2026-07-12T00");
  });
});

describe("getWeatherForWindow — timezone correctness", () => {
  // Tests run with TZ=UTC (see vitest.config.ts) to reproduce Vercel.

  it("BST: a 9am London departure selects the 9-11am wall-clock hours", () => {
    // Regression: the old code used server-local getHours(), which on a UTC
    // server selected 8-10am for a 9am London departure all summer.
    const hourly = makeHourly("2026-07-11T00:00", 24);
    const departure = new Date("2026-07-11T08:00:00Z"); // 09:00 London
    const weather = getWeatherForWindow(hourly, [], departure, 2, BST);
    // Selected hours 9, 10, 11 — wind speed encodes hour-of-day.
    expect(weather.windSpeedMph).toBeCloseTo((9 + 10 + 11) / 3, 5);
  });

  it("GMT: a 9am January departure selects the 9-11am hours", () => {
    const hourly = makeHourly("2026-01-10T00:00", 24);
    const departure = new Date("2026-01-10T09:00:00Z"); // 09:00 London
    const weather = getWeatherForWindow(hourly, [], departure, 2, GMT);
    expect(weather.windSpeedMph).toBeCloseTo((9 + 10 + 11) / 3, 5);
  });

  it("after the October changeover the offset reverts and stays correct", () => {
    // BST ends 2026-10-25. A ride on the 26th uses the GMT offset the API
    // now reports; wall-clock selection is unaffected by the transition.
    const hourly = makeHourly("2026-10-26T00:00", 24);
    const departure = new Date("2026-10-26T09:00:00Z");
    const weather = getWeatherForWindow(hourly, [], departure, 2, GMT);
    expect(weather.windSpeedMph).toBeCloseTo((9 + 10 + 11) / 3, 5);
  });

  it("selects real hours across midnight instead of falling back", () => {
    // Old code matched on a single calendar date, so any window crossing
    // midnight silently fell back to the first hours of the forecast.
    const hourly = makeHourly("2026-07-11T00:00", 48);
    const departure = new Date("2026-07-11T22:00:00Z"); // 23:00 London
    const weather = getWeatherForWindow(hourly, [], departure, 3, BST);
    // Hours 23, 00, 01, 02.
    expect(weather.windSpeedMph).toBeCloseTo((23 + 0 + 1 + 2) / 4, 5);
  });
});

describe("getWeatherSnapshot — timezone correctness", () => {
  it("BST: snapshot at a London instant picks the matching wall-clock hour", () => {
    const hourly = makeHourly("2026-07-11T00:00", 24);
    const at = new Date("2026-07-11T13:00:00Z"); // 14:00 London
    const snap = getWeatherSnapshot(hourly, at, BST);
    expect(snap?.windSpeedMph).toBe(14);
  });

  it("GMT: snapshot maps 1:1", () => {
    const hourly = makeHourly("2026-01-10T00:00", 24);
    const snap = getWeatherSnapshot(hourly, new Date("2026-01-10T14:00:00Z"), GMT);
    expect(snap?.windSpeedMph).toBe(14);
  });
});

describe("findBestRideWindows — timezone correctness", () => {
  const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));

  it("BST: does not include the already-elapsed London hour", () => {
    // Regression: old code built "now" from the server clock, so a UTC
    // server included one past London hour in the candidate windows.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T09:30:00Z")); // 10:30 London
    const hourly = makeHourly("2026-07-11T00:00", 24);
    const windows = findBestRideWindows(hourly, route, BST);
    expect(windows[0].time).toBe("2026-07-11T10:00");
    expect(windows.every((w) => w.time >= "2026-07-11T10:00")).toBe(true);
  });

  it("GMT: first candidate window is the current hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T10:30:00Z"));
    const hourly = makeHourly("2026-01-10T00:00", 24);
    const windows = findBestRideWindows(hourly, route, GMT);
    expect(windows[0].time).toBe("2026-01-10T10:00");
  });
});
