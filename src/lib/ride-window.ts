import { HourlyWeather, ParsedRoute, RideWindow } from "./types";
import { tailwindComponent, bearing } from "./geo-utils";
import { PRECIP_PENALTY_FACTOR, RIDE_WINDOW_HOURS } from "@/constants";
import { estimateRideDuration } from "./weather-client";

export function findBestRideWindows(
  hourly: HourlyWeather[],
  route: ParsedRoute
): RideWindow[] {
  const { coordinates, midpointIndex, isClockwise, totalDistanceKm } = route;
  const rideDuration = Math.ceil(estimateRideDuration(totalDistanceKm));

  const homewardNatural = bearing(
    coordinates[midpointIndex],
    coordinates[coordinates.length - 1]
  );
  const homewardReversed = bearing(
    coordinates[midpointIndex],
    coordinates[0]
  );

  const now = new Date();
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, "0");
  const localDay = String(now.getDate()).padStart(2, "0");
  const localHour = String(now.getHours()).padStart(2, "0");
  const nowHourStr = `${localYear}-${localMonth}-${localDay}T${localHour}`;

  // Filter to future hours only, up to RIDE_WINDOW_HOURS ahead
  const futureHours = hourly.filter((h) => {
    return h.time >= nowHourStr;
  }).slice(0, RIDE_WINDOW_HOURS);

  const windows: RideWindow[] = futureHours.map((h) => {
    const hour = parseInt(h.time.split("T")[1].split(":")[0]);

    // Score for natural direction
    const twNatural = tailwindComponent(
      h.windDirectionDeg,
      h.windSpeedMph,
      homewardNatural
    );

    // Score for reversed direction
    const twReversed = tailwindComponent(
      h.windDirectionDeg,
      h.windSpeedMph,
      homewardReversed
    );

    const bestTailwind = Math.max(twNatural, twReversed);
    const naturalIsBetter = twNatural > twReversed;

    const direction: "as-planned" | "reverse" = naturalIsBetter ? "as-planned" : "reverse";

    // Score: higher is better. Penalize rain.
    const score =
      bestTailwind - h.precipitationProbability * PRECIP_PENALTY_FACTOR;

    return {
      time: h.time,
      hour,
      score,
      direction,
      windSpeedMph: h.windSpeedMph,
      windDirectionDeg: h.windDirectionDeg,
      precipitationProbability: h.precipitationProbability,
      temperatureCelsius: h.temperatureCelsius,
      isBest: false,
    };
  });

  // Mark the best window
  if (windows.length > 0) {
    const bestIdx = windows.reduce(
      (best, w, i) => (w.score > windows[best].score ? i : best),
      0
    );
    windows[bestIdx].isBest = true;
  }

  return windows;
}
