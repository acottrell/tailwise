"use client";

import { WeatherData } from "@/lib/types";
import { compassDirection } from "@/lib/geo-utils";

interface RideInfoProps {
  weather: WeatherData;
  distanceMeters?: number;
  elevationGainMeters?: number;
}

function getKitAdvice(weather: WeatherData): { label: string; detail: string } {
  const feelsLike = weather.apparentTemperatureCelsius;
  const temp = weather.temperatureCelsius;
  const wind = weather.windSpeedMph;
  const humidity = weather.relativeHumidity;
  const warming = weather.warmingTrend;
  const longRide = weather.rideDurationHours >= 2.5;

  // Effective temperature: what it'll feel like on the bike factoring in
  // warming trend (long rides warm up mid-ride) and humidity (humid air
  // feels warmer, sweat doesn't evaporate as well)
  let effective = feelsLike;
  if (longRide && warming > 3) effective += 1.5;
  else if (longRide && warming > 1) effective += 0.5;
  if (humidity > 75 && temp > 12) effective += 1;

  if (effective >= 19) return { label: "Shorts & jersey", detail: "Summer kit" };
  if (effective >= 15) {
    if (wind <= 10) return { label: "Shorts & jersey", detail: "Light layers if starting early" };
    return { label: "Shorts & arm warmers", detail: "Comfortable but breezy" };
  }
  if (effective >= 11) {
    if (longRide && warming > 2) return { label: "Shorts & arm warmers", detail: "Cool start, warming up" };
    return { label: "Bib tights & long sleeve", detail: "Layer up, cool ride" };
  }
  if (effective >= 5) return { label: "Bib tights & long sleeve", detail: "Cold one — winter base layer" };
  if (effective >= 0) return { label: "Full winter kit", detail: "Bib tights, winter jacket, gloves" };
  return { label: "Stay indoors?", detail: "Sub-zero. Think twice" };
}

function getRainAdvice(precipProb: number): { label: string; detail: string } {
  if (precipProb <= 10) return { label: "Dry", detail: "No rain expected" };
  if (precipProb <= 30) return { label: "Unlikely", detail: "Probably staying dry" };
  if (precipProb <= 60) return { label: "Possible", detail: "Pack a gilet" };
  if (precipProb <= 80) return { label: "Likely", detail: "Mudguards & rain jacket" };
  return { label: "Wet ride", detail: "Full waterproofs recommended" };
}

function InfoRow({
  icon,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary/70">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-sm font-medium">{value}</span>
        </div>
        {detail && (
          <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}

export function RideInfo({ weather, distanceMeters, elevationGainMeters }: RideInfoProps) {
  const windDir = compassDirection(weather.windDirectionDeg);
  const temp = Math.round(weather.temperatureCelsius);
  const kit = getKitAdvice(weather);
  const rain = getRainAdvice(weather.precipitationProbability);

  const distanceMiles = distanceMeters ? (distanceMeters / 1609.344).toFixed(1) : null;
  const distanceKm = distanceMeters ? (distanceMeters / 1000).toFixed(0) : null;
  const elevationFeet = elevationGainMeters ? Math.round(elevationGainMeters * 3.28084) : null;
  const elevationMeters = elevationGainMeters ? Math.round(elevationGainMeters) : null;

  // Estimate ride time at 17mph (27.4km/h)
  const rideHours = distanceMeters ? (distanceMeters / 1609.344) / 16 : null;
  const rideTimeLabel = rideHours
    ? rideHours >= 1
      ? `~${Math.floor(rideHours)}h ${Math.round((rideHours % 1) * 60)}min`
      : `~${Math.round(rideHours * 60)}min`
    : null;

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border">
      {/* Route stats */}
      {distanceMiles && (
        <InfoRow
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M8 6h10v10" />
            </svg>
          }
          title="Distance"
          value={`${distanceMiles} mi (${distanceKm} km)`}
          detail={rideTimeLabel ? `Estimated ${rideTimeLabel} at ~16 mph avg` : undefined}
        />
      )}
      {elevationFeet != null && (
        <InfoRow
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v2M12 3v2M16 3v2M3 10l4-4 4 6 4-4 6 6" />
            </svg>
          }
          title="Elevation"
          value={`${elevationFeet.toLocaleString()} ft (${elevationMeters} m)`}
        />
      )}

      {/* Weather */}
      <InfoRow
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.7 7.7a7.5 7.5 0 1 0-5.4 12.8" />
            <path d="M14 14l3 3-3 3" />
            <path d="M21 17H14" />
          </svg>
        }
        title="Wind"
        value={`${windDir} ${Math.round(weather.windSpeedMph)} mph`}
      />
      <InfoRow
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
          </svg>
        }
        title="Temperature"
        value={`${temp}°C`}
      />
      <InfoRow
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M16 14v6M8 14v6M12 16v6" />
          </svg>
        }
        title="Rain"
        value={`${weather.precipitationProbability}%, ${rain.label}`}
        detail={rain.detail}
      />

      {/* Kit advice */}
      <InfoRow
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.38 3.46L16 2 12 3.5 8 2 3.62 3.46a1 1 0 0 0-.62.94V20a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4.4a1 1 0 0 0-.62-.94Z" />
            <path d="M12 3.5V21" />
          </svg>
        }
        title="Kit"
        value={kit.label}
        detail={kit.detail}
      />
    </div>
  );
}
