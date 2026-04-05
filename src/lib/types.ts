export interface Coordinate {
  lat: number;
  lng: number;
}

export type RouteType = "loop" | "out-and-back" | "point-to-point";

export interface ParsedRoute {
  coordinates: Coordinate[];
  totalDistanceKm: number;
  routeType: RouteType;
  isClockwise: boolean;
  midpointIndex: number;
  outboundBearing: number;
  homewardBearing: number;
  name?: string;
}

export interface SegmentColor {
  from: Coordinate;
  to: Coordinate;
  color: "tailwind" | "crosswind" | "headwind";
  tailwindComponent: number;
}

export interface HourlyWeather {
  time: string;
  windSpeedMph: number;
  windDirectionDeg: number;
  precipitationProbability: number;
  temperatureCelsius: number;
}

export interface SunTimes {
  date: string;
  sunrise: string;
  sunset: string;
}

export interface WeatherData {
  windSpeedMph: number;
  windDirectionDeg: number;
  precipitationProbability: number;
  temperatureCelsius: number;
  hourly: HourlyWeather[];
  sunTimes: SunTimes[];
}

export type ConfidenceLevel = "low" | "moderate" | "strong";

export interface Recommendation {
  direction: "as-planned" | "reverse";
  confidence: ConfidenceLevel;
  tailwindAdvantage: number;
  homewardTailwindMph: number;
  message: string;
}

export interface RideWindow {
  time: string;
  hour: number;
  score: number;
  direction: "as-planned" | "reverse";
  windSpeedMph: number;
  windDirectionDeg: number;
  precipitationProbability: number;
  temperatureCelsius: number;
  isBest: boolean;
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface StravaRoute {
  id: number;
  name: string;
  distance: number;
  elevationGain: number;
  polyline: string;
}

export type AppStage =
  | { stage: "connect" }
  | { stage: "input"; }
  | { stage: "analyzing"; routeUrl: string }
  | {
      stage: "results";
      route: ParsedRoute;
      weather: WeatherData;
      recommendation: Recommendation;
      segmentColors: SegmentColor[];
      rideWindows: RideWindow[];
      stravaRoute: StravaRoute;
    }
  | { stage: "error"; message: string };
