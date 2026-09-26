import { RESERVED_WINDOW_MIN, START_GRACE_AFTER_MIN, START_GRACE_BEFORE_MIN } from "@/lib/constants";

/**
 * Car status is never stored — always derived, so it cannot drift (SPEC §4).
 */
export type CarStatusKind = "in_use" | "reserved" | "available";

export type BookingLike = {
  id: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "completed";
  startAt: Date;
  endAt: Date;
  actualStartAt: Date | null;
  actualEndAt: Date | null;
};

/** "active" is derived, not a stored status: approved, started, not yet ended. */
export function isActive(b: BookingLike): boolean {
  return b.status === "approved" && b.actualStartAt !== null && b.actualEndAt === null;
}

/** A booking that is approved and still ahead of us. */
export function isUpcoming(b: BookingLike, now: Date): boolean {
  return b.status === "approved" && b.actualStartAt === null && b.endAt > now;
}

export function deriveStatus(bookings: BookingLike[], now = new Date()): CarStatusKind {
  if (bookings.some(isActive)) return "in_use";

  const soon = new Date(now.getTime() + RESERVED_WINDOW_MIN * 60_000);
  if (bookings.some((b) => isUpcoming(b, now) && b.startAt <= soon)) return "reserved";

  return "available";
}

/** Garage ordering: available first, then reserved, then in use (SPEC §5.1). */
export const STATUS_ORDER: Record<CarStatusKind, number> = {
  available: 0,
  reserved: 1,
  in_use: 2,
};

/**
 * A booking can only be started within a grace window around its planned start
 * (SPEC §4). Returns null when it may be started, or the reason it may not.
 */
export function startWindowProblem(b: BookingLike, now = new Date()): string | null {
  const opens = new Date(b.startAt.getTime() - START_GRACE_BEFORE_MIN * 60_000);
  const closes = new Date(b.startAt.getTime() + START_GRACE_AFTER_MIN * 60_000);

  if (now < opens) {
    return `This booking cannot be started yet — it opens ${START_GRACE_BEFORE_MIN} minutes before the start time.`;
  }
  if (now > closes) {
    return "This booking expired — it was not started in time. Take the car fresh instead.";
  }
  return null;
}
