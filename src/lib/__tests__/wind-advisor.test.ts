import { describe, it, expect } from "vitest";
import { getRecommendation, analyzeRide } from "../wind-advisor";
import { analyzeRoute } from "../route-analyzer";
import { getDemoCoordinates } from "../demo-route";
import {
  straightLineNorth,
  outAndBackNorth,
  rectangleLoop,
  circleLoop,
  hourlySeries,
  LEIGHTON_BUZZARD,
} from "./helpers";

// Simulation inputs: a winter day (offset 0) with the forecast starting at
// midnight and a morning departure, so wall-clock hours read naturally.
const OFFSET = 0;
const DEPARTURE = new Date("2026-01-10T08:00:00Z");

function steadyWind(fromDeg: number, speedMph: number) {
  return hourlySeries("2026-01-10T00:00", 48, () => ({ speedMph, fromDeg }));
}

describe("getRecommendation — out-and-back", () => {
  const route = analyzeRoute(outAndBackNorth(LEIGHTON_BUZZARD, 20));

  it("heading out into a northerly means a full tailwind home", () => {
    // Regression guard for commit 0aba539: you head INTO the wind on the
    // way out so it pushes you home.
    const rec = getRecommendation(route, steadyWind(0, 12), DEPARTURE, OFFSET);
    expect(rec.homewardTailwindMph).toBeCloseTo(12, 0);
  });

  it("a southerly on the same route means a headwind home", () => {
    const rec = getRecommendation(route, steadyWind(180, 12), DEPARTURE, OFFSET);
    expect(rec.homewardTailwindMph).toBeCloseTo(-12, 0);
  });

  it("direction never matters: both ways share the same road", () => {
    for (const windFrom of [0, 90, 180, 270]) {
      const rec = getRecommendation(route, steadyWind(windFrom, 15), DEPARTURE, OFFSET);
      expect(rec.direction).toBe("as-planned");
      expect(rec.tailwindAdvantage).toBe(0);
    }
  });
});

describe("getRecommendation — direction choice (point-to-point)", () => {
  const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));

  it("recommends as-planned when the ride ends with the tailwind", () => {
    const rec = getRecommendation(route, steadyWind(180, 10), DEPARTURE, OFFSET);
    expect(rec.direction).toBe("as-planned");
    expect(rec.tailwindAdvantage).toBeCloseTo(20, 0);
    expect(rec.confidence).toBe("strong");
  });

  it("recommends reverse when the wind favours the other way", () => {
    const rec = getRecommendation(route, steadyWind(0, 10), DEPARTURE, OFFSET);
    expect(rec.direction).toBe("reverse");
    expect(rec.tailwindAdvantage).toBeCloseTo(20, 0);
    expect(rec.confidence).toBe("strong");
  });

  it("suppresses sub-1mph advantages entirely", () => {
    // Regression guard for commit ef921a8. Advantage here is 2 * 0.4 = 0.8.
    const rec = getRecommendation(route, steadyWind(0, 0.4), DEPARTURE, OFFSET);
    expect(rec.direction).toBe("as-planned");
    expect(rec.tailwindAdvantage).toBe(0);
    expect(rec.confidence).toBe("low");
  });

  it("grades confidence by advantage: 2-5 mph moderate, >5 strong", () => {
    expect(
      getRecommendation(route, steadyWind(0, 1.5), DEPARTURE, OFFSET).confidence
    ).toBe("moderate"); // adv 3
    expect(
      getRecommendation(route, steadyWind(0, 3), DEPARTURE, OFFSET).confidence
    ).toBe("strong"); // adv 6
  });

  it("light wind and no advantage reads as ride-either-way", () => {
    const rec = getRecommendation(route, steadyWind(90, 3), DEPARTURE, OFFSET);
    expect(rec.confidence).toBe("low");
    expect(rec.message).toBe("Wind is light, ride either way");
  });

  it("strong crosswind still reports no directional advantage", () => {
    const rec = getRecommendation(route, steadyWind(90, 15), DEPARTURE, OFFSET);
    expect(rec.confidence).toBe("low");
    expect(rec.message).toBe("No advantage either direction");
  });
});

describe("getRecommendation — closed loops in steady wind are direction-neutral", () => {
  // Reversing a loop flips every segment's bearing, so with steady wind
  // the tailwind-x-distance sums cancel exactly (wind . net displacement
  // = 0 on any closed loop): every metre of tailwind one way is a metre
  // of headwind the other. The simulation reports that honestly — loop
  // direction only matters when the wind changes during the ride.

  it("rectangle, wind on the long axis: no direction advantage", () => {
    const route = analyzeRoute(rectangleLoop(LEIGHTON_BUZZARD));
    const rec = getRecommendation(route, steadyWind(90, 10), DEPARTURE, OFFSET);
    expect(rec.tailwindAdvantage).toBeLessThan(1);
    // But the homeward half (the long west leg) genuinely has the tailwind.
    expect(rec.homewardTailwindMph).toBeGreaterThan(5);
  });

  it("circle: no direction advantage in any steady wind", () => {
    const route = analyzeRoute(circleLoop(LEIGHTON_BUZZARD, 8));
    for (const windFrom of [0, 90, 180, 270]) {
      const rec = getRecommendation(route, steadyWind(windFrom, 15), DEPARTURE, OFFSET);
      expect(rec.tailwindAdvantage).toBeLessThan(1);
    }
  });
});

