"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Coordinate } from "@/lib/types";

interface CafeInfoProps {
  routeName: string;
  coordinates: Coordinate[];
}

// Try to extract a cafe/pub name from route title
// Common patterns: "Cafe Name - Town", "Route to Cafe Name", "Cafe Name Loop"
function extractCafeName(routeName: string): string | null {
  const name = routeName.trim();
  if (!name) return null;

  // Common cycling cafe/food keywords
  const cafeKeywords = /\b(cafe|café|coffee|bakery|pub|inn|tea\s?room|kitchen|deli|pantry|stores|farm\s?shop)\b/i;

  if (!cafeKeywords.test(name)) return null;

  // Strip common suffixes: "- Town", "Loop", "Route", "Ride"
  let cafeName = name
    .replace(/\s*[-–]\s*(loop|route|ride|circular|round).*$/i, "")
    .replace(/\s+(loop|route|ride|circular|round)$/i, "")
    .trim();

  // If there's a " - Town" pattern, the cafe name is before the dash
  // But "Cafe Name - Thame" means the cafe is "Cafe Name" in "Thame"
  // Keep the full thing for the search query
  return cafeName || null;
}

function getCentroid(coords: Coordinate[]) {
  let lat = 0, lng = 0;
  for (const c of coords) {
    lat += c.lat;
    lng += c.lng;
  }
  return { lat: lat / coords.length, lng: lng / coords.length };
}

export function CafeInfo({ routeName, coordinates }: CafeInfoProps) {
  const cafeName = extractCafeName(routeName);
  if (!cafeName) return null;

  const centroid = getCentroid(coordinates);
  const searchQuery = encodeURIComponent(cafeName);
  const googleMapsUrl = `https://www.google.com/maps/search/${searchQuery}/@${centroid.lat},${centroid.lng},13z`;

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              <line x1="6" y1="2" x2="6" y2="4" />
              <line x1="10" y1="2" x2="10" y2="4" />
              <line x1="14" y1="2" x2="14" y2="4" />
            </svg>
            <div>
              <p className="text-xs text-muted-foreground">Suggested cafe stop</p>
              <p className="text-sm font-medium">{cafeName}</p>
            </div>
          </div>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            View
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
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
