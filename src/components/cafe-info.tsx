"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Coordinate } from "@/lib/types";

interface CafePosition {
  distanceKm: number;
  percent: number;
  reversed?: boolean;
}

interface CafeStopItem {
  name: string;
  position: CafePosition;
}

interface CafeInfoProps {
  routeName: string;
  cafeStop?: string | null;
  coordinates: Coordinate[];
  cafePosition?: CafePosition | null;
  cafeStops?: CafeStopItem[] | null;
  totalDistanceKm: number;
}

function extractCafeName(routeName: string): string | null {
  const name = routeName.trim();
  if (!name) return null;

  const cafeKeywords =
    /\b(cafe|café|coffee|bakery|pub|inn|tea\s?room|kitchen|deli|pantry|stores|farm\s?shop)\b/i;
  if (!cafeKeywords.test(name)) return null;

  const cafeName = name
    .replace(/\s*[-–]\s*(loop|route|ride|circular|round).*$/i, "")
    .replace(/\s+(loop|route|ride|circular|round)$/i, "")
    .trim();

  return cafeName || null;
}

function getCentroid(coords: Coordinate[]) {
  let lat = 0,
    lng = 0;
  for (const c of coords) {
    lat += c.lat;
    lng += c.lng;
  }
  return { lat: lat / coords.length, lng: lng / coords.length };
}

function formatPosition(pos: CafePosition, totalDistanceKm: number): string {
  const cafeMi = Math.round(pos.distanceKm / 1.609344);
  const totalMi = Math.round(totalDistanceKm / 1.609344);
  return `Mile ${cafeMi} of ${totalMi}${pos.reversed ? " in reverse" : ""}`;
}

function CoffeeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CafeRow({
  name,
  position,
  centroid,
  totalDistanceKm,
}: {
  name: string;
  position: CafePosition | null;
  centroid: { lat: number; lng: number };
  totalDistanceKm: number;
}) {
  const searchQuery = encodeURIComponent(name);
  const googleMapsUrl = `https://www.google.com/maps/search/${searchQuery}/@${centroid.lat},${centroid.lng},13z`;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        {position && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatPosition(position, totalDistanceKm)}
          </p>
        )}
      </div>
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
      >
        View
        <ExternalIcon />
      </a>
    </div>
  );
}

export function CafeInfo({
  routeName,
  cafeStop,
  coordinates,
  cafePosition,
  cafeStops,
  totalDistanceKm,
}: CafeInfoProps) {
  const centroid = getCentroid(coordinates);

  // Prefer multi-cafe array; fall back to single cafe fields
  const cafes: { name: string; position: CafePosition | null }[] = [];

  if (cafeStops && cafeStops.length > 0) {
    for (const c of cafeStops) {
      cafes.push({ name: c.name, position: c.position });
    }
  } else {
    const name = cafeStop || extractCafeName(routeName);
    if (name) {
      cafes.push({ name, position: cafePosition || null });
    }
  }

  if (cafes.length === 0) return null;

  const heading = cafes.length > 1 ? "Cafe stops" : "Suggested cafe stop";

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <CoffeeIcon />
          <p className="text-xs text-muted-foreground">{heading}</p>
        </div>
        <div className="space-y-3">
          {cafes.map((cafe, i) => (
            <div key={cafe.name}>
              {i > 0 && (
                <div className="border-t border-border/50 mb-3" />
              )}
              <CafeRow
                name={cafe.name}
                position={cafe.position}
                centroid={centroid}
                totalDistanceKm={totalDistanceKm}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
