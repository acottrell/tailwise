import {
  pgTable,
  text,
  real,
  boolean,
  integer,
  jsonb,
  timestamp,
  bigint,
  date,
} from "drizzle-orm/pg-core";

export const routes = pgTable("routes", {
  id: text("id").primaryKey(),
  stravaRouteId: bigint("strava_route_id", { mode: "bigint" }).unique(),
  name: text("name").notNull(),
  destination: text("destination"),
  cafeStop: text("cafe_stop"),
  distanceKm: real("distance_km").notNull(),
  elevationGainM: real("elevation_gain_m"),
  routeType: text("route_type").notNull(), // 'loop' | 'out-and-back' | 'point-to-point'
  isClockwise: boolean("is_clockwise").notNull(),
  centroidLat: real("centroid_lat").notNull(),
  centroidLng: real("centroid_lng").notNull(),
  midpointIndex: integer("midpoint_index").notNull(),
  outboundBearing: real("outbound_bearing").notNull(),
  homewardBearing: real("homeward_bearing").notNull(),
  startLat: real("start_lat").notNull(),
  startLng: real("start_lng").notNull(),
  coordinates: jsonb("coordinates").notNull(), // Coordinate[]
  polyline: text("polyline"),
  optimalWindDirs: jsonb("optimal_wind_dirs"), // string[] e.g. ["N","NE"]
  sourceName: text("source_name").notNull().default("Community"),
  sourceUrl: text("source_url"),
  eventName: text("event_name"),
  eventDate: text("event_date"), // ISO date string e.g. "2026-04-12"
  eventUrl: text("event_url"),
  status: text("status").notNull().default("approved"), // 'approved' | 'pending'
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeklyRides = pgTable("weekly_rides", {
  id: text("id").primaryKey(),
  groupName: text("group_name").notNull(), // "G1", "G2", "G3", "All"
  routeId: text("route_id")
    .references(() => routes.id)
    .notNull(),
  rideDate: date("ride_date").notNull(),
  departureTime: text("departure_time"), // "08:30"
  meetingPoint: text("meeting_point"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeklyAnnouncements = pgTable("weekly_announcements", {
  id: text("id").primaryKey(),
  weekStart: date("week_start").notNull(), // Monday of the applicable week
  title: text("title").notNull(),
  body: text("body"),
  routeId: text("route_id").references(() => routes.id), // optional, for event rides
  createdAt: timestamp("created_at").defaultNow(),
});

export const cafeHours = pgTable("cafe_hours", {
  routeId: text("route_id")
    .references(() => routes.id)
    .unique()
    .notNull(),
  placeId: text("place_id"),
  rating: real("rating"),
  hoursJson: jsonb("hours_json"),
  fetchedAt: timestamp("fetched_at"),
});
