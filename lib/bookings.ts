import { and, eq, isNull, lt, gt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bookings,
  cars,
  parkingReports,
  temporaryInsurance,
  users,
  type Booking,
  type User,
} from "@/lib/db/schema";
import { isCovered } from "@/lib/coverage";
import { AppError, asAppError, type ErrorCode } from "@/lib/errors";
import { reverseGeocode } from "@/lib/geocode";
import { assertInsured, coverageFor } from "@/lib/insurance";
import type { ParkingInput } from "@/lib/schemas";
import { isAdmin } from "@/lib/session";
import { startWindowProblem } from "@/lib/status";
import { formatTime } from "@/lib/time";

/** A claim whose window opens within this tolerance counts as "now". */
const NOW_TOLERANCE_MS = 5 * 60_000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function loadCar(tx: Tx, carId: string) {
  const car = await tx.query.cars.findFirst({ where: eq(cars.id, carId) });
  if (!car) throw new AppError("not_found", "That car does not exist.");
  if (!car.isActive) throw new AppError("car_inactive", "That car has been archived.");
  return car;
}

/** The trip currently in progress on a car, if any. */
async function activeBooking(tx: Tx, carId: string) {
  return tx.query.bookings.findFirst({
    where: and(
      eq(bookings.carId, carId),
      sql`${bookings.actualStartAt} IS NOT NULL`,
      isNull(bookings.actualEndAt),
    ),
  });
}

/** An approved booking overlapping the window, ignoring `exceptId`. */
async function overlappingApproved(
  tx: Tx,
  carId: string,
  from: Date,
  to: Date,
  exceptId?: string,
) {
  return tx.query.bookings.findFirst({
    where: and(
      eq(bookings.carId, carId),
      eq(bookings.status, "approved"),
      lt(bookings.startAt, to),
      gt(bookings.endAt, from),
      exceptId ? ne(bookings.id, exceptId) : undefined,
    ),
  });
}

async function nameOf(tx: Tx, userId: string): Promise<string> {
  const u = await tx.query.users.findFirst({ where: eq(users.id, userId) });
  return u?.name ?? "someone";
}

async function carNameOf(tx: Tx, carId: string): Promise<string> {
  const car = await tx.query.cars.findFirst({ where: eq(cars.id, carId) });
  return car?.nickname ?? "this car";
}

export type CreateBookingArgs = {
  carId: string;
  startAt: Date;
  endAt: Date;
  note?: string | null;
  /** Take the car in the same request (only possible when auto-approved). */
  startNow?: boolean;
};

/**
 * Creates a booking and decides whether it needs approval.
 *
 * Open question O1, resolved as option (b): a claim on a car that is free
 * *right now*, with no conflicting approved booking, is auto-approved. Future
 * slots still go to an admin. An admin's own booking is always auto-approved.
 *
 * Neither shortcut applies to someone not insured on the car for the window:
 * a member's request then waits in the inbox, where an admin records the
 * temporary insurance as they approve it, and an admin is told to add it first.
 */
export async function createBooking(
  user: User,
  args: CreateBookingArgs,
  now = new Date(),
): Promise<Booking> {
  if (args.endAt <= args.startAt) {
    throw new AppError("invalid_input", "The end time has to be after the start time.");
  }
  if (args.endAt <= now) {
    throw new AppError("invalid_input", "That window has already passed.");
  }

  return db.transaction(async (tx) => {
    const car = await loadCar(tx, args.carId);

    const startsNow = args.startAt.getTime() <= now.getTime() + NOW_TOLERANCE_MS;
    const active = await activeBooking(tx, args.carId);
    const clash = await overlappingApproved(tx, args.carId, args.startAt, args.endAt);

    if (startsNow && active) {
      const holder = await nameOf(tx, active.userId);
      throw new AppError(
        "car_in_use",
        `${holder} has this car out until ${formatTime(active.endAt)}. Ask them for it instead.`,
      );
    }

    if (startsNow && clash) {
      const owner = await nameOf(tx, clash.userId);
      throw new AppError(
        "booking_conflict",
        `That clashes with ${owner} ${formatTime(clash.startAt)}–${formatTime(clash.endAt)}.`,
      );
    }

    const coverage = await coverageFor(tx, args.carId, user.id, args.startAt);
    const insured = isCovered(coverage, args.startAt, args.endAt);

    if (!insured && (isAdmin(user) || args.startNow)) {
      await assertInsured(
        tx,
        {
          carId: args.carId,
          userId: user.id,
          from: args.startAt,
          to: args.endAt,
          who: "You",
          carName: car.nickname,
          then: isAdmin(user)
            ? "Add temporary insurance on the car's admin page first."
            : "Request it instead, and an admin can add temporary insurance.",
        },
        now,
      );
    }

    const autoApproved = insured && (isAdmin(user) || (startsNow && !active && !clash));

    if (isAdmin(user) && clash) {
      const owner = await nameOf(tx, clash.userId);
      throw new AppError(
        "booking_conflict",
        `That clashes with ${owner} ${formatTime(clash.startAt)}–${formatTime(clash.endAt)} — cancel that one first.`,
      );
    }

    const takeNow = !!args.startNow && autoApproved && startsNow;

    const [created] = await tx
      .insert(bookings)
      .values({
        carId: args.carId,
        userId: user.id,
        startAt: args.startAt,
        endAt: args.endAt,
        note: args.note ?? null,
        status: autoApproved ? "approved" : "pending",
        decidedBy: autoApproved ? user.id : null,
        decidedAt: autoApproved ? now : null,
        decisionNote: autoApproved && !isAdmin(user) ? "Auto-approved: car was free." : null,
        actualStartAt: takeNow ? now : null,
      })
      .returning();

    return created;
  });
}