describe("getRecommendation — time-aware wind", () => {
  it("the same route and forecast flip direction with departure time", () => {
    // Southerly in the morning, northerly from noon. Ride north in the
    // morning and the wind is behind you; set off at noon and it isn't.
    // A departure-time-only model can't tell these apart from the
    // conditions at the door — the simulation scores the hours you ride.
    const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));
    const veering = hourlySeries("2026-01-10T00:00", 48, (hour) => ({
      speedMph: 10,
      fromDeg: hour < 12 ? 180 : 0,
    }));

    const morning = getRecommendation(route, veering, DEPARTURE, OFFSET);
    expect(morning.direction).toBe("as-planned");

    const noon = new Date("2026-01-10T12:00:00Z");
    const midday = getRecommendation(route, veering, noon, OFFSET);
    expect(midday.direction).toBe("reverse");
  });

  it("wind flipping mid-ride can put the tailwind behind both legs", () => {
    // 124km rectangle at 16mph ≈ 4.8h from 8am: east leg until ~10:20,
    // west leg home after. Westerly until 10am then easterly: both long
    // legs ridden downwind. Direction stays neutral (the reversed ride
    // gets the same gift) but the homeward tailwind is real.
    const route = analyzeRoute(rectangleLoop(LEIGHTON_BUZZARD, 60, 2));
    const flipping = hourlySeries("2026-01-10T00:00", 48, (hour) => ({
      speedMph: 10,
      fromDeg: hour < 10 ? 270 : 90,
    }));
    const rec = getRecommendation(route, flipping, DEPARTURE, OFFSET);
    expect(rec.homewardTailwindMph).toBeGreaterThan(5);
  });
});

describe("analyzeRide — segment colours", () => {
  it("colours every segment and follows the recommended direction", () => {
    const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));
    const { recommendation, segmentColors } = analyzeRide(
      route,
      steadyWind(0, 10), // northerly → ride it in reverse, southbound
      DEPARTURE,
      OFFSET
    );
    expect(recommendation.direction).toBe("reverse");
    expect(segmentColors.length).toBe(route.coordinates.length - 1);
    // Reversed travel order: first segment starts at the route's end point.
    expect(segmentColors[0].from).toEqual(
      route.coordinates[route.coordinates.length - 1]
    );
    // Heading south under a northerly: tailwind the whole way.
    for (const seg of segmentColors) {
      expect(seg.color).toBe("tailwind");
      expect(seg.tailwindComponent).toBeCloseTo(10, 1);
    }
  });
});

describe("getRecommendation — robustness", () => {
  it("handles the real 80km demo loop without degenerate output", () => {
    const route = analyzeRoute(getDemoCoordinates());
    for (const windFrom of [0, 90, 180, 270]) {
      const rec = getRecommendation(route, steadyWind(windFrom, 20), DEPARTURE, OFFSET);
      expect(Number.isFinite(rec.tailwindAdvantage)).toBe(true);
      expect(Number.isFinite(rec.homewardTailwindMph)).toBe(true);
      expect(["as-planned", "reverse"]).toContain(rec.direction);
    }
  });

  it("a perfect circle stays near-neutral in steady wind", () => {
    const route = analyzeRoute(circleLoop(LEIGHTON_BUZZARD, 8));
    const rec = getRecommendation(route, steadyWind(0, 15), DEPARTURE, OFFSET);
    expect(rec.tailwindAdvantage).toBeLessThan(3);
  });

  it("returns a neutral recommendation with no forecast", () => {
    const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));
    const rec = getRecommendation(route, [], DEPARTURE, OFFSET);
    expect(rec.confidence).toBe("low");
    expect(rec.tailwindAdvantage).toBe(0);
  });

  it("clamps rides extending past the forecast horizon to the last hour", () => {
    const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));
    const shortForecast = hourlySeries("2026-01-10T00:00", 9, () => ({
      speedMph: 10,
      fromDeg: 180,
    }));
    const rec = getRecommendation(route, shortForecast, DEPARTURE, OFFSET);
    expect(rec.direction).toBe("as-planned");
    expect(rec.homewardTailwindMph).toBeCloseTo(10, 0);
  });

  it("rounds tailwind figures to one decimal place", () => {
    const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));
    const rec = getRecommendation(route, steadyWind(7, 13.37), DEPARTURE, OFFSET);
    expect(rec.tailwindAdvantage).toBe(Math.round(rec.tailwindAdvantage * 10) / 10);
    expect(rec.homewardTailwindMph).toBe(
      Math.round(rec.homewardTailwindMph * 10) / 10
    );
  });
});
