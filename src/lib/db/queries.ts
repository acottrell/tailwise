import { db } from "./index";
import { routes, weeklyRides, weeklyAnnouncements } from "./schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { Coordinate, ParsedRoute, RouteType } from "@/lib/types";

export type RouteRow = typeof routes.$inferSelect;

export function dbRowToParsedRoute(row: RouteRow): ParsedRoute {
  return {
    coordinates: row.coordinates as Coordinate[],
    totalDistanceKm: row.distanceKm,
    routeType: row.routeType as RouteType,
    isClockwise: row.isClockwise,
    midpointIndex: row.midpointIndex,
    outboundBearing: row.outboundBearing,
    homewardBearing: row.homewardBearing,
    name: row.name,
  };
}

export async function findApprovedRoutes(
  minKm?: number,
  maxKm?: number
): Promise<RouteRow[]> {
  const conditions = [eq(routes.status, "approved")];
  if (minKm != null) conditions.push(gte(routes.distanceKm, minKm));
  if (maxKm != null) conditions.push(lte(routes.distanceKm, maxKm));

  return db.select().from(routes).where(and(...conditions));
}

export async function findRouteById(id: string): Promise<RouteRow | undefined> {
  const rows = await db
    .select()
    .from(routes)
    .where(eq(routes.id, id))
    .limit(1);
  return rows[0];
}

export async function routeExistsByStravaId(
  stravaRouteId: bigint
): Promise<boolean> {
  const rows = await db
    .select({ id: routes.id })
    .from(routes)
    .where(eq(routes.stravaRouteId, stravaRouteId))
    .limit(1);
  return rows.length > 0;
}

export async function insertRoute(
  row: typeof routes.$inferInsert
): Promise<void> {
  await db.insert(routes).values(row);
}

export async function approveRoute(id: string): Promise<void> {
  await db
    .update(routes)
    .set({ status: "approved" })
    .where(eq(routes.id, id));
}

export async function deleteRoute(id: string): Promise<void> {
  await db.delete(routes).where(eq(routes.id, id));
}

export async function findPendingRoutes(): Promise<RouteRow[]> {
  return db
    .select()
    .from(routes)
    .where(eq(routes.status, "pending"))
    .orderBy(routes.createdAt);
}

// --- Weekly rides (LBRCC club page) ---

export type WeeklyRideRow = typeof weeklyRides.$inferSelect;
export type WeeklyAnnouncementRow = typeof weeklyAnnouncements.$inferSelect;

export async function findWeeklyRides(
  fromDate: string,
  toDate: string
): Promise<(WeeklyRideRow & { route: RouteRow })[]> {
  const rows = await db
    .select()
    .from(weeklyRides)
    .innerJoin(routes, eq(weeklyRides.routeId, routes.id))
    .where(
      and(
        gte(weeklyRides.rideDate, fromDate),
        lte(weeklyRides.rideDate, toDate)
      )
    )
    .orderBy(weeklyRides.rideDate, weeklyRides.groupName);

  return rows.map((r) => ({ ...r.weekly_rides, route: r.routes }));
}

export async function findWeeklyAnnouncements(
  fromDate: string,
  toDate: string
): Promise<(WeeklyAnnouncementRow & { route: RouteRow | null })[]> {
  const rows = await db
    .select()
    .from(weeklyAnnouncements)
    .leftJoin(routes, eq(weeklyAnnouncements.routeId, routes.id))
    .where(
      and(
        gte(weeklyAnnouncements.weekStart, fromDate),
        lte(weeklyAnnouncements.weekStart, toDate)
      )
    )
    .orderBy(weeklyAnnouncements.weekStart);

  return rows.map((r) => ({
    ...r.weekly_announcements,
    route: r.routes,
  }));
}

export async function insertWeeklyRide(
  row: typeof weeklyRides.$inferInsert
): Promise<void> {
  await db.insert(weeklyRides).values(row);
}

export async function insertWeeklyAnnouncement(
  row: typeof weeklyAnnouncements.$inferInsert
): Promise<void> {
  await db.insert(weeklyAnnouncements).values(row);
}

export async function deleteWeeklyRide(id: string): Promise<void> {
  await db.delete(weeklyRides).where(eq(weeklyRides.id, id));
}

export async function deleteWeeklyAnnouncement(id: string): Promise<void> {
  await db
    .delete(weeklyAnnouncements)
    .where(eq(weeklyAnnouncements.id, id));
}

export async function searchRoutes(query: string): Promise<RouteRow[]> {
  return db
    .select()
    .from(routes)
    .where(
      and(
        eq(routes.status, "approved"),
        sql`(${routes.name} ILIKE ${"%" + query + "%"} OR ${routes.destination} ILIKE ${"%" + query + "%"} OR ${routes.cafeStop} ILIKE ${"%" + query + "%"})`
      )
    )
    .limit(20);
}
