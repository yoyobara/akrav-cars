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
