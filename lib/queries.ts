import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, cars, parkingReports, users, type Car } from "@/lib/db/schema";
import { PARKING_HISTORY_LIMIT } from "@/lib/constants";
import { deriveStatus, isActive, STATUS_ORDER, type BookingLike, type CarStatusKind } from "@/lib/status";

export type Person = { id: string; name: string; avatarUrl: string | null };

export type BookingView = BookingLike & {
  carId: string;
  note: string | null;
  user: Person;
};

export type ParkingView = {
  id: string;
  carId: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  addressCached: string | null;
  note: string | null;
  createdAt: Date;
  reportedBy: Person;
};

export type CarView = {
  car: Car;
  status: CarStatusKind;
  /** The trip in progress, if any. */
  active: BookingView | null;
  /** The next approved booking that has not started yet. */
  next: BookingView | null;
  /** Where the car was last left. */
  parking: ParkingView | null;
};

const person = {
  id: users.id,
  name: users.name,
  avatarUrl: users.avatarUrl,
};

const bookingColumns = {
  id: bookings.id,
  carId: bookings.carId,
  userId: bookings.userId,
  status: bookings.status,
  startAt: bookings.startAt,
  endAt: bookings.endAt,
  actualStartAt: bookings.actualStartAt,
  actualEndAt: bookings.actualEndAt,
  note: bookings.note,
  user: person,
};

const parkingColumns = {
  id: parkingReports.id,
  carId: parkingReports.carId,
  lat: parkingReports.lat,
  lng: parkingReports.lng,
  accuracyM: parkingReports.accuracyM,
  addressCached: parkingReports.addressCached,
  note: parkingReports.note,
  createdAt: parkingReports.createdAt,
  reportedBy: person,
};

/** Bookings that still matter right now: in progress, or approved and ahead. */
function liveBookingsFilter(carIds: string[], now: Date) {
  return and(
    inArray(bookings.carId, carIds),
    eq(bookings.status, "approved"),
    isNull(bookings.actualEndAt),
    // An overdue trip has endAt in the past but is still in progress.
    or(sql`${bookings.actualStartAt} IS NOT NULL`, gt(bookings.endAt, now)),
  );
}

/** The most recent parking report for each of the given cars. */
async function latestParkingByCar(carIds: string[]): Promise<Map<string, ParkingView>> {
  if (carIds.length === 0) return new Map();

  const rows = await db
    .selectDistinctOn([parkingReports.carId], parkingColumns)
    .from(parkingReports)
    .innerJoin(users, eq(users.id, parkingReports.reportedBy))
    .where(inArray(parkingReports.carId, carIds))
    .orderBy(parkingReports.carId, desc(parkingReports.createdAt));

  return new Map(rows.map((r) => [r.carId, r]));
}

/** SPEC §5.1 — one card per car, available first, then reserved, then in use. */
export async function getGarage(now = new Date()): Promise<CarView[]> {
  const carRows = await db
    .select()
    .from(cars)
    .where(eq(cars.isActive, true))
    .orderBy(asc(cars.nickname));

  const carIds = carRows.map((c) => c.id);
  if (carIds.length === 0) return [];

  const [live, parking] = await Promise.all([
    db
      .select(bookingColumns)
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(liveBookingsFilter(carIds, now))
      .orderBy(asc(bookings.startAt)),
    latestParkingByCar(carIds),
  ]);

  const views = carRows.map((car) => {
    const mine = live.filter((b) => b.carId === car.id);
    return {
      car,
      status: deriveStatus(mine, now),
      active: mine.find(isActive) ?? null,
      next: mine.find((b) => !isActive(b)) ?? null,
      parking: parking.get(car.id) ?? null,
    } satisfies CarView;
  });

  return views.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.car.nickname.localeCompare(b.car.nickname),
  );
}

/** Every booking overlapping a window, for the "today" strip and calendars. */
export async function getSchedule(from: Date, to: Date): Promise<BookingView[]> {
  return db
    .select(bookingColumns)
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(
      and(
        lt(bookings.startAt, to),
        gt(bookings.endAt, from),
        inArray(bookings.status, ["approved", "pending"]),
      ),
    )
    .orderBy(asc(bookings.startAt));
}

export type CarDetail = CarView & {
  /** Approved bookings ahead of us, soonest first. */
  upcoming: BookingView[];
  /** The last few finished trips. */
  recentTrips: BookingView[];
  parkingHistory: ParkingView[];
};

