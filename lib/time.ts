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

/* -------------------------------------------------------------------------- *
 * Writing times, not just reading them (SPEC §5.3).
 *
 * M1 only ever rendered instants. M2 has to *build* them: "tomorrow morning"
 * and the custom pickers are wall-clock times, and the wall clock that matters
 * is Jerusalem's — not the phone's. Doing this in browser-local time would put
 * a request an hour out for anyone travelling, while still being rendered back
 * to them as Jerusalem time, so the maths below is anchored to TIMEZONE too.
 * -------------------------------------------------------------------------- */

const fieldsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function partsOf(d: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of fieldsFmt.formatToParts(d)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return out;
}

/** What Jerusalem clocks read at this instant. */
export function wallClock(d: Date): WallClock {
  const p = partsOf(d);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute };
}

/** Minutes Jerusalem is ahead of UTC at this instant (+120 or +180). */
function offsetMinutes(utcMs: number): number {
  const whole = Math.floor(utcMs / 1000) * 1000;
  const p = partsOf(new Date(whole));
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asIfUtc - whole) / 60_000;
}

/**
 * The instant at which Jerusalem clocks read these fields. Out-of-range fields
 * are normalised the way `Date` normalises them, so `day: 32` means the 1st of
 * the next month — which is what makes `shift` below safe at month ends.
 *
 * Two passes: the offset looked up from the naive guess can be the wrong side
 * of a DST change, and re-reading it at the corrected instant fixes that.
 */
export function fromWallClock(f: WallClock): Date {
  const wall = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute);
  const firstPass = wall - offsetMinutes(wall) * 60_000;
  return new Date(wall - offsetMinutes(firstPass) * 60_000);
}

/**
 * A Jerusalem wall-clock time relative to `from`: `shift(now, 8, 0, 1)` is
 * tomorrow at 08:00 whatever timezone the phone happens to be in.
 */
export function shift(from: Date, hour: number, minute = 0, dayOffset = 0): Date {
  const f = wallClock(from);
  return fromWallClock({ ...f, day: f.day + dayOffset, hour, minute });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Value for `<input type="datetime-local">`, as Jerusalem wall-clock time. */
export function toPickerValue(d: Date): string {
  const f = wallClock(d);
  return `${f.year}-${pad(f.month)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}`;
}

/**
 * Reads a `datetime-local` value back as Jerusalem wall-clock time.
 *
 * Seconds are optional: browsers leave them out at the default one-minute step,
 * but not all of them do, and a picker whose value the app refuses to parse
 * would silently disable the submit button.
 */
export function fromPickerValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/.exec(value.trim());
  if (!m) return null;
  return fromWallClock({
    year: +m[1],
    month: +m[2],
    day: +m[3],
    hour: +m[4],
    minute: +m[5],
  });
}