/** A request an admin is about to decide on. */
async function loadPending(tx: Tx, bookingId: string) {
  const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!booking) throw new AppError("not_found", "That request does not exist.");

  if (booking.status !== "pending") {
    throw new AppError(
      "already_decided",
      booking.status === "cancelled"
        ? "The person who asked has cancelled this request."
        : `This request was already ${booking.status}.`,
    );
  }
  return booking;
}

/**
 * Admin approves a request (SPEC §5.5).
 *
 * The clash check is here for the sentence it produces; `no_overlapping_approved`
 * is what actually guarantees it, and a request that loses a race against a
 * concurrent approval fails on the constraint with the same meaning.
 *
 * A requester not insured on the car for the window is refused with
 * `not_insured`, unless `insure` is set: the admin is saying they have arranged
 * temporary insurance, and it is recorded for exactly the booking's window in
 * the same transaction as the approval.
 */
export async function approveBooking(
  admin: User,
  bookingId: string,
  opts: { insure?: boolean } = {},
  now = new Date(),
): Promise<Booking> {
  return db.transaction(async (tx) => {
    const booking = await loadPending(tx, bookingId);

    if (booking.endAt <= now) {
      throw new AppError(
        "request_expired",
        "That window has already passed — reject it instead.",
      );
    }

    const clash = await overlappingApproved(
      tx,
      booking.carId,
      booking.startAt,
      booking.endAt,
      booking.id,
    );
    if (clash) {
      const owner = await nameOf(tx, clash.userId);
      throw new AppError(
        "booking_conflict",
        `This clashes with ${owner} ${formatTime(clash.startAt)}–${formatTime(clash.endAt)} — reject that one first?`,
      );
    }

    const coverage = await coverageFor(tx, booking.carId, booking.userId, booking.startAt);

    if (opts.insure && !isCovered(coverage, booking.startAt, booking.endAt)) {
      await tx.insert(temporaryInsurance).values({
        carId: booking.carId,
        userId: booking.userId,
        startAt: booking.startAt,
        endAt: booking.endAt,
        bookingId: booking.id,
        createdBy: admin.id,
      });
    }

    await assertInsured(
      tx,
      {
        carId: booking.carId,
        userId: booking.userId,
        from: booking.startAt,
        to: booking.endAt,
        who: await nameOf(tx, booking.userId),
        carName: await carNameOf(tx, booking.carId),
        then: "Add temporary insurance for it, or reject the request.",
      },
      now,
    );

    const [updated] = await tx
      .update(bookings)
      .set({ status: "approved", decidedBy: admin.id, decidedAt: now, decisionNote: null })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  });
}

