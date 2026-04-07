import { Metadata } from "next";
import { findWeeklyRides, findWeeklyAnnouncements } from "@/lib/db/queries";
import LbrccPage from "./lbrcc-page";

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getNextSunday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + diff);
  return sunday.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const monday = getMonday(new Date());
  const nextSundayEnd = new Date(monday);
  nextSundayEnd.setDate(nextSundayEnd.getDate() + 13);
  const toDate = nextSundayEnd.toISOString().split("T")[0];

  let description = "Weekly rides from Leighton Buzzard Road Cycling Club";

  try {
    const [rides, announcements] = await Promise.all([
      findWeeklyRides(monday, toDate),
      findWeeklyAnnouncements(monday, toDate),
    ]);

    const upcomingRides = rides.filter((r) => r.rideDate >= monday);

    if (announcements.length > 0) {
      description = announcements[0].title;
      if (announcements[0].body) {
        description += ` · ${announcements[0].body}`;
      }
    } else if (upcomingRides.length > 0) {
      const groups = upcomingRides
        .map(
          (r) =>
            `${r.groupName}: ${r.route.cafeStop || r.route.destination || r.route.name}`
        )
        .join(" · ");
      description = `${getNextSunday()} · ${groups}`;
    }
  } catch {
    // Fall back to default description
  }

  const title = "LBRCC | Tailwise";

  return {
    title,
    description,
    openGraph: {
      title: "LBRCC · This week's rides",
      description,
      siteName: "Tailwise",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "LBRCC · This week's rides",
      description,
    },
  };
}

export default function Page() {
  return <LbrccPage />;
}
