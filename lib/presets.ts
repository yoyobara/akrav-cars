import { shift } from "@/lib/time";

/** The quick presets from SPEC §5.1 and §5.3, in one place so the two sheets agree. */

export type Window = { startAt: Date; endAt: Date };

export type Preset = {
  id: string;
  label: string;
  window: (now: Date) => Window;
};

const MIN_WINDOW_MS = 60 * 60_000;

const forHours = (now: Date, n: number): Window => ({
  startAt: now,
  endAt: new Date(now.getTime() + n * 3_600_000),
});

/**
 * "Until 23:00", unless that is already less than an hour away — then the
 * preset would offer a pointless sliver of an evening, so fall back to an hour.
 */
function untilTonight(now: Date, startAt: Date): Window {
  const endAt = shift(now, 23);
  if (endAt.getTime() - now.getTime() < MIN_WINDOW_MS) return forHours(now, 1);
  return { startAt: startAt > now ? startAt : now, endAt };
}

/** Durations offered when claiming a car that is free right now (SPEC §5.1). */
export const TAKE_PRESETS: Preset[] = [
  { id: "1h", label: "1 hour", window: (now) => forHours(now, 1) },
  { id: "2h", label: "2 hours", window: (now) => forHours(now, 2) },
  { id: "3h", label: "3 hours", window: (now) => forHours(now, 3) },
  { id: "today", label: "Rest of the day", window: (now) => untilTonight(now, now) },
];

/** Presets in the request sheet, which can reach into the future (SPEC §5.3). */
export const REQUEST_PRESETS: Preset[] = [
  { id: "now-1h", label: "Now for 1h", window: (now) => forHours(now, 1) },
  { id: "now-3h", label: "Now for 3h", window: (now) => forHours(now, 3) },
  { id: "tonight", label: "Tonight", window: (now) => untilTonight(now, shift(now, 19)) },
  {
    id: "tomorrow-am",
    label: "Tomorrow morning",
    window: (now) => ({ startAt: shift(now, 8, 0, 1), endAt: shift(now, 12, 0, 1) }),
  },
];