export async function getCarDetail(carId: string, now = new Date()): Promise<CarDetail | null> {
  const car = await db.query.cars.findFirst({ where: eq(cars.id, carId) });
  if (!car) return null;

  const [live, recentTrips, parkingHistory] = await Promise.all([
    db
      .select(bookingColumns)
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(liveBookingsFilter([carId], now))
      .orderBy(asc(bookings.startAt)),
    db
      .select(bookingColumns)
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(and(eq(bookings.carId, carId), eq(bookings.status, "completed")))
      .orderBy(desc(bookings.actualEndAt))
      .limit(5),
    db
      .select(parkingColumns)
      .from(parkingReports)
      .innerJoin(users, eq(users.id, parkingReports.reportedBy))
      .where(eq(parkingReports.carId, carId))
      .orderBy(desc(parkingReports.createdAt))
      .limit(PARKING_HISTORY_LIMIT),
  ]);

  const active = live.find(isActive) ?? null;
  const upcoming = live.filter((b) => !isActive(b));

  return {
    car,
    status: deriveStatus(live, now),
    active,
    next: upcoming[0] ?? null,
    parking: parkingHistory[0] ?? null,
    upcoming,
    recentTrips,
    parkingHistory,
  };
}

/** Notes recently used for this car, offered as one-tap suggestions (SPEC §5.6). */
export async function recentParkingNotes(carId: string, limit = 3): Promise<string[]> {
  const rows = await db
    .select({ note: parkingReports.note })
    .from(parkingReports)
    .where(and(eq(parkingReports.carId, carId), isNotNull(parkingReports.note)))
    .orderBy(desc(parkingReports.createdAt))
    .limit(20);

  const seen = new Set<string>();
  for (const { note } of rows) {
    const trimmed = note?.trim();
    if (trimmed) seen.add(trimmed);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

/* -------------------------------------------------------------------------- *
 * M2 — the coordination layer.
 * -------------------------------------------------------------------------- */

export type CarRef = { id: string; nickname: string };

const carRef = { id: cars.id, nickname: cars.nickname };

/** How long a decided request keeps showing on the requester's garage screen. */
const DECISION_VISIBLE_MS = 24 * 3_600_000;

export type PendingRequest = BookingView & {
  car: CarRef;
  createdAt: Date;
  /** Approved bookings for the same car this request would clash with. */
  conflicts: BookingView[];
  /** Its window has already passed, so approving it could do nothing. */
  expired: boolean;
};

/**
 * The admin inbox queue: every pending request, newest first (SPEC §5.5).
 *
 * The clash warning is worked out here rather than per row, so the whole queue
 * costs two queries no matter how long it is. It describes the request against
 * *approved* bookings only — overlapping pending requests are normal, and are
 * exactly what the admin is here to resolve (SPEC §4).
 */
export async function getPendingRequests(now = new Date()): Promise<PendingRequest[]> {
  const rows = await db
    .select({ ...bookingColumns, car: carRef, createdAt: bookings.createdAt })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .innerJoin(cars, eq(cars.id, bookings.carId))
    .where(eq(bookings.status, "pending"))
    .orderBy(desc(bookings.createdAt));

  if (rows.length === 0) return [];

  const carIds = [...new Set(rows.map((r) => r.carId))];
  const from = new Date(Math.min(...rows.map((r) => r.startAt.getTime())));
  const to = new Date(Math.max(...rows.map((r) => r.endAt.getTime())));

  const approved = await db
    .select(bookingColumns)
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(
      and(
        inArray(bookings.carId, carIds),
        eq(bookings.status, "approved"),
        lt(bookings.startAt, to),
        gt(bookings.endAt, from),
      ),
    )
    .orderBy(asc(bookings.startAt));

  return rows.map((row) => ({
    ...row,
    conflicts: approved.filter(
      (a) => a.carId === row.carId && a.startAt < row.endAt && a.endAt > row.startAt,
    ),
    expired: row.endAt <= now,
  }));
}

/** The number on the admin badge (SPEC §5.1). */
export async function pendingRequestCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.status, "pending"));

  return row?.count ?? 0;
}

export type MyBooking = BookingView & { car: CarRef; decisionNote: string | null };

/**
 * What I have asked for: requests still waiting, slots already approved and
 * still ahead of me, and anything decided against me in the last day.
 *
 * That last part is not in SPEC §5.5 — it is there because M2 ships before the
 * push notifications of M3, and without it a member whose request was rejected
 * would have no way at all of finding out.
 */
export async function getMyBookings(userId: string, now = new Date()): Promise<MyBooking[]> {
  return db
    .select({ ...bookingColumns, car: carRef, decisionNote: bookings.decisionNote })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .innerJoin(cars, eq(cars.id, bookings.carId))
    .where(
      and(
        eq(bookings.userId, userId),
        isNull(bookings.actualStartAt),
        or(
          and(
            inArray(bookings.status, ["pending", "approved"]),
            gt(bookings.endAt, now),
          ),
          and(
            eq(bookings.status, "rejected"),
            gt(bookings.decidedAt, new Date(now.getTime() - DECISION_VISIBLE_MS)),
          ),
        ),
      ),
    )
    .orderBy(asc(bookings.startAt));
}
