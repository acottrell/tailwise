"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface RouteOption {
  id: string;
  name: string;
  destination: string | null;
  cafeStop: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  stravaRouteId: string | null;
}

interface WeeklyRide {
  id: string;
  groupName: string;
  rideDate: string;
  departureTime: string | null;
  meetingPoint: string | null;
  notes: string | null;
  route: RouteOption;
}

interface WeeklyAnnouncement {
  id: string;
  weekStart: string;
  title: string;
  body: string | null;
}

export default function LbrccAdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Check if already authed via cookie
  useEffect(() => {
    const cookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("lbrcc_admin="));
    if (cookie) setAuthed(true);
  }, []);

  const handleLogin = useCallback(() => {
    document.cookie = `lbrcc_admin=${password}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict`;
    // Test auth by fetching
    fetch("/api/lbrcc/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then((r) => {
      if (r.status === 401) {
        setAuthError(true);
        document.cookie =
          "lbrcc_admin=; path=/; max-age=0; SameSite=Strict";
      } else {
        // Even a 400 (invalid input) means auth passed
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
              <p className="text-sm text-center text-red-500">
                Wrong password
              </p>
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

function AdminDashboard() {
  const [rides, setRides] = useState<WeeklyRide[]>([]);
  const [announcements, setAnnouncements] = useState<WeeklyAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/lbrcc?weeks=2");
      const data = await res.json();
      setRides(data.rides);
      setAnnouncements(data.announcements);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get next Sunday
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  const defaultDate = nextSunday.toISOString().split("T")[0];

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
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-8">
          {loading ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted animate-pulse h-32" />
              <div className="rounded-lg bg-muted animate-pulse h-32" />
            </div>
          ) : (
            <>
              <AddRideForm defaultDate={defaultDate} onAdded={loadData} />
              <AddAnnouncementForm
                defaultDate={defaultDate}
                onAdded={loadData}
              />
              <CurrentRides
                rides={rides}
                announcements={announcements}
                onDeleted={loadData}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function AddRideForm({
  defaultDate,
  onAdded,
}: {
  defaultDate: string;
  onAdded: () => void;
}) {
  const [groupName, setGroupName] = useState("G1");
  const [rideDate, setRideDate] = useState(defaultDate);
  const [departureTime, setDepartureTime] = useState("09:00");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [notes, setNotes] = useState("");
  const [routeId, setRouteId] = useState("");
  const [stravaUrl, setStravaUrl] = useState("");
  const [routeMode, setRouteMode] = useState<"library" | "strava">("library");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteName, setSelectedRouteName] = useState("");
  const [windPreview, setWindPreview] = useState<{
    direction: string;
    confidence: string;
    message: string;
    tailwindAdvantage: number;
    windSpeedMph?: number;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch wind preview when route + date are set
  const fetchPreview = useCallback(
    async (rid: string, date: string, time: string) => {
      if (!rid || !date) return;
      setLoadingPreview(true);
      setWindPreview(null);
      try {
        const res = await fetch(
          `/api/lbrcc/preview?routeId=${rid}&date=${date}&time=${time || "09:00"}`
        );
        const data = await res.json();
        if (data.recommendation) {
          setWindPreview({
            ...data.recommendation,
            windSpeedMph: data.weather?.windSpeedMph,
          });
        }
      } catch {
        // ignore
      } finally {
        setLoadingPreview(false);
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);

      const body: Record<string, string> = {
        groupName,
        rideDate,
      };
      if (departureTime) body.departureTime = departureTime;
      if (meetingPoint.trim()) body.meetingPoint = meetingPoint.trim();
      if (notes.trim()) body.notes = notes.trim();

      if (routeMode === "library" && routeId) {
        body.routeId = routeId;
      } else if (routeMode === "strava" && stravaUrl) {
        body.stravaUrl = stravaUrl;
      } else {
        setError("Select a route or paste a Strava URL");
        setSubmitting(false);
        return;
      }

      try {
        const res = await fetch("/api/lbrcc/rides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to add ride");
          return;
        }
        // Reset
        setRouteId("");
        setStravaUrl("");
        setSelectedRouteName("");
        setNotes("");
        setMeetingPoint("");
        onAdded();
      } catch {
        setError("Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [groupName, rideDate, departureTime, meetingPoint, notes, routeId, stravaUrl, routeMode, onAdded]
  );

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Add a ride</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Group</label>
            <select
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="G1">G1</option>
              <option value="G2">G2</option>
              <option value="G3">G3</option>
              <option value="G4">G4</option>
              <option value="All">All</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Date</label>
            <input
              type="date"
              value={rideDate}
              onChange={(e) => {
                setRideDate(e.target.value);
                if (routeId) fetchPreview(routeId, e.target.value, departureTime);
              }}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Depart</label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium">Route</label>
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setRouteMode("library")}
                className={`px-2 py-0.5 rounded ${routeMode === "library" ? "bg-foreground text-background" : "bg-muted"}`}
              >
                Library
              </button>
              <button
                type="button"
                onClick={() => setRouteMode("strava")}
                className={`px-2 py-0.5 rounded ${routeMode === "strava" ? "bg-foreground text-background" : "bg-muted"}`}
              >
                Strava URL
              </button>
            </div>
          </div>

          {routeMode === "library" ? (
            <RouteSearch
              selectedId={routeId}
              selectedName={selectedRouteName}
              onSelect={(id, name) => {
                setRouteId(id);
                setSelectedRouteName(name);
                if (id) fetchPreview(id, rideDate, departureTime);
              }}
            />
          ) : (
            <input
              type="url"
              value={stravaUrl}
              onChange={(e) => setStravaUrl(e.target.value)}
              placeholder="https://www.strava.com/routes/123456"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          )}
        </div>

        {/* Wind preview */}
        {loadingPreview && (
          <div className="rounded-lg bg-muted animate-pulse h-10" />
        )}
        {windPreview && !loadingPreview && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <span
              className={
                windPreview.confidence === "strong"
                  ? "text-green-500 font-medium"
                  : windPreview.confidence === "moderate"
                    ? "font-medium"
                    : "text-muted-foreground"
              }
            >
              {windPreview.tailwindAdvantage >= 1
                ? windPreview.direction === "as-planned"
                  ? "Ride as planned"
                  : "Ride in reverse"
                : "Ride either way"}
            </span>
            {windPreview.tailwindAdvantage >= 1 && (
              <span className="text-muted-foreground">
                {" "}&middot; {windPreview.tailwindAdvantage} mph advantage
              </span>
            )}
            {windPreview.windSpeedMph != null && (
              <span className="text-muted-foreground">
                {" "}&middot; {Math.round(windPreview.windSpeedMph)} mph wind
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Meeting point</label>
            <input
              type="text"
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              placeholder="Optional"
              maxLength={200}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              maxLength={500}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Adding..." : "Add ride"}
        </Button>
      </form>
    </div>
  );
}

function RouteSearch({
  selectedId,
  selectedName,
  onSelect,
}: {
  selectedId: string;
  selectedName: string;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RouteOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/routes/search?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(data.routes);
        setShowResults(true);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  if (selectedId && selectedName) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm truncate flex-1">{selectedName}</span>
        <button
          type="button"
          onClick={() => {
            onSelect("", "");
            setQuery("");
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder="Search routes by name, destination, or cafe..."
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
      />
      {searching && (
        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
          ...
        </span>
      )}
      {showResults && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
          {results.map((r) => {
            const miles = (r.distanceKm / 1.609344).toFixed(0);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelect(r.id, r.name);
                  setShowResults(false);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border last:border-0"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {miles}mi
                  {r.cafeStop && ` \u00b7 ${r.cafeStop}`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddAnnouncementForm({
  defaultDate,
  onAdded,
}: {
  defaultDate: string;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Compute Monday of the week containing defaultDate
  const d = new Date(defaultDate + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const mondayStr = d.toISOString().split("T")[0];

  const [weekStart, setWeekStart] = useState(mondayStr);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      setError(null);
      setSubmitting(true);

      try {
        const res = await fetch("/api/lbrcc/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart,
            title: title.trim(),
            body: body.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to add announcement");
          return;
        }
        setTitle("");
        setBody("");
        onAdded();
      } catch {
        setError("Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [title, body, weekStart, onAdded]
  );

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Add announcement</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Week starting</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. No club rides this week"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Details (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Heavy frost forecast. Please take care if you choose to ride."
            maxLength={1000}
            rows={2}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" size="sm" variant="outline" disabled={submitting}>
          {submitting ? "Adding..." : "Add announcement"}
        </Button>
      </form>
    </div>
  );
}

function CurrentRides({
  rides,
  announcements,
  onDeleted,
}: {
  rides: WeeklyRide[];
  announcements: WeeklyAnnouncement[];
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteRide = useCallback(
    async (id: string) => {
      setDeleting(id);
      try {
        await fetch(`/api/lbrcc/rides?id=${id}`, { method: "DELETE" });
        onDeleted();
      } catch {
        // ignore
      } finally {
        setDeleting(null);
      }
    },
    [onDeleted]
  );

  const handleDeleteAnnouncement = useCallback(
    async (id: string) => {
      setDeleting(id);
      try {
        await fetch(`/api/lbrcc/announcements?id=${id}`, {
          method: "DELETE",
        });
        onDeleted();
      } catch {
        // ignore
      } finally {
        setDeleting(null);
      }
    },
    [onDeleted]
  );

  if (rides.length === 0 && announcements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rides or announcements posted yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Posted</h2>
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
            <p className="text-xs text-muted-foreground mt-1">
              Week of {a.weekStart}
            </p>
          </div>
          <button
            onClick={() => handleDeleteAnnouncement(a.id)}
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
                <span className="text-sm font-medium">
                  {ride.route.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ride.rideDate}
                {ride.departureTime && ` at ${ride.departureTime}`} &middot;{" "}
                {miles}mi
              </p>
            </div>
            <button
              onClick={() => handleDeleteRide(ride.id)}
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
