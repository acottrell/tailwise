import { Metadata } from "next";
import { findRouteById } from "@/lib/db/queries";
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
      description = `${route.name} — ${miles}mi`;
      if (route.elevationGainM) {
        description += ` · ${Math.round(route.elevationGainM * 3.28084).toLocaleString()}ft`;
      }
      description += `. Check wind direction before you ride.`;
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
