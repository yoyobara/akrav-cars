/** All timestamps are stored UTC and rendered in Asia/Jerusalem (SPEC §7). */
export const TIMEZONE = "Asia/Jerusalem";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dayTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "18:30" */
export function formatTime(d: Date): string {
  return timeFmt.format(d);
}

/** "18:30" today, "Sat 08:00" this week, "3 Oct 08:00" beyond. */
export function formatWhen(d: Date, now = new Date()): string {
  const days = dayDistance(now, d);
  if (days === 0) return timeFmt.format(d);
  if (days === 1) return `tomorrow ${timeFmt.format(d)}`;
  if (days > 1 && days < 7) return dayTimeFmt.format(d);
  return dateTimeFmt.format(d);
}

/** "2h ago", "just now", "in 40 min". */
export function formatRelative(d: Date, now = new Date()): string {
  const deltaMs = d.getTime() - now.getTime();
  const future = deltaMs > 0;
  const mins = Math.round(Math.abs(deltaMs) / 60_000);

  if (mins < 1) return "just now";
  const body =
    mins < 60
      ? `${mins} min`
      : mins < 60 * 36
        ? `${Math.round(mins / 60)}h`
        : `${Math.round(mins / (60 * 24))}d`;

  return future ? `in ${body}` : `${body} ago`;
}

/** Whole days between two instants, counted in Jerusalem calendar days. */
function dayDistance(from: Date, to: Date): number {
  const key = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const a = Date.parse(`${key(from)}T00:00:00Z`);
  const b = Date.parse(`${key(to)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
