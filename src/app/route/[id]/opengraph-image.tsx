import { ImageResponse } from "next/og";
import { OUTFIT_FONT_BASE64 } from "@/assets/fonts/outfit-data";
import { findRouteById, dbRowToParsedRoute } from "@/lib/db/queries";
import { fetchWeatherServer } from "@/lib/weather-server";
import { getWeatherForWindow, estimateRideDuration } from "@/lib/weather-client";
import { getRecommendation } from "@/lib/wind-advisor";
import { compassDirection } from "@/lib/geo-utils";

export const alt = "Route on Tailwise";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f7f3ee";
const BROWN_DARK = "#2a2318";
const BROWN_MUTED = "#8a7d6f";
const BORDER = "#ddd7cd";
const WIND_GREEN = "#3d8c50";

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fontData = base64ToArrayBuffer(OUTFIT_FONT_BASE64);

  let routeName = "Cycling Route";
  let distance = "";
  let elevation = "";
  let windInfo = "";
  let tailwindInfo = "";
  let temp = "";

  try {
    const route = await findRouteById(id);
    if (route) {
      routeName = route.cafeStop || route.destination || route.name;
      const miles = Math.round(route.distanceKm / 1.609344);
      distance = `${miles} mi`;
      if (route.elevationGainM) {
        elevation = `${Math.round(route.elevationGainM * 3.28084).toLocaleString()} ft`;
      }

      try {
        const { hourly, sunTimes } = await fetchWeatherServer(
          route.centroidLat,
          route.centroidLng,
          2
        );
        const parsed = dbRowToParsedRoute(route);
        const dur = estimateRideDuration(route.distanceKm);
        const weather = getWeatherForWindow(hourly, sunTimes, new Date(), dur);
        const rec = getRecommendation(parsed, weather);

        windInfo = `${compassDirection(weather.windDirectionDeg)} ${Math.round(weather.windSpeedMph)} mph`;
        temp = `${Math.round(weather.temperatureCelsius)}°C`;

        if (rec.tailwindAdvantage >= 2) {
          const dir = rec.direction === "reverse" ? "in reverse" : "as planned";
          tailwindInfo = `${rec.tailwindAdvantage} mph tailwind ${dir}`;
        }
      } catch {
        // Weather unavailable
      }
    }
  } catch {
    // Route not found
  }

  const statParts = [distance, elevation, temp].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: CREAM,
          fontFamily: "Outfit",
          padding: "72px 88px",
          position: "relative",
        }}
      >
        {/* Top rule */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 88,
            right: 88,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        {/* Bottom rule */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 88,
            right: 88,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        {/* Brand mark */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: BROWN_MUTED,
            letterSpacing: "0.08em",
            marginBottom: 48,
          }}
        >
          Tailwise
        </div>

        {/* Route name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 600,
            color: BROWN_DARK,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            marginBottom: 24,
            maxWidth: 900,
          }}
        >
          {routeName}
        </div>

        {/* Stats row */}
        {statParts.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: tailwindInfo ? 20 : 0,
            }}
          >
            {statParts.map((stat, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && (
                  <div
                    style={{
                      width: 1,
                      height: 16,
                      backgroundColor: BORDER,
                      marginLeft: 20,
                      marginRight: 20,
                    }}
                  />
                )}
                <div
                  style={{
                    fontSize: 22,
                    color: BROWN_MUTED,
                  }}
                >
                  {stat}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tailwind callout */}
        {tailwindInfo && (
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: WIND_GREEN,
            }}
          >
            {tailwindInfo}
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Outfit", data: fontData, weight: 600 as const },
      ],
    },
  );
}