/** Admin rejects a request, optionally saying why (SPEC §5.5). */
export async function rejectBooking(
  admin: User,
  bookingId: string,
  reason?: string | null,
  now = new Date(),
): Promise<Booking> {
  return db.transaction(async (tx) => {
    await loadPending(tx, bookingId);

    const [updated] = await tx
      .update(bookings)
      .set({
        status: "rejected",
        decidedBy: admin.id,
        decidedAt: now,
        // Blank is the same as no reason; the DB check keeps it that way.
        decisionNote: reason?.trim() || null,
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  });
}

export type BulkApproveResult = {
  approved: string[];
  skipped: { id: string; code: ErrorCode; message: string }[];
};

/**
 * "Bulk-approve non-conflicting requests" (SPEC §5.5).
 *
 * Deliberately sequential and one transaction each: approving the first request
 * is what makes the second one clash, and a single clash must not roll back the
 * approvals that already succeeded. Whatever could not be approved comes back
 * with the sentence saying why, so the inbox can show it per row.
 */
export async function approveMany(
  admin: User,
  ids: string[],
  now = new Date(),
): Promise<BulkApproveResult> {
  const approved: string[] = [];
  const skipped: BulkApproveResult["skipped"] = [];

  for (const id of ids) {
    try {
      await approveBooking(admin, id, {}, now);
      approved.push(id);
    } catch (err) {
      const app = asAppError(err);
      if (!app) throw err;
      skipped.push({ id, code: app.code, message: app.message });
    }
  }

  return { approved, skipped };
}

/** Holder taps "Take the car" on a booking approved earlier. */
export async function startBooking(user: User, bookingId: string, now = new Date()): Promise<Booking> {
  return db.transaction(async (tx) => {
    const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!booking) throw new AppError("not_found", "That booking does not exist.");

    if (booking.userId !== user.id) {
      throw new AppError("not_yours", "That booking belongs to someone else.");
    }
    if (booking.status !== "approved") {
      throw new AppError(
        "not_startable",
        booking.status === "pending"
          ? "This request is still waiting for approval."
          : "This booking is no longer open.",
      );
    }
    if (booking.actualStartAt) {
      throw new AppError("not_startable", "You already have this car out.");
    }

    const problem = startWindowProblem(booking, now);
    if (problem) throw new AppError("not_startable", problem);

    // Checked again here, not only at approval: insurance can be revoked in
    // between, and nobody should drive off uninsured because of a stale "yes".
    await assertInsured(
      tx,
      {
        carId: booking.carId,
        userId: user.id,
        from: now,
        to: booking.endAt > now ? booking.endAt : new Date(now.getTime() + 60_000),
        who: "You",
        carName: await carNameOf(tx, booking.carId),
        then: "Ask an admin to add temporary insurance.",
      },
      now,
    );

    const active = await activeBooking(tx, booking.carId);
    if (active) {
      const holder = await nameOf(tx, active.userId);
      throw new AppError("car_in_use", `${holder} still has this car out.`);
    }

    const [updated] = await tx
      .update(bookings)
      .set({ actualStartAt: now })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  });
}

/**
 * Ends a trip. A parking report is mandatory — that is the whole point of the
 * app (SPEC §4) — so the report and the completion happen in one transaction:
 * a trip can never be closed without leaving the car's location behind.
 */
export async function endBooking(
  user: User,
  bookingId: string,
  parking: ParkingInput,
  now = new Date(),
): Promise<Booking> {
  const address = await resolveAddress(parking);

  return db.transaction(async (tx) => {
    const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!booking) throw new AppError("not_found", "That booking does not exist.");

    const holder = booking.userId === user.id;
    if (!holder && !isAdmin(user)) {
      throw new AppError("not_yours", "Only the person holding the car, or an admin, can end this trip.");
    }
    if (!booking.actualStartAt) {
      throw new AppError("not_startable", "That trip never started.");
    }
    if (booking.actualEndAt) {
      throw new AppError("already_ended", "This trip has already been ended.");
    }

    await tx.insert(parkingReports).values({
      carId: booking.carId,
      bookingId: booking.id,
      reportedBy: user.id,
      lat: parking.lat ?? null,
      lng: parking.lng ?? null,
      accuracyM: parking.accuracyM ?? null,
      addressCached: address,
      note: parking.note ?? null,
    });

    const [updated] = await tx
      .update(bookings)
      .set({ actualEndAt: now, status: "completed", endedBy: user.id })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  });
}

/** Requester or admin calls off a booking that has not started. */
export async function cancelBooking(user: User, bookingId: string): Promise<Booking> {
  return db.transaction(async (tx) => {
    const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!booking) throw new AppError("not_found", "That booking does not exist.");

    if (booking.userId !== user.id && !isAdmin(user)) {
      throw new AppError("not_yours", "That booking belongs to someone else.");
    }
    if (booking.actualStartAt && !booking.actualEndAt) {
      throw new AppError("already_ended", "That trip is in progress — end it instead.");
    }
    if (booking.status !== "pending" && booking.status !== "approved") {
      throw new AppError("already_ended", "This booking is already closed.");
    }

    const [updated] = await tx
      .update(bookings)
      .set({ status: "cancelled", decidedBy: user.id, decidedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  });
}

/** "The car moved without a trip" — a standalone report (SPEC §8). */
export async function reportParking(user: User, carId: string, parking: ParkingInput) {
  const address = await resolveAddress(parking);

  return db.transaction(async (tx) => {
    await loadCar(tx, carId);
    const [report] = await tx
      .insert(parkingReports)
      .values({
        carId,
        bookingId: null,
        reportedBy: user.id,
        lat: parking.lat ?? null,
        lng: parking.lng ?? null,
        accuracyM: parking.accuracyM ?? null,
        addressCached: address,
        note: parking.note ?? null,
      })
      .returning();

    return report;
  });
}

/**
 * The client usually sends the address it already showed on the map. Only fall
 * back to geocoding here, and never let a slow Nominatim call block the report
 * being written — ending a trip has to work on a flaky connection (SPEC §10).
 */
async function resolveAddress(parking: ParkingInput): Promise<string | null> {
  if (parking.address) return parking.address;
  if (parking.lat == null || parking.lng == null) return null;
  return reverseGeocode(parking.lat, parking.lng).catch(() => null);
}
