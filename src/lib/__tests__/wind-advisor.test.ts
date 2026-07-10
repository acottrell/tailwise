import { describe, it, expect } from "vitest";
import { getRecommendation } from "../wind-advisor";
import { analyzeRoute } from "../route-analyzer";
import { getDemoCoordinates } from "../demo-route";
import { WeatherData } from "../types";
import {
  straightLineNorth,
  outAndBackNorth,
  circleLoop,
  LEIGHTON_BUZZARD,
} from "./helpers";

function weather(windFromDeg: number, windSpeedMph: number): WeatherData {
  return {
    windSpeedMph,
    windDirectionDeg: windFromDeg,
    precipitationProbability: 0,
    temperatureCelsius: 15,
    apparentTemperatureCelsius: 15,
    relativeHumidity: 60,
    warmingTrend: 0,
    rideDurationHours: 2,
    hourly: [],
    sunTimes: [],
  };
}

describe("getRecommendation — out-and-back", () => {
  const route = analyzeRoute(outAndBackNorth(LEIGHTON_BUZZARD, 20));

  it("heading out into a northerly means a full tailwind home", () => {
    // Regression guard for commit 0aba539: you head INTO the wind on the
    // way out so it pushes you home. Outbound north into a northerly,
    // homeward leg south with the wind behind.
    const rec = getRecommendation(route, weather(0, 12));
    expect(rec.homewardTailwindMph).toBeCloseTo(12, 0);
  });

  it("a southerly on the same route means a headwind home", () => {
    const rec = getRecommendation(route, weather(180, 12));
    expect(rec.homewardTailwindMph).toBeCloseTo(-12, 0);
  });

  it("direction never matters: both ways share the same road", () => {
    for (const windFrom of [0, 90, 180, 270]) {
      const rec = getRecommendation(route, weather(windFrom, 15));
      expect(rec.direction).toBe("as-planned");
      expect(rec.tailwindAdvantage).toBe(0);
    }
  });
});

describe("getRecommendation — direction choice (point-to-point)", () => {
  // Straight line north: natural homeward bearing is north (mid -> end),
  // reversed is south (mid -> start). Wind aligned with the line makes the
  // direction choice unambiguous and the advantage exactly 2x wind speed.
  const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));

  it("recommends as-planned when the natural homeward leg has the tailwind", () => {
    const rec = getRecommendation(route, weather(180, 10)); // southerly, pushes north
    expect(rec.direction).toBe("as-planned");
    expect(rec.tailwindAdvantage).toBeCloseTo(20, 0);
    expect(rec.confidence).toBe("strong");
  });

  it("recommends reverse when the wind favours the other way", () => {
    const rec = getRecommendation(route, weather(0, 10)); // northerly
    expect(rec.direction).toBe("reverse");
    expect(rec.tailwindAdvantage).toBeCloseTo(20, 0);
    expect(rec.confidence).toBe("strong");
  });

  it("suppresses sub-1mph advantages entirely", () => {
    // Regression guard for commit ef921a8. Advantage here is 2 * 0.4 = 0.8.
    const rec = getRecommendation(route, weather(0, 0.4));
    expect(rec.direction).toBe("as-planned");
    expect(rec.tailwindAdvantage).toBe(0);
    expect(rec.confidence).toBe("low");
  });

  it("grades confidence by advantage: 2-5 mph moderate, >5 strong", () => {
    expect(getRecommendation(route, weather(0, 1.5)).confidence).toBe("moderate"); // adv 3
    expect(getRecommendation(route, weather(0, 3)).confidence).toBe("strong"); // adv 6
  });

  it("light wind and no advantage reads as ride-either-way", () => {
    const rec = getRecommendation(route, weather(90, 3)); // light crosswind
    expect(rec.confidence).toBe("low");
    expect(rec.message).toBe("Wind is light, ride either way");
  });

  it("strong crosswind still reports no directional advantage", () => {
    const rec = getRecommendation(route, weather(90, 15)); // pure crosswind
    expect(rec.confidence).toBe("low");
    expect(rec.message).toBe("No advantage either direction");
  });
});

describe("getRecommendation — closed loops (documents current limitation)", () => {
  // For a closed loop, start and end are the same point, so the two
  // straight-line homeward bearings (midpoint -> end vs midpoint -> start)
  // are nearly identical and the direction advantage is always ~0.
  // Distinguishing loop direction needs segment-level and/or time-of-day
  // wind analysis. If these start failing, that limitation has been fixed —
  // update the expectations rather than the implementation.

  it("perfect circle: no direction advantage regardless of wind", () => {
    const route = analyzeRoute(circleLoop(LEIGHTON_BUZZARD, 8));
    for (const windFrom of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rec = getRecommendation(route, weather(windFrom, 15));
      expect(rec.tailwindAdvantage).toBeLessThan(1);
    }
  });

  it("real 80km demo loop: advantage stays under 2mph even in 20mph wind", () => {
    const route = analyzeRoute(getDemoCoordinates());
    for (const windFrom of [0, 90, 180, 270]) {
      const rec = getRecommendation(route, weather(windFrom, 20));
      expect(rec.tailwindAdvantage).toBeLessThan(2);
    }
  });
});

describe("getRecommendation — output shape", () => {
  it("rounds tailwind figures to one decimal place", () => {
    const route = analyzeRoute(straightLineNorth(LEIGHTON_BUZZARD, 40));
    const rec = getRecommendation(route, weather(7, 13.37));
    expect(rec.tailwindAdvantage).toBe(Math.round(rec.tailwindAdvantage * 10) / 10);
    expect(rec.homewardTailwindMph).toBe(Math.round(rec.homewardTailwindMph * 10) / 10);
  });
});
