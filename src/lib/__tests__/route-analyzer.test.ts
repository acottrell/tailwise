import { describe, it, expect } from "vitest";
import { classifyRoute, analyzeRoute } from "../route-analyzer";
import { totalDistance } from "../geo-utils";
import { getDemoCoordinates } from "../demo-route";
import {
  straightLineNorth,
  outAndBackNorth,
  circleLoop,
  LEIGHTON_BUZZARD,
} from "./helpers";

describe("classifyRoute", () => {
  it("classifies a 40km straight line as point-to-point", () => {
    const line = straightLineNorth(LEIGHTON_BUZZARD, 40);
    expect(classifyRoute(line)).toBe("point-to-point");
  });

  it("classifies a there-and-back ride as out-and-back", () => {
    const route = outAndBackNorth(LEIGHTON_BUZZARD, 20);
    expect(classifyRoute(route)).toBe("out-and-back");
  });

  it("classifies a circular route as loop, not out-and-back", () => {
    const route = circleLoop(LEIGHTON_BUZZARD, 8);
    expect(classifyRoute(route)).toBe("loop");
  });

  it("classifies the real demo route (closed 80km loop) as loop", () => {
    expect(classifyRoute(getDemoCoordinates())).toBe("loop");
  });
});

describe("analyzeRoute", () => {
  it("measures a circular loop's distance as ~2*PI*r", () => {
    const analyzed = analyzeRoute(circleLoop(LEIGHTON_BUZZARD, 8));
    const expected = 2 * Math.PI * 8;
    expect(Math.abs(analyzed.totalDistanceKm - expected)).toBeLessThan(0.5);
  });

  it("detects orientation of clockwise and counter-clockwise loops", () => {
    expect(analyzeRoute(circleLoop(LEIGHTON_BUZZARD, 8, 120, true)).isClockwise).toBe(true);
    expect(analyzeRoute(circleLoop(LEIGHTON_BUZZARD, 8, 120, false)).isClockwise).toBe(false);
  });

  it("puts the midpoint index near half the points on a uniform route", () => {
    const analyzed = analyzeRoute(circleLoop(LEIGHTON_BUZZARD, 8, 120));
    expect(analyzed.midpointIndex).toBeGreaterThan(55);
    expect(analyzed.midpointIndex).toBeLessThan(65);
  });

  it("downsamples long routes to 500 points without losing much distance", () => {
    const dense = circleLoop(LEIGHTON_BUZZARD, 8, 2000);
    const analyzed = analyzeRoute(dense);
    expect(analyzed.coordinates.length).toBe(500);
    const denseTotal = totalDistance(dense);
    expect(Math.abs(analyzed.totalDistanceKm - denseTotal)).toBeLessThan(0.5);
  });

  it("computes opposite outbound and homeward bearings for an out-and-back", () => {
    const analyzed = analyzeRoute(outAndBackNorth(LEIGHTON_BUZZARD, 20));
    expect(analyzed.outboundBearing).toBeCloseTo(0, 0);
    expect(analyzed.homewardBearing).toBeCloseTo(180, 0);
  });

  it("carries the route name through", () => {
    const analyzed = analyzeRoute(circleLoop(LEIGHTON_BUZZARD, 8), "Test Loop");
    expect(analyzed.name).toBe("Test Loop");
  });
});
