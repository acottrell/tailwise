"use client";

import { useEffect, useState } from "react";
import { Coordinate } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

interface RoadClosuresProps {
  coordinates: Coordinate[];
}

function getCentroid(coords: Coordinate[]) {
  let lat = 0, lng = 0;
  for (const c of coords) {
    lat += c.lat;
    lng += c.lng;
  }
  return { lat: lat / coords.length, lng: lng / coords.length };
}

export function RoadClosures({ coordinates }: RoadClosuresProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [areaName, setAreaName] = useState<string | null>(null);

  useEffect(() => {
    const centroid = getCentroid(coordinates);

    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${centroid.lat}&lon=${centroid.lng}&zoom=8&format=json&addressdetails=1`,
      { headers: { "User-Agent": "Tailwise/1.0" } }
    )
      .then((r) => r.json())
      .then((data) => {
        const county = data?.address?.county || data?.address?.state_district || "Hertfordshire";
        const slug = county.toLowerCase().replace(/\s+/g, "-");
        setAreaName(county);
        setUrl(`https://one.network/uk/${slug}`);
      })
      .catch(() => {
        setAreaName("Hertfordshire");
        setUrl("https://one.network/uk/hertfordshire");
      });
  }, [coordinates]);

  if (!url) return null;

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium">Road closures</p>
            <p className="text-xs text-muted-foreground">
              Check roadworks in {areaName} on one.network
            </p>
          </div>
          <a
            href={url}
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
