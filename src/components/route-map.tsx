"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Coordinate, SegmentColor } from "@/lib/types";
import { SEGMENT_COLORS } from "@/lib/segment-colorizer";

interface RouteMapProps {
  coordinates: Coordinate[];
  segmentColors: SegmentColor[];
  windDirectionDeg: number;
  windSpeedMph: number;
}

export function RouteMap({
  coordinates,
  segmentColors,
  windDirectionDeg,
  windSpeedMph,
}: RouteMapProps) {
  // Scale colour intensity by wind speed: <5mph = faded, 5-15mph = mid, >15mph = vivid
  const colorOpacity = Math.min(0.9, Math.max(0.25, (windSpeedMph - 2) / 15));
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || coordinates.length === 0) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [coordinates[0].lng, coordinates[0].lat],
      zoom: 10,
    });

    mapRef.current = map;

    map.on("load", () => {
      const colorGroups: Record<string, GeoJSON.Feature<GeoJSON.LineString>[]> =
        { tailwind: [], crosswind: [], headwind: [] };

      segmentColors.forEach((seg) => {
        colorGroups[seg.color].push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [seg.from.lng, seg.from.lat],
              [seg.to.lng, seg.to.lat],
            ],
          },
        });
      });

      (Object.entries(colorGroups) as [keyof typeof SEGMENT_COLORS, GeoJSON.Feature<GeoJSON.LineString>[]][]).forEach(
        ([color, features]) => {
          if (features.length === 0) return;

          map.addSource(`route-${color}`, {
            type: "geojson",
            data: { type: "FeatureCollection", features },
          });

          map.addLayer({
            id: `route-${color}`,
            type: "line",
            source: `route-${color}`,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": SEGMENT_COLORS[color],
              "line-width": 4,
              "line-opacity": colorOpacity,
            },
          });
        }
      );

      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((c) => bounds.extend([c.lng, c.lat]));
      map.fitBounds(bounds, { padding: 50 });

      // Start marker
      new mapboxgl.Marker({ color: "#000" })
        .setLngLat([coordinates[0].lng, coordinates[0].lat])
        .addTo(map);

      // Wind flow arrow — shows direction wind is BLOWING TOWARD
      const windTowardDeg = (windDirectionDeg + 180) % 360;
      const windEl = document.createElement("div");
      windEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
        <svg viewBox="0 0 60 24" width="60" height="24" style="transform: rotate(${windTowardDeg - 90}deg)">
          <line x1="4" y1="12" x2="44" y2="12" stroke="#555" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M40 6 L52 12 L40 18" fill="none" stroke="#555" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span style="font-size:10px;color:#666;background:rgba(255,255,255,0.9);padding:1px 4px;border-radius:3px;">Wind</span>
      </div>`;
      new mapboxgl.Marker({ element: windEl, anchor: "center" })
        .setLngLat([bounds.getCenter().lng, bounds.getNorthEast().lat])
        .addTo(map);
    });

    return () => {
      map.remove();
    };
  }, [coordinates, segmentColors, windDirectionDeg, windSpeedMph, colorOpacity]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-[50vh] sm:h-[60vh] rounded-lg overflow-hidden border border-border"
      />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-md border border-border px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 rounded" style={{ backgroundColor: SEGMENT_COLORS.tailwind }} />
          <span>Tailwind</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 rounded" style={{ backgroundColor: SEGMENT_COLORS.crosswind }} />
          <span>Crosswind</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 rounded" style={{ backgroundColor: SEGMENT_COLORS.headwind }} />
          <span>Headwind</span>
        </div>
      </div>
    </div>
  );
}
