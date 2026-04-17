export interface NamedRide {
  key: string;
  label: string;
  shortLabel: string;
  time: Date;
  dayOfWeek: number;
}

const HORIZON_DAYS = 3;

function calendarDaysBetween(from: Date, to: Date): number {
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const t = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
}

function nextOccurrence(
  from: Date,
  targetDay: number,
  hours: number,
  minutes: number
): Date {
  const result = new Date(from);
  const currentDay = from.getDay();
  let daysAhead = (targetDay - currentDay + 7) % 7;

  if (daysAhead === 0) {
    const todayAtTime = new Date(from);
    todayAtTime.setHours(hours, minutes, 0, 0);
    if (todayAtTime.getTime() <= from.getTime()) {
      daysAhead = 7;
    }
  }

  result.setDate(result.getDate() + daysAhead);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function friskyTimeFor(date: Date): { hours: number; minutes: number } | null {
  const month = date.getMonth();
  const day = date.getDate();

  if (
    (month === 2 && day >= 28) ||
    month === 3 ||
    month === 4 ||
    month === 5 ||
    month === 6 ||
    (month === 7 && day <= 10)
  ) {
    return { hours: 18, minutes: 30 };
  }

  if ((month === 7 && day >= 11) || (month === 8 && day <= 15)) {
    return { hours: 18, minutes: 0 };
  }

  return null;
}

function format12h(h: number, m: number): string {
  const hour = h % 12 || 12;
  const period = h >= 12 ? "pm" : "am";
  return m === 0
    ? `${hour}${period}`
    : `${hour}:${m.toString().padStart(2, "0")}${period}`;
}

export function getNamedRides(now: Date = new Date()): NamedRide[] {
  const rides: NamedRide[] = [];

  const sunday = nextOccurrence(now, 0, 8, 30);
  if (calendarDaysBetween(now, sunday) <= HORIZON_DAYS) {
    rides.push({
      key: "sunday-830",
      label: "Sunday 8:30am",
      shortLabel: "Sun 8:30am",
      time: sunday,
      dayOfWeek: 0,
    });
  }

  const wedCandidate = nextOccurrence(now, 3, 18, 0);
  const fTime = friskyTimeFor(wedCandidate);
  if (fTime) {
    const frisky = new Date(wedCandidate);
    frisky.setHours(fTime.hours, fTime.minutes, 0, 0);
    if (
      frisky.getTime() > now.getTime() &&
      calendarDaysBetween(now, frisky) <= HORIZON_DAYS
    ) {
      const timeStr = format12h(fTime.hours, fTime.minutes);
      rides.push({
        key: `frisky-${fTime.hours}${fTime.minutes}`,
        label: `Frisky Wed ${timeStr}`,
        shortLabel: `Frisky ${timeStr}`,
        time: frisky,
        dayOfWeek: 3,
      });
    }
  }

  rides.sort((a, b) => a.time.getTime() - b.time.getTime());
  return rides;
}
