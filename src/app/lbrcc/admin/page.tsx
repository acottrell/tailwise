"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Recommendation } from "@/lib/types";

interface RouteRec {
  id: string;
  name: string;
  destination: string | null;
  cafeStop: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  routeType: string;
  stravaRouteId: string | null;
  recommendation: Recommendation;
}

interface WeeklyRide {
  id: string;
  groupName: string;
  rideDate: string;
  departureTime: string | null;
  meetingPoint: string | null;
  notes: string | null;
  route: {
    id: string;
    name: string;
    destination: string | null;
    cafeStop: string | null;
    distanceKm: number;
    elevationGainM: number | null;
    stravaRouteId: string | null;
  };
}

interface WeeklyAnnouncement {
  id: string;
  weekStart: string;
  title: string;
  body: string | null;
  url: string | null;
}

export default function LbrccAdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const cookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("lbrcc_admin="));
    if (cookie) setAuthed(true);
  }, []);

  const handleLogin = useCallback(() => {
    document.cookie = `lbrcc_admin=${password}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict`;
    fetch("/api/lbrcc/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then((r) => {
      if (r.status === 401) {
        setAuthError(true);
        document.cookie = "lbrcc_admin=; path=/; max-age=0; SameSite=Strict";
      } else {
        setAuthed(true);
        setAuthError(false);
      }
    });
  }, [password]);

  if (!authed) {
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-lg font-semibold text-center">LBRCC Admin</h1>
          <div className="space-y-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Password"
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            {authError && (
              <p className="text-sm text-center text-red-500">Wrong password</p>
            )}
            <Button onClick={handleLogin} className="w-full">
              Log in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}

// --- Helpers ---

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function degToCompass(deg: number): string {
  const index = Math.round(deg / 45) % 8;
  return COMPASS_POINTS[index];
}

interface RidePreset {
  label: string;
  date: Date;
  time: string;
}

function getUpcomingPresets(): RidePreset[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const presets: RidePreset[] = [];

  // Next Sunday (or today if Sunday)
  const sunDiff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + sunDiff);
  presets.push({ label: "Sunday", date: sunday, time: "08:30" });

  // Next Wednesday (frisky)
  const wedDiff = ((3 - day) + 7) % 7 || 7; // days until next Wed (always future)
  const wednesday = new Date(now);
  // If today is Wednesday and it's before 6pm, use today
  if (day === 3 && now.getHours() < 18) {
    wednesday.setDate(now.getDate());
  } else {
    wednesday.setDate(now.getDate() + wedDiff);
  }
  // Frisky time: 6pm Apr–May, 6:30pm Jun–Aug
  const month = wednesday.getMonth(); // 0-indexed
  const friskyTime = month >= 5 && month <= 7 ? "18:30" : "18:00";
  presets.push({ label: "Frisky", date: wednesday, time: friskyTime });

  return presets;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// --- Main Dashboard ---

