import {
  haversineDistance,
  totalDistance,
  getPointAtDistance,
  getMidpointIndex,
  bearing,
  isClockwise as checkClockwise,
  downsample,
} from "./geo-utils";
import { Coordinate, RouteType, ParsedRoute } from "./types";

export function classifyRoute(coords: Coordinate[]): RouteType {
  const startEndDist = haversineDistance(coords[0], coords[coords.length - 1]);
  const total = totalDistance(coords);

  // Not a loop if start and end are far apart
  // Use 2% of total distance or 2km, whichever is larger
  const loopThreshold = Math.max(2, total * 0.02);
  if (startEndDist > loopThreshold) {
    return "point-to-point";
  }

  // Check multiple symmetric point pairs — a true out-and-back has nearly
  // overlapping outbound/return legs (within ~1km of each other).
  // An elongated loop can have pairs 3-8km apart, so we use a tight threshold.
  const checkPoints = [0.15, 0.25, 0.35, 0.45];
  let closePairs = 0;
  for (const frac of checkPoints) {
    const p1 = getPointAtDistance(coords, total * frac);
    const p2 = getPointAtDistance(coords, total * (1 - frac));
    const dist = haversineDistance(p1, p2);
    // True out-and-back: pairs are within 2km or 2% of total, whichever is larger
    if (dist < Math.max(2, total * 0.02)) {
      closePairs++;
    }
  }

  // All pairs must be close for out-and-back
  if (closePairs >= 4) {
    return "out-and-back";
  }

  return "loop";
}

export function analyzeRoute(
  coords: Coordinate[],
  name?: string
): ParsedRoute {
  // Downsample for performance
  const sampled = downsample(coords, 500);
  const total = totalDistance(sampled);
  const routeType = classifyRoute(sampled);
  const clockwise = checkClockwise(sampled);
  const midIdx = getMidpointIndex(sampled, total);

  // Outbound = first half, homeward = second half (in GPX-recorded order)
  const outboundBearing = bearing(sampled[0], sampled[midIdx]);
  const homewardBearing = bearing(sampled[midIdx], sampled[sampled.length - 1]);

  return {
    coordinates: sampled,
    totalDistanceKm: total,
    routeType,
    isClockwise: clockwise,
    midpointIndex: midIdx,
    outboundBearing,
    homewardBearing,
    name,
  };
}
