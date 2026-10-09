"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Coordinate, SegmentColor } from "@/lib/types";
import { SEGMENT_COLORS } from "@/lib/segment-colorizer";
import { CafePosition, formatPosition } from "@/components/cafe-info";

interface CafeStop {
  name: string;
  lat?: number | null;
  lng?: number | null;
  position?: CafePosition | null;
}

interface RouteMapProps {
  coordinates: Coordinate[];
  segmentColors: SegmentColor[];
  windDirectionDeg: number;
  windSpeedMph: number;
  cafeStop?: string | null;
  cafeLat?: number | null;
  cafeLng?: number | null;
  cafePosition?: CafePosition | null;
  cafeStops?: CafeStop[] | null;
  /** Needed for the "Mile X of Y" line in the cafe tap card. */
  totalDistanceKm?: number;
}

// Coffee-cup pin with the cafe name beneath. The name is user-submitted, so
// it goes in via textContent, never innerHTML. The badge sits in a padded
// 44px wrapper (negative margin keeps the layout) so it's tappable with
// cold fingers or gloves.
function cafePinElement(name: string) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer";
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${name} — cafe details`);
  el.innerHTML = `
    <div style="padding:9px;margin:-9px">
    <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#18181b;box-shadow:0 1px 4px rgba(0,0,0,.45);border:2px solid #fff">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
        <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
      </svg>
    </div>
    </div>
    <div style="width:2px;height:6px;background:#18181b"></div>`;
  const label = document.createElement("span");
  label.style.cssText =
    "margin-top:2px;font:600 10px/1.2 ui-monospace,monospace;color:#18181b;background:rgba(255,255,255,.9);padding:2px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3)";
  label.dataset.cafeLabel = "";
  label.textContent = name;
  el.appendChild(label);
  return el;
}

// Tap card: where the stop falls on the ride, plus the only way out of the
// app — a deliberate second tap. The name isn't repeated; it's on the pin.
function cafePopupContent(
  cafe: CafeStop,
  lat: number,
  lng: number,
  totalDistanceKm: number | undefined,
  onClose: () => void
) {
  // Dark ink, like the badge: the pin's name tag opening into a card. Dark on
  // the pale basemap also holds its edge in bright sunshine better than white.
  // Colours are explicit so the site's dark theme can't leak in.
  const el = document.createElement("div");
  el.style.cssText =
    "width:208px;background:#18181b;color:#fafafa;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.3);overflow:hidden";

  const head = document.createElement("div");
  head.style.cssText = "position:relative;padding:10px 40px 9px 12px";
  const name = document.createElement("p");
  name.style.cssText = "margin:0;font:600 12px/1.3 ui-monospace,monospace;color:#fafafa";
  name.textContent = cafe.name;
  head.appendChild(name);
  if (cafe.position && totalDistanceKm) {
    const where = document.createElement("p");
    where.style.cssText = "margin:3px 0 0;font-size:12px;line-height:1.3;color:#a1a1aa";
    where.textContent = formatPosition(cafe.position, totalDistanceKm);
    head.appendChild(where);
  }
  // Tapping the map also closes the card, but nothing says so — the X makes
  // it obvious. 40px hit area, small glyph, so it doesn't dominate the card.
  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.style.cssText =
    "position:absolute;top:0;right:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:none;border:0;padding:0;cursor:pointer";
  close.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });
  head.appendChild(close);
  el.appendChild(head);

  const link = document.createElement("a");
  link.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:0 12px;border-top:1px solid rgba(255,255,255,.12);font-size:13px;font-weight:500;color:#fafafa;text-decoration:none";
  link.href = `https://www.google.com/maps/search/${encodeURIComponent(cafe.name)}/@${lat},${lng},17z`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open in Google Maps";
  link.insertAdjacentHTML(
    "beforeend",
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
  );
  el.appendChild(link);
  return el;
}

// The pin is anchored at the bottom of its name tag, ~52px below the top of
// the badge. Above: clear the badge by 6px. Below: sit just under the point.
const CAFE_POPUP_OFFSET: mapboxgl.PopupOptions["offset"] = {
  bottom: [0, -58],
  "bottom-left": [0, -58],
  "bottom-right": [0, -58],
  top: [0, 6],
  "top-left": [0, 6],
  "top-right": [0, 6],
  left: [18, -38],
  right: [-18, -38],
};

// Strip Mapbox's white popup chrome so our card is the whole visual.
function stripPopupChrome(popup: mapboxgl.Popup) {
  const root = popup.getElement();
  if (!root) return;
  const content = root.querySelector<HTMLElement>(".mapboxgl-popup-content");
  if (content) content.style.cssText = "background:transparent;padding:0;box-shadow:none;border-radius:0";
  const tip = root.querySelector<HTMLElement>(".mapboxgl-popup-tip");
  if (tip) tip.style.display = "none";
}

export function RouteMap({
  coordinates,
  segmentColors,
  windDirectionDeg,
  windSpeedMph,
  cafeStop,
  cafeLat,
  cafeLng,
  cafePosition,
  cafeStops,
  totalDistanceKm,
}: RouteMapProps) {
  // Soften the route a little on light-wind days: 75% at ≤2mph up to 100% at
  // ≥17mph. Kept high because streets-v12 is a busy basemap — a fainter line
  // gets lost among the roads, especially in bright sunshine.
  const windStrength = Math.min(1, Math.max(0, (windSpeedMph - 2) / 15));
  const colorOpacity = 0.75 + windStrength * 0.25;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || coordinates.length === 0) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
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

      // Cafe pins — only for stops that were geocoded. Prefer the multi-cafe
      // list; fall back to the single-cafe fields, as CafeInfo does.
      const cafes: CafeStop[] =
        cafeStops && cafeStops.length > 0
          ? cafeStops
          : cafeStop
            ? [{ name: cafeStop, lat: cafeLat, lng: cafeLng, position: cafePosition }]
            : [];
      for (const cafe of cafes) {
        if (cafe.lat == null || cafe.lng == null) continue;
        // Tapping the pin toggles the card; tapping the map closes it. Mapbox
        // keeps only one open at a time via closeOnClick.
        const popup = new mapboxgl.Popup({
          closeButton: false,
          offset: CAFE_POPUP_OFFSET,
          maxWidth: "none",
          focusAfterOpen: false,
        });
        popup.setDOMContent(
          cafePopupContent(cafe, cafe.lat, cafe.lng, totalDistanceKm, () => popup.remove())
        );
        const pinEl = cafePinElement(cafe.name);
        // The card carries the name while open, so hide the tag underneath.
        // visibility (not display) keeps the pin's anchor point fixed.
        const tag = pinEl.querySelector<HTMLElement>("[data-cafe-label]");
        popup.on("open", () => {
          stripPopupChrome(popup);
          if (tag) tag.style.visibility = "hidden";
        });
        popup.on("close", () => {
          if (tag) tag.style.visibility = "";
        });
        new mapboxgl.Marker({ element: pinEl, anchor: "bottom" })
          .setLngLat([cafe.lng, cafe.lat])
          .setPopup(popup)
          .addTo(map);
      }

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
  }, [coordinates, segmentColors, windDirectionDeg, windSpeedMph, colorOpacity, cafeStop, cafeLat, cafeLng, cafePosition, cafeStops, totalDistanceKm]);

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
