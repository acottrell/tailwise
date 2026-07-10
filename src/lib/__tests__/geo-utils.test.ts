import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  bearing,
  angleDifference,
  tailwindComponent,
  vectorAverageDirection,
  isClockwise,
  compassDirection,
  getPointAtDistance,
  getMidpointIndex,
  totalDistance,
  downsample,
} from "../geo-utils";
import {
  straightLineNorth,
  circleLoop,
  LEIGHTON_BUZZARD,
  KM_PER_DEG_LAT,
} from "./helpers";

describe("haversineDistance", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistance(LEIGHTON_BUZZARD, LEIGHTON_BUZZARD)).toBe(0);
  });

  it("measures one degree of latitude as ~111.2 km", () => {
    const a = { lat: 51.5, lng: -0.65 };
    const b = { lat: 52.5, lng: -0.65 };
    expect(haversineDistance(a, b)).toBeCloseTo(KM_PER_DEG_LAT, 0);
  });

  it("is symmetric", () => {
    const a = { lat: 51.9, lng: -0.66 };
    const b = { lat: 52.1, lng: -0.4 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 10);
  });
});

describe("bearing", () => {
  const origin = { lat: 51.9, lng: -0.65 };

  it("is 0 heading due north", () => {
    expect(bearing(origin, { lat: 52.0, lng: -0.65 })).toBeCloseTo(0, 5);
  });

  it("is 180 heading due south", () => {
    expect(bearing(origin, { lat: 51.8, lng: -0.65 })).toBeCloseTo(180, 5);
  });

  it("is ~90 heading due east", () => {
    const b = bearing(origin, { lat: 51.9, lng: -0.55 });
    expect(Math.abs(b - 90)).toBeLessThan(0.1);
  });

  it("is ~270 heading due west", () => {
    const b = bearing(origin, { lat: 51.9, lng: -0.75 });
    expect(Math.abs(b - 270)).toBeLessThan(0.1);
  });
});

describe("angleDifference", () => {
  it("handles the 360/0 wrap-around", () => {
    expect(angleDifference(350, 10)).toBe(20);
    expect(angleDifference(10, 350)).toBe(-20);
  });

  it("never exceeds 180 in magnitude", () => {
    expect(Math.abs(angleDifference(0, 180))).toBe(180);
    expect(angleDifference(90, 271)).toBeCloseTo(-179, 5);
  });
});

describe("tailwindComponent — wind FROM convention", () => {
  // Regression guards for the two shipped inversion bugs (commits
  // 0aba539 and c40f741): windFromDeg is where wind comes FROM, so a
  // northerly (from 0°) pushes a southbound rider (bearing 180) along.

  it("northerly wind is a full tailwind riding south", () => {
    expect(tailwindComponent(0, 15, 180)).toBeCloseTo(15, 5);
  });

  it("northerly wind is a full headwind riding north", () => {
    expect(tailwindComponent(0, 15, 0)).toBeCloseTo(-15, 5);
  });

  it("westerly wind is a full tailwind riding east", () => {
    expect(tailwindComponent(270, 12, 90)).toBeCloseTo(12, 5);
  });

  it("pure crosswind contributes nothing", () => {
    expect(tailwindComponent(90, 20, 0)).toBeCloseTo(0, 5);
  });

  it("45-degree offset gives cos(45) of the speed", () => {
    expect(tailwindComponent(0, 10, 135)).toBeCloseTo(10 * Math.SQRT1_2, 5);
  });
});

describe("vectorAverageDirection", () => {
  it("averages across the 0/360 boundary", () => {
    const avg = vectorAverageDirection([350, 10]);
    expect(avg > 355 || avg < 5).toBe(true);
  });

  it("weights pull the average toward the heavier direction", () => {
    const avg = vectorAverageDirection([0, 90], [3, 1]);
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThan(45);
  });
});

describe("isClockwise", () => {
  it("detects a clockwise loop", () => {
    expect(isClockwise(circleLoop(LEIGHTON_BUZZARD, 5, 60, true))).toBe(true);
  });

  it("detects a counter-clockwise loop", () => {
    expect(isClockwise(circleLoop(LEIGHTON_BUZZARD, 5, 60, false))).toBe(false);
  });
});

describe("compassDirection", () => {
  it("maps cardinal and intercardinal bearings", () => {
    expect(compassDirection(0)).toBe("N");
    expect(compassDirection(45)).toBe("NE");
    expect(compassDirection(90)).toBe("E");
    expect(compassDirection(180)).toBe("S");
    expect(compassDirection(270)).toBe("W");
    expect(compassDirection(350)).toBe("N");
  });
});

describe("getPointAtDistance / getMidpointIndex", () => {
  const line = straightLineNorth({ lat: 51.9, lng: -0.65 }, 20, 21);

  it("finds the point halfway along a straight line", () => {
    const p = getPointAtDistance(line, 10);
    const expectedLat = 51.9 + 10 / KM_PER_DEG_LAT;
    expect(p.lat).toBeCloseTo(expectedLat, 4);
  });

  it("clamps to the final point past the end", () => {
    const p = getPointAtDistance(line, 999);
    expect(p).toEqual(line[line.length - 1]);
  });

  it("midpoint index sits within one segment of half the total distance", () => {
    // Floating-point accumulation can land either side of the exact half.
    const total = totalDistance(line);
    const idx = getMidpointIndex(line, total);
    expect([10, 11]).toContain(idx);
  });
});

describe("downsample", () => {
  it("returns input untouched when under the cap", () => {
    const line = straightLineNorth({ lat: 51.9, lng: -0.65 }, 10, 50);
    expect(downsample(line, 500)).toBe(line);
  });

  it("caps length and preserves both endpoints", () => {
    const line = straightLineNorth({ lat: 51.9, lng: -0.65 }, 10, 1200);
    const sampled = downsample(line, 500);
    expect(sampled.length).toBe(500);
    expect(sampled[0]).toEqual(line[0]);
    expect(sampled[sampled.length - 1]).toEqual(line[line.length - 1]);
  });
});
