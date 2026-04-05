import { Coordinate, StravaRoute } from "./types";

// A ~80km loop route around Hertfordshire:
// Wheathampstead -> Luton -> Dunstable -> Tring -> Hemel Hempstead -> St Albans -> Wheathampstead
// Coordinates approximate a realistic cycling loop
const DEMO_COORDINATES: Coordinate[] = [
  // Start: Wheathampstead
  { lat: 51.8130, lng: -0.2890 },
  { lat: 51.8150, lng: -0.2950 },
  { lat: 51.8200, lng: -0.3050 },
  // Heading NW toward Harpenden
  { lat: 51.8250, lng: -0.3150 },
  { lat: 51.8310, lng: -0.3250 },
  { lat: 51.8370, lng: -0.3380 },
  // Through Harpenden
  { lat: 51.8420, lng: -0.3500 },
  { lat: 51.8480, lng: -0.3620 },
  // North toward Luton
  { lat: 51.8560, lng: -0.3700 },
  { lat: 51.8650, lng: -0.3800 },
  { lat: 51.8750, lng: -0.3900 },
  { lat: 51.8850, lng: -0.4000 },
  { lat: 51.8950, lng: -0.4050 },
  // Approaching Luton from south
  { lat: 51.9050, lng: -0.4100 },
  { lat: 51.9120, lng: -0.4150 },
  { lat: 51.9180, lng: -0.4200 },
  // West of Luton heading toward Dunstable
  { lat: 51.9200, lng: -0.4350 },
  { lat: 51.9180, lng: -0.4500 },
  { lat: 51.9150, lng: -0.4650 },
  { lat: 51.9100, lng: -0.4800 },
  // Dunstable area
  { lat: 51.8950, lng: -0.5000 },
  { lat: 51.8850, lng: -0.5150 },
  { lat: 51.8750, lng: -0.5300 },
  // South toward Tring through the Chilterns
  { lat: 51.8600, lng: -0.5450 },
  { lat: 51.8450, lng: -0.5550 },
  { lat: 51.8300, lng: -0.5600 },
  // Tring area
  { lat: 51.8150, lng: -0.5650 },
  { lat: 51.8000, lng: -0.5600 },
  // Southeast toward Berkhamsted / Hemel
  { lat: 51.7900, lng: -0.5450 },
  { lat: 51.7850, lng: -0.5250 },
  { lat: 51.7800, lng: -0.5050 },
  { lat: 51.7750, lng: -0.4850 },
  // Hemel Hempstead area
  { lat: 51.7700, lng: -0.4650 },
  { lat: 51.7680, lng: -0.4450 },
  { lat: 51.7700, lng: -0.4250 },
  // East toward St Albans
  { lat: 51.7750, lng: -0.4050 },
  { lat: 51.7800, lng: -0.3850 },
  { lat: 51.7850, lng: -0.3650 },
  { lat: 51.7900, lng: -0.3450 },
  // Through St Albans
  { lat: 51.7950, lng: -0.3300 },
  { lat: 51.8000, lng: -0.3150 },
  { lat: 51.8050, lng: -0.3000 },
  // Back to Wheathampstead
  { lat: 51.8080, lng: -0.2950 },
  { lat: 51.8100, lng: -0.2910 },
  { lat: 51.8130, lng: -0.2890 },
];

export const DEMO_STRAVA_ROUTE: StravaRoute = {
  id: 0,
  name: "Brewhouse Wheathampstead",
  distance: 79760,
  elevationGain: 794,
  polyline: "",
};

export function getDemoCoordinates(): Coordinate[] {
  return DEMO_COORDINATES;
}
