import { Coordinate, SegmentColor } from "./types";
import { bearing, tailwindComponent, angleDifference } from "./geo-utils";
import {
  TAILWIND_ANGLE_THRESHOLD,
  HEADWIND_ANGLE_THRESHOLD,
} from "@/constants";

export function classifyWindAngle(
  segBearing: number,
  windFromDeg: number
): SegmentColor["color"] {
  const windToward = (windFromDeg + 180) % 360;
  const angle = Math.abs(angleDifference(segBearing, windToward));
  if (angle < TAILWIND_ANGLE_THRESHOLD) return "tailwind";
  if (angle > HEADWIND_ANGLE_THRESHOLD) return "headwind";
  return "crosswind";
}

export function colorizeSegments(
  coordinates: Coordinate[],
  windDirectionDeg: number,
  windSpeedMph: number,
  reversed: boolean
): SegmentColor[] {
  // If riding in reverse, flip the coordinate order
  const ordered = reversed ? [...coordinates].reverse() : coordinates;
  const segments: SegmentColor[] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const segBearing = bearing(ordered[i], ordered[i + 1]);
    const color = classifyWindAngle(segBearing, windDirectionDeg);

    segments.push({
      from: ordered[i],
      to: ordered[i + 1],
      color,
      tailwindComponent: tailwindComponent(
        windDirectionDeg,
        windSpeedMph,
        segBearing
      ),
    });
  }

  return segments;
}

export const SEGMENT_COLORS = {
  tailwind: "#22c55e",   // green-500
  crosswind: "#f59e0b",  // amber-500
  headwind: "#ef4444",   // red-500
} as const;
