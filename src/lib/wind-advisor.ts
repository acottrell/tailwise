import { ParsedRoute, WeatherData, Recommendation } from "./types";
import { tailwindComponent, bearing } from "./geo-utils";
import {
  CONFIDENCE_LOW_THRESHOLD_MPH,
  CONFIDENCE_STRONG_THRESHOLD_MPH,
} from "@/constants";

export function getRecommendation(
  route: ParsedRoute,
  weather: WeatherData
): Recommendation {
  const { coordinates, midpointIndex, isClockwise } = route;
  const { windSpeedMph, windDirectionDeg } = weather;

  // Natural order (as recorded in GPX/polyline)
  const homewardBearingNatural = bearing(
    coordinates[midpointIndex],
    coordinates[coordinates.length - 1]
  );

  // Reversed order
  const homewardBearingReversed = bearing(
    coordinates[midpointIndex],
    coordinates[0]
  );

  const tailwindNatural = tailwindComponent(
    windDirectionDeg,
    windSpeedMph,
    homewardBearingNatural
  );

  const tailwindReversed = tailwindComponent(
    windDirectionDeg,
    windSpeedMph,
    homewardBearingReversed
  );

  const advantage = Math.abs(tailwindNatural - tailwindReversed);

  // Determine which direction gives better tailwind coming home
  const naturalIsBetter = tailwindNatural > tailwindReversed;
  const direction: "as-planned" | "reverse" = naturalIsBetter ? "as-planned" : "reverse";

  const homewardTailwind = Math.max(tailwindNatural, tailwindReversed);

  let confidence: Recommendation["confidence"];
  let message: string;

  if (advantage < CONFIDENCE_LOW_THRESHOLD_MPH) {
    confidence = "low";
    message = windSpeedMph < 5
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
    direction,
    confidence,
    tailwindAdvantage: Math.round(advantage * 10) / 10,
    homewardTailwindMph: Math.round(homewardTailwind * 10) / 10,
    message,
  };
}
