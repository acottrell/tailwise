CREATE TABLE "cafe_hours" (
	"route_id" text NOT NULL,
	"place_id" text,
	"rating" real,
	"hours_json" jsonb,
	"fetched_at" timestamp,
	CONSTRAINT "cafe_hours_route_id_unique" UNIQUE("route_id")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" text PRIMARY KEY NOT NULL,
	"strava_route_id" bigint,
	"name" text NOT NULL,
	"destination" text,
	"cafe_stop" text,
	"distance_km" real NOT NULL,
	"elevation_gain_m" real,
	"route_type" text NOT NULL,
	"is_clockwise" boolean NOT NULL,
	"centroid_lat" real NOT NULL,
	"centroid_lng" real NOT NULL,
	"midpoint_index" integer NOT NULL,
	"outbound_bearing" real NOT NULL,
	"homeward_bearing" real NOT NULL,
	"start_lat" real NOT NULL,
	"start_lng" real NOT NULL,
	"coordinates" jsonb NOT NULL,
	"polyline" text,
	"optimal_wind_dirs" jsonb,
	"source_name" text DEFAULT 'Community' NOT NULL,
	"source_url" text,
	"event_name" text,
	"event_date" text,
	"event_url" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "routes_strava_route_id_unique" UNIQUE("strava_route_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"url" text,
	"route_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weekly_rides" (
	"id" text PRIMARY KEY NOT NULL,
	"group_name" text NOT NULL,
	"route_id" text NOT NULL,
	"ride_date" date NOT NULL,
	"departure_time" text,
	"meeting_point" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cafe_hours" ADD CONSTRAINT "cafe_hours_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_announcements" ADD CONSTRAINT "weekly_announcements_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_rides" ADD CONSTRAINT "weekly_rides_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;