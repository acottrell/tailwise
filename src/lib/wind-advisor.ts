import {
  ParsedRoute,
  HourlyWeather,
  Recommendation,
  SegmentColor,
  Coordinate,
} from "./types";
import { tailwindComponent, bearing, haversineDistance } from "./geo-utils";
import { toWallClockHour } from "./weather-client";
import { classifyWindAngle } from "./segment-colorizer";
import {
  ASSUMED_SPEED_KMH,
  FATIGUE_END_WEIGHT,
  DIRECTION_MEANINGFUL_THRESHOLD_MPH,
  CONFIDENCE_LOW_THRESHOLD_MPH,
  CONFIDENCE_STRONG_THRESHOLD_MPH,
} from "@/constants";

export interface RideAnalysis {
  recommendation: Recommendation;
  segmentColors: SegmentColor[];
}

interface WindSample {
  speedMph: number;
  fromDeg: number;
}

// Hours outside the forecast range clamp to the nearest available hour.
function makeWindLookup(
  hourly: HourlyWeather[],
  utcOffsetSeconds: number
): (at: Date) => WindSample {
  const byWall = new Map<string, HourlyWeather>();
  for (const h of hourly) byWall.set(h.time.slice(0, 13), h);
  const first = hourly[0];
  const last = hourly[hourly.length - 1];

  return (at: Date): WindSample => {
    const wall = toWallClockHour(at, utcOffsetSeconds);
    const h =
      byWall.get(wall) ?? (wall < first.time.slice(0, 13) ? first : last);
    return { speedMph: h.windSpeedMph, fromDeg: h.windDirectionDeg };
  };
}

interface DirectionSim {
  score: number;
  homewardTailwindMph: number;
  avgWindSpeedMph: number;
  segments: SegmentColor[];
}

// Simulate riding the route in one direction at the assumed club pace:
// each segment is scored against the forecast wind for the hour the rider
// would actually be there, weighted so late-ride segments count more.
function simulateDirection(
  coordinates: Coordinate[],
  windAt: (at: Date) => WindSample,
  departure: Date,
  reversed: boolean
): DirectionSim {
  const ordered = reversed ? [...coordinates].reverse() : coordinates;

  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    const len = haversineDistance(ordered[i], ordered[i + 1]);
    lengths.push(len);
    total += len;
  }
  if (total === 0) {
    return { score: 0, homewardTailwindMph: 0, avgWindSpeedMph: 0, segments: [] };
  }

  const segments: SegmentColor[] = [];
  let cum = 0;
  let scoreNum = 0;
  let scoreDen = 0;
  let homeNum = 0;
  let homeDen = 0;
  let windNum = 0;

  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i];
    const midKm = cum + len / 2;
    cum += len;

    const at = new Date(
      departure.getTime() + (midKm / ASSUMED_SPEED_KMH) * 3600_000
    );
    const wind = windAt(at);
    const segBearing = bearing(ordered[i], ordered[i + 1]);
    const tw = tailwindComponent(wind.fromDeg, wind.speedMph, segBearing);

    const progress = midKm / total;
    const weight = 1 + (FATIGUE_END_WEIGHT - 1) * progress;
    scoreNum += tw * len * weight;
    scoreDen += len * weight;

    if (progress >= 0.5) {
      homeNum += tw * len;
      homeDen += len;
    }
    windNum += wind.speedMph * len;

    segments.push({
      from: ordered[i],
      to: ordered[i + 1],
      color: classifyWindAngle(segBearing, wind.fromDeg),
      tailwindComponent: tw,
    });
  }

  return {
    score: scoreNum / scoreDen,
    homewardTailwindMph: homeDen > 0 ? homeNum / homeDen : 0,
    avgWindSpeedMph: windNum / total,
    segments,
  };
}

export function analyzeRide(
  route: ParsedRoute,
  hourly: HourlyWeather[],
  departure: Date,
  utcOffsetSeconds: number
): RideAnalysis {
  const { coordinates } = route;

  if (hourly.length === 0 || coordinates.length < 2) {
    return {
      recommendation: {
        direction: "as-planned",
        confidence: "low",
        tailwindAdvantage: 0,
        homewardTailwindMph: 0,
        message: "No forecast available",
      },
      segmentColors: [],
    };
  }

  const windAt = makeWindLookup(hourly, utcOffsetSeconds);
  const natural = simulateDirection(coordinates, windAt, departure, false);
  const reverse = simulateDirection(coordinates, windAt, departure, true);

  const rawAdvantage = Math.abs(natural.score - reverse.score);
  const meaningful = rawAdvantage >= DIRECTION_MEANINGFUL_THRESHOLD_MPH;
  const naturalIsBetter = natural.score > reverse.score;
  const direction: "as-planned" | "reverse" =
    meaningful && !naturalIsBetter ? "reverse" : "as-planned";
  const advantage = meaningful ? rawAdvantage : 0;
  const chosen = direction === "reverse" ? reverse : natural;

  let confidence: Recommendation["confidence"];
  let message: string;

  if (advantage < CONFIDENCE_LOW_THRESHOLD_MPH) {
    confidence = "low";
    message =
      chosen.avgWindSpeedMph < 5
        ? "Wind is light, ride either way"
        : "No advantage either direction";
  } else if (advantage < CONFIDENCE_STRONG_THRESHOLD_MPH) {
    confidence = "moderate";
    message = `Moderate tailwind advantage heading home`;
  } else {
    confidence = "strong";
    message = `Strong tailwind on the way home`;
  }

  return {
    recommendation: {
      direction,
      confidence,
      tailwindAdvantage: Math.round(advantage * 10) / 10,
      homewardTailwindMph: Math.round(chosen.homewardTailwindMph * 10) / 10,
      message,
    },
    segmentColors: chosen.segments,
  };
}

export function getRecommendation(
  route: ParsedRoute,
  hourly: HourlyWeather[],
  departure: Date,
  utcOffsetSeconds: number
): Recommendation {
  return analyzeRide(route, hourly, departure, utcOffsetSeconds).recommendation;
}
