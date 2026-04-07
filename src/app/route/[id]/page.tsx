import { Metadata } from "next";
import { findRouteById, dbRowToParsedRoute } from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";
import { compassDirection } from "@/lib/geo-utils";
import RoutePage from "./route-page";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  let title = "Route | Tailwise";
  let description = "Wind-optimised cycling route recommendation";

  try {
    const route = await findRouteById(id);
    if (route) {
      const miles = Math.round(route.distanceKm / 1.609344);
      const name = route.cafeStop || route.destination || route.name;
      title = `${name} | Tailwise`;
      description = `${route.name} · ${miles}mi`;
      if (route.elevationGainM) {
        description += ` · ${Math.round(route.elevationGainM * 3.28084).toLocaleString()}ft`;
      }

      // Add live wind recommendation to share preview
      try {
        const { hourly, sunTimes } = await fetchWeatherServer(
          route.centroidLat,
          route.centroidLng,
          2
        );
        const parsedRoute = dbRowToParsedRoute(route);
        const duration = estimateRideDuration(route.distanceKm);
        const weather = getWeatherForWindow(hourly, sunTimes, new Date(), duration);
        const rec = getRecommendation(parsedRoute, weather);

        const windDir = compassDirection(weather.windDirectionDeg);
        const windSpeed = Math.round(weather.windSpeedMph);
        const temp = Math.round(weather.temperatureCelsius);

        if (rec.tailwindAdvantage >= 2) {
          const dir = rec.direction === "reverse" ? "in reverse" : "as planned";
          description += `. ${rec.tailwindAdvantage} mph tailwind ${dir}`;
        }
        description += `. ${windDir} ${windSpeed} mph · ${temp}°C`;
      } catch {
        description += `. Check wind direction before you ride.`;
      }
    }
  } catch {
    // Fall back to defaults
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Tailwise",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function Page() {
  return <RoutePage />;
}