function AdminDashboard() {
  const presets = getUpcomingPresets();
  const [rideDate, setRideDate] = useState(toDateStr(presets[0].date));
  const [departureTime, setDepartureTime] = useState(presets[0].time);
  const [activePreset, setActivePreset] = useState<string>("Sunday");

  // Distance filter
  type DistanceFilter = "all" | "short" | "medium" | "long" | "long+";
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("all");

  const distanceRanges: Record<DistanceFilter, { min?: number; max?: number; label: string }> = {
    all: { label: "All" },
    short: { max: 50, label: "Short" },
    medium: { min: 50, max: 85, label: "Medium" },
    long: { min: 85, max: 130, label: "Long" },
    "long+": { min: 130, label: "Long+" },
  };

  // Recommended routes for the selected date
  const [routes, setRoutes] = useState<RouteRec[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [weather, setWeather] = useState<{
    windSpeedMph: number;
    windDirectionDeg: number;
  } | null>(null);

  // Group assignments: routeId -> set of groups
  const [assignments, setAssignments] = useState<Map<string, Set<string>>>(
    new Map()
  );
  // Notes per assignment: routeId -> notes text
  const [assignmentNotes, setAssignmentNotes] = useState<Map<string, string>>(
    new Map()
  );

  // Strava URL paste
  const [stravaUrl, setStravaUrl] = useState("");
  const [stravaCafe, setStravaCafe] = useState("");
  const [stravaDestination, setStravaDestination] = useState("");
  const [stravaLoading, setStravaLoading] = useState(false);
  const [stravaError, setStravaError] = useState<string | null>(null);

  // Posted rides
  const [postedRides, setPostedRides] = useState<WeeklyRide[]>([]);
  const [postedAnnouncements, setPostedAnnouncements] = useState<WeeklyAnnouncement[]>([]);
  const [loadingPosted, setLoadingPosted] = useState(true);

  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Combined message (replaces separate announcement form)
  const [postMessage, setPostMessage] = useState("");
  const [postMessageUrl, setPostMessageUrl] = useState("");

  // Search + Strava URL fallback
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RouteRec[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch recommended routes for the date
  const fetchRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const departure = new Date(`${rideDate}T${departureTime}:00`);
      const range = distanceRanges[distanceFilter];
      let url = `/api/routes/recommend?departureTime=${departure.toISOString()}&limit=20`;
      if (range.min != null) url += `&minDistanceKm=${range.min}`;
      if (range.max != null) url += `&maxDistanceKm=${range.max}`;
      const res = await fetch(url);
      const data = await res.json();
      setRoutes(data.recommendations ?? []);
      setWeather(data.weather);
    } catch {
      // ignore
    } finally {
      setLoadingRoutes(false);
    }
  }, [rideDate, departureTime, distanceFilter]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // Fetch posted rides
  const fetchPosted = useCallback(async () => {
    setLoadingPosted(true);
    try {
      const res = await fetch("/api/lbrcc?weeks=2");
      const data = await res.json();
      setPostedRides(data.rides ?? []);
      setPostedAnnouncements(data.announcements ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingPosted(false);
    }
  }, []);

  useEffect(() => {
    fetchPosted();
  }, [fetchPosted]);

  // Search routes
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const departure = new Date(`${rideDate}T${departureTime}:00`);
        // Search library, then get wind preview for each
        const res = await fetch(
          `/api/routes/search?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        // Fetch preview for each result
        const withWind: RouteRec[] = await Promise.all(
          (data.routes ?? []).slice(0, 5).map(async (r: RouteRec) => {
            try {
              const pRes = await fetch(
                `/api/lbrcc/preview?routeId=${r.id}&date=${rideDate}&time=${departureTime}`
              );
              const pData = await pRes.json();
              return { ...r, recommendation: pData.recommendation };
            } catch {
              return { ...r, recommendation: null };
            }
          })
        );
        setSearchResults(withWind);
      } catch {
        // ignore
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [searchQuery, rideDate, departureTime]);

  const handleStravaAdd = useCallback(async () => {
    if (!stravaUrl.trim()) return;
    setStravaLoading(true);
    setStravaError(null);
    try {
      const res = await fetch("/api/lbrcc/add-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stravaUrl: stravaUrl.trim(),
          cafeStop: stravaCafe.trim() || undefined,
          destination: stravaDestination.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStravaError(data.error || "Failed to add route");
        return;
      }
      setStravaUrl("");
      setStravaCafe("");
      setStravaDestination("");
      fetchRoutes(); // Route now appears in the list for group assignment
    } catch {
      setStravaError("Something went wrong");
    } finally {
      setStravaLoading(false);
    }
  }, [stravaUrl, fetchRoutes]);

  const toggleGroup = useCallback(
    (routeId: string, group: string) => {
      setAssignments((prev) => {
        const next = new Map(prev);
        const groups = new Set(next.get(routeId) ?? []);
        if (groups.has(group)) {
          groups.delete(group);
        } else {
          groups.add(group);
        }
        if (groups.size === 0) {
          next.delete(routeId);
        } else {
          next.set(routeId, groups);
        }
        return next;
      });
    },
    []
  );

  const totalAssigned = Array.from(assignments.values()).reduce(
    (sum, groups) => sum + groups.size,
    0
  );

  // Compute Monday of ride date week for announcements
  const weekStartForPost = useMemo(() => {
    const d = new Date(rideDate + "T12:00:00");
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [rideDate]);

  const hasMessage = postMessage.trim().length > 0;
  const canPost = totalAssigned > 0 || hasMessage;

  const handlePost = useCallback(async () => {
    setPosting(true);
    setPostError(null);

    try {
      // Post rides
      for (const [routeId, groups] of assignments) {
        const notes = assignmentNotes.get(routeId)?.trim() || undefined;
        for (const group of groups) {
          const res = await fetch("/api/lbrcc/rides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              groupName: group,
              routeId,
              rideDate,
              departureTime,
              notes,
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to post ride");
          }
        }
      }

      // Post message as announcement if present
      if (hasMessage) {
        const res = await fetch("/api/lbrcc/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart: weekStartForPost,
            title: postMessage.trim(),
            url: postMessageUrl.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to post announcement");
        }
      }

      setAssignments(new Map());
      setAssignmentNotes(new Map());
      setPostMessage("");
      setPostMessageUrl("");
      fetchPosted();
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPosting(false);
    }
  }, [assignments, assignmentNotes, rideDate, departureTime, hasMessage, postMessage, postMessageUrl, weekStartForPost, fetchPosted]);

  const handleDeleteRide = useCallback(
    async (id: string) => {
      await fetch(`/api/lbrcc/rides?id=${id}`, { method: "DELETE" });
      fetchPosted();
    },
    [fetchPosted]
  );

  const handleDeleteAnnouncement = useCallback(
    async (id: string) => {
      await fetch(`/api/lbrcc/announcements?id=${id}`, { method: "DELETE" });
      fetchPosted();
    },
    [fetchPosted]
  );

  // Wind summary
  const windCompass = weather ? degToCompass(weather.windDirectionDeg) : null;
  const windSpeed = weather ? Math.round(weather.windSpeedMph) : null;

  // Combine recommended + search results, deduplicate
  const allRoutes = [...routes];
  for (const sr of searchResults) {
    if (!allRoutes.find((r) => r.id === sr.id)) {
      allRoutes.push(sr);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="font-semibold text-lg">LBRCC Admin</h1>
        <a
          href="/lbrcc"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View public page &rarr;
        </a>
      </header>
      <main className="flex-1">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
          {/* Step 1: Date + time */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold">Post rides</h2>
            <div className="flex items-center gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setRideDate(toDateStr(p.date));
                    setDepartureTime(p.time);
                    setActivePreset(p.label);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activePreset === p.label
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setActivePreset("Other")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activePreset === "Other"
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Other
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Date</label>
                <input
                  type="date"
                  value={rideDate}
                  onChange={(e) => {
                    setRideDate(e.target.value);
                    setActivePreset("Other");
                  }}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Depart</label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => {
                    setDepartureTime(e.target.value);
                    setActivePreset("Other");
                  }}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
            </div>
            {weather && windCompass && windSpeed != null && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3 shrink-0"
                  style={{
                    transform: `rotate(${weather.windDirectionDeg}deg)`,
                  }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
                {windCompass} {windSpeed} mph wind
              </p>
            )}
          </div>

          {/* Step 2: Route list with group toggles */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              Best routes for {formatDateShort(rideDate)}
            </h3>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(Object.keys(distanceRanges) as DistanceFilter[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setDistanceFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    distanceFilter === key
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {distanceRanges[key].label}
                </button>
              ))}
            </div>

            {loadingRoutes ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-muted animate-pulse h-20"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {allRoutes.map((route) => (
                  <RouteRow
                    key={route.id}
                    route={route}
                    assignedGroups={assignments.get(route.id) ?? new Set()}
                    onToggleGroup={(group) => toggleGroup(route.id, group)}
                    onAddCustomGroup={(group) => toggleGroup(route.id, group)}
                  />
                ))}
                {allRoutes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No routes found
                  </p>
                )}
              </div>
            )}

            {/* Can't find it? — search library + add from Strava */}
            {!showSearch ? (
              <button
                onClick={() => setShowSearch(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                More routes
              </button>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium">Search library</p>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, destination, or cafe..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  {searchLoading && (
                    <p className="text-xs text-muted-foreground">Searching...</p>
                  )}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((route) => (
                        <RouteRow
                          key={route.id}
                          route={route}
                          assignedGroups={assignments.get(route.id) ?? new Set()}
                          onToggleGroup={(group) => toggleGroup(route.id, group)}
                          onAddCustomGroup={(group) => toggleGroup(route.id, group)}
                        />
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                    <p className="text-xs text-muted-foreground">No results</p>
                  )}
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-medium">Or add from Strava</p>
                  <input
                    type="text"
                    value={stravaUrl}
                    onChange={(e) => setStravaUrl(e.target.value)}
                    placeholder="https://www.strava.com/routes/..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  {stravaUrl.trim() && (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={stravaCafe}
                          onChange={(e) => setStravaCafe(e.target.value)}
                          placeholder="Cafe stop (optional)"
                          maxLength={100}
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        />
                        <input
                          type="text"
                          value={stravaDestination}
                          onChange={(e) => setStravaDestination(e.target.value)}
                          placeholder="Destination (optional)"
                          maxLength={100}
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={handleStravaAdd}
                        disabled={stravaLoading || !stravaUrl.trim()}
                        className="w-full"
                      >
                        {stravaLoading ? "Adding..." : "Add to library"}
                      </Button>
                    </>
                  )}
                  {stravaError && (
                    <p className="text-xs text-red-500">{stravaError}</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                    setStravaUrl("");
                    setStravaCafe("");
                    setStravaDestination("");
                    setStravaError(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          {/* Post bar — always visible */}
          <div className="sticky bottom-4 bg-background border border-border rounded-lg p-3 shadow-lg space-y-3">
            {/* Ride summary */}
            {totalAssigned > 0 && (
              <div className="space-y-2">
                {Array.from(assignments.entries()).map(
                  ([routeId, groups]) => {
                    const route = allRoutes.find((r) => r.id === routeId);
                    const name =
                      route?.cafeStop || route?.destination || route?.name || "";
                    return (
                      <div key={routeId} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs">
                            {Array.from(groups).sort().join("+")}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {name}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={assignmentNotes.get(routeId) ?? ""}
                          onChange={(e) =>
                            setAssignmentNotes((prev) => {
                              const next = new Map(prev);
                              if (e.target.value) {
                                next.set(routeId, e.target.value);
                              } else {
                                next.delete(routeId);
                              }
                              return next;
                            })
                          }
                          placeholder="Notes (optional)"
                          maxLength={500}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/20"
                        />
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {/* Message — works as announcement */}
            <textarea
              value={postMessage}
              onChange={(e) => setPostMessage(e.target.value)}
              placeholder={totalAssigned > 0
                ? "Add a message (optional)"
                : "Message — e.g. No rides this week, too frosty"}
              maxLength={1000}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
            />
            {hasMessage && (
              <input
                type="url"
                value={postMessageUrl}
                onChange={(e) => setPostMessageUrl(e.target.value)}
                placeholder="Link (optional)"
                maxLength={500}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            )}

            {postError && (
              <p className="text-xs text-red-500">{postError}</p>
            )}
            <Button
              onClick={handlePost}
              disabled={posting || !canPost}
              size="sm"
              className="w-full"
            >
              {posting
                ? "Posting..."
                : totalAssigned > 0 && hasMessage
                  ? `Post ${totalAssigned} ride${totalAssigned === 1 ? "" : "s"} + message for ${formatDateShort(rideDate)}`
                  : totalAssigned > 0
                    ? `Post ${totalAssigned} ride${totalAssigned === 1 ? "" : "s"} for ${formatDateShort(rideDate)}`
                    : `Post message for ${formatDateShort(rideDate)}`}
            </Button>
          </div>

          {/* Posted rides */}
          <PostedSection
            rides={postedRides}
            announcements={postedAnnouncements}
            loading={loadingPosted}
            onDeleteRide={handleDeleteRide}
            onDeleteAnnouncement={handleDeleteAnnouncement}
          />
        </div>
      </main>
    </div>
  );
}

// --- Route Row with group toggles ---

const GROUPS = ["G1", "G2", "G3", "Frisky"];

function RouteRow({
  route,
  assignedGroups,
  onToggleGroup,
  onAddCustomGroup,
}: {
  route: RouteRec;
  assignedGroups: Set<string>;
  onToggleGroup: (group: string) => void;
  onAddCustomGroup: (group: string) => void;
}) {
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const distanceMiles = (route.distanceKm / 1.609344).toFixed(0);
  const elevationFt = route.elevationGainM
    ? Math.round(route.elevationGainM * 3.28084).toLocaleString()
    : null;

  const rec = route.recommendation;
  const meaningfulAdvantage = rec && rec.tailwindAdvantage >= 1;

  const directionHint = !rec
    ? null
    : !meaningfulAdvantage
      ? null
      : rec.direction === "as-planned"
        ? "as planned"
        : "reverse";

  const windColor = !rec
    ? ""
    : rec.tailwindAdvantage >= 5
      ? "text-green-500"
      : rec.tailwindAdvantage >= 2
        ? "text-green-500"
        : rec.tailwindAdvantage >= 1
          ? "text-foreground"
          : "text-muted-foreground";

  const hasAssignment = assignedGroups.size > 0;

  // Split assigned groups into preset vs custom
  const customGroups = Array.from(assignedGroups).filter(
    (g) => !GROUPS.includes(g)
  );

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 transition-colors ${
        hasAssignment ? "border-foreground/30 bg-accent/30" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h4 className="text-sm font-medium truncate">
            {route.cafeStop || route.destination || route.name}
          </h4>
          <p className="text-xs text-muted-foreground">
            {distanceMiles}mi
            {elevationFt && ` · ${elevationFt}ft`}
            {directionHint && ` · ${directionHint}`}
          </p>
        </div>
        {rec && (
          <span className={`text-sm font-semibold tabular-nums shrink-0 ${windColor}`}>
            {rec.tailwindAdvantage > 0
              ? `${rec.tailwindAdvantage} mph`
              : "—"}
          </span>
        )}
      </div>

      {/* Group assignment */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {GROUPS.map((group) => {
          const active = assignedGroups.has(group);
          return (
            <button
              key={group}
              onClick={() => onToggleGroup(group)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {group}
            </button>
          );
        })}
        {customGroups.map((group) => (
          <button
            key={group}
            onClick={() => onToggleGroup(group)}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-foreground text-background transition-colors"
          >
            {group} &times;
          </button>
        ))}
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground bg-muted transition-colors"
          >
            Other
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = customInput.trim();
              if (val && !assignedGroups.has(val)) {
                onAddCustomGroup(val);
              }
              setCustomInput("");
              setShowCustom(false);
            }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="e.g. Special Ride"
              maxLength={50}
              autoFocus
              onBlur={() => {
                if (!customInput.trim()) setShowCustom(false);
              }}
              className="w-36 rounded-full border border-border bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </form>
        )}
      </div>
    </div>
  );
}

// --- Posted Section ---

function PostedSection({
  rides,
  announcements,
  loading,
  onDeleteRide,
  onDeleteAnnouncement,
}: {
  rides: WeeklyRide[];
  announcements: WeeklyAnnouncement[];
  loading: boolean;
  onDeleteRide: (id: string) => void;
  onDeleteAnnouncement: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  if (loading) return null;
  if (rides.length === 0 && announcements.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Posted</h3>

      {announcements.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-amber-400/60 bg-card p-3 flex items-start justify-between gap-2"
        >
          <div>
            <p className="text-sm font-medium">{a.title}</p>
            {a.body && (
              <p className="text-xs text-muted-foreground mt-0.5">{a.body}</p>
            )}
            {a.url && (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline mt-0.5 block truncate"
              >
                {a.url}
              </a>
            )}
          </div>
          <button
            onClick={async () => {
              setDeleting(a.id);
              await onDeleteAnnouncement(a.id);
              setDeleting(null);
            }}
            disabled={deleting === a.id}
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors shrink-0"
          >
            {deleting === a.id ? "..." : "Remove"}
          </button>
        </div>
      ))}

      {rides.map((ride) => {
        const miles = (ride.route.distanceKm / 1.609344).toFixed(0);
        return (
          <div
            key={ride.id}
            className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-2"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {ride.groupName}
                </span>
                <span className="text-sm font-medium truncate">
                  {ride.route.cafeStop ||
                    ride.route.destination ||
                    ride.route.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateShort(ride.rideDate)}
                {ride.departureTime && ` at ${ride.departureTime}`} · {miles}mi
              </p>
              {ride.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">
                  {ride.notes}
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                setDeleting(ride.id);
                await onDeleteRide(ride.id);
                setDeleting(null);
              }}
              disabled={deleting === ride.id}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors shrink-0"
            >
              {deleting === ride.id ? "..." : "Remove"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
