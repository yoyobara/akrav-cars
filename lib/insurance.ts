import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  bookings,
  carDrivers,
  cars,
  temporaryInsurance,
  users,
  type TemporaryInsurance,
  type User,
} from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { coverageGap, type Coverage } from "@/lib/coverage";
import { formatTime, formatWhen } from "@/lib/time";

/** The database, or a transaction on it. */
type Executor = Pick<typeof db, "select">;

const key = (carId: string, userId: string) => `${carId}:${userId}`;

/**
 * Coverage for every (car, person) pair asked about, in three queries however
 * many pairs there are. Temporary insurance that ended before `from` is left
 * out, since nothing asked about can need it.
 */
export async function loadCoverage(
  ex: Executor,
  pairs: { carId: string; userId: string }[],
  from: Date,
): Promise<Map<string, Coverage>> {
  const out = new Map<string, Coverage>();
  if (pairs.length === 0) return out;

  const carIds = [...new Set(pairs.map((p) => p.carId))];
  const userIds = [...new Set(pairs.map((p) => p.userId))];

  const [carRows, named, temporary] = await Promise.all([
    ex.select({ id: cars.id, anyDriver: cars.anyDriver }).from(cars).where(inArray(cars.id, carIds)),
    ex
      .select({ carId: carDrivers.carId, userId: carDrivers.userId })
      .from(carDrivers)
      .where(and(inArray(carDrivers.carId, carIds), inArray(carDrivers.userId, userIds))),
    ex
      .select({
        carId: temporaryInsurance.carId,
        userId: temporaryInsurance.userId,
        startAt: temporaryInsurance.startAt,
        endAt: temporaryInsurance.endAt,
      })
      .from(temporaryInsurance)
      .where(
        and(
          inArray(temporaryInsurance.carId, carIds),
          inArray(temporaryInsurance.userId, userIds),
          isNull(temporaryInsurance.revokedAt),
          gt(temporaryInsurance.endAt, from),
        ),
      ),
  ]);

  const anyDriver = new Set(carRows.filter((c) => c.anyDriver).map((c) => c.id));
  const namedSet = new Set(named.map((n) => key(n.carId, n.userId)));

  for (const { carId, userId } of pairs) {
    const k = key(carId, userId);
    out.set(k, {
      permanent: anyDriver.has(carId) || namedSet.has(k),
      temporary: temporary
        .filter((t) => t.carId === carId && t.userId === userId)
        .map(({ startAt, endAt }) => ({ startAt, endAt })),
    });
  }
  return out;
}

export async function coverageFor(
  ex: Executor,
  carId: string,
  userId: string,
  from: Date,
): Promise<Coverage> {
  const map = await loadCoverage(ex, [{ carId, userId }], from);
  return map.get(key(carId, userId))!;
}

export function lookupCoverage(map: Map<string, Coverage>, carId: string, userId: string): Coverage {
  return map.get(key(carId, userId)) ?? { permanent: false, temporary: [] };
}

/**
 * Refuses with `not_insured` unless the person is covered on the car for the
 * whole window. `who` is how the sentence refers to them, "You" or a name, and
 * `then` is the sentence saying what to do about it.
 */
export async function assertInsured(
  ex: Executor,
  args: {
    carId: string;
    userId: string;
    from: Date;
    to: Date;
    who: string;
    carName: string;
    then: string;
  },
  now = new Date(),
): Promise<void> {
  const coverage = await coverageFor(ex, args.carId, args.userId, args.from);
  const gap = coverageGap(coverage, args.from, args.to);
  if (!gap) return;

  const subject = args.who === "You" ? "You are" : `${args.who} is`;
  const problem =
    gap.getTime() === args.from.getTime()
      ? `${subject} not insured on ${args.carName} for that window.`
      : `${subject} only insured on ${args.carName} until ${formatWhen(gap, now)}, and this runs until ${formatTime(args.to)}.`;
  throw new AppError("not_insured", `${problem} ${args.then}`);
}

/* -------------------------------------------------------------------------- *
 * Reads behind the admin's "Who can drive" panel.
 * -------------------------------------------------------------------------- */

export type InsuranceView = {
  id: string;
  userId: string;
  userName: string;
  startAt: Date;
  endAt: Date;
  note: string | null;
  createdByName: string;
};

const creator = alias(users, "creator");

/** Temporary insurance on a car that has not ended yet, soonest first. */
export async function currentTemporaryInsurance(carId: string, now = new Date()): Promise<InsuranceView[]> {
  return db
    .select({
      id: temporaryInsurance.id,
      userId: temporaryInsurance.userId,
      userName: users.name,
      startAt: temporaryInsurance.startAt,
      endAt: temporaryInsurance.endAt,
      note: temporaryInsurance.note,
      createdByName: creator.name,
    })
    .from(temporaryInsurance)
    .innerJoin(users, eq(users.id, temporaryInsurance.userId))
    .innerJoin(creator, eq(creator.id, temporaryInsurance.createdBy))
    .where(
      and(
        eq(temporaryInsurance.carId, carId),
        isNull(temporaryInsurance.revokedAt),
        gt(temporaryInsurance.endAt, now),
      ),
    )
    .orderBy(asc(temporaryInsurance.startAt));
}

/** Who is named on a car's policy. */
export async function namedDrivers(carId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: carDrivers.userId })
    .from(carDrivers)
    .where(eq(carDrivers.carId, carId));
  return rows.map((r) => r.userId);
}

/* -------------------------------------------------------------------------- *
 * What an admin changes.
 * -------------------------------------------------------------------------- */

async function requireCar(carId: string) {
  const car = await db.query.cars.findFirst({ where: eq(cars.id, carId) });
  if (!car) throw new AppError("not_found", "That car does not exist.");
  return car;
}

/** Replaces who a car's policy covers: anyone, or exactly these people. */
export async function setCarDrivers(
  admin: User,
  carId: string,
  args: { anyDriver: boolean; userIds: string[] },
): Promise<void> {
  await requireCar(carId);
  const userIds = [...new Set(args.userIds)];

  if (userIds.length > 0) {
    const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, userIds));
    if (found.length !== userIds.length) {
      throw new AppError("invalid_input", "One of those people is not in the family.");
    }
  }

  await db.transaction(async (tx) => {
    await tx.update(cars).set({ anyDriver: args.anyDriver }).where(eq(cars.id, carId));
    await tx.delete(carDrivers).where(eq(carDrivers.carId, carId));
    if (userIds.length > 0) {
      await tx
        .insert(carDrivers)
        .values(userIds.map((userId) => ({ carId, userId, addedBy: admin.id })));
    }
  });
}

export async function addTemporaryInsurance(
  admin: User,
  carId: string,
  args: { userId: string; startAt: Date; endAt: Date; note?: string | null },
  now = new Date(),
): Promise<TemporaryInsurance> {
  if (args.endAt <= args.startAt) {
    throw new AppError("invalid_input", "The end time has to be after the start time.");
  }
  if (args.endAt <= now) {
    throw new AppError("invalid_input", "That window has already passed.");
  }
  await requireCar(carId);

  const person = await db.query.users.findFirst({ where: eq(users.id, args.userId) });
  if (!person || !person.isActive) {
    throw new AppError("invalid_input", "That person is not in the family.");
  }

  const [created] = await db
    .insert(temporaryInsurance)
    .values({
      carId,
      userId: args.userId,
      startAt: args.startAt,
      endAt: args.endAt,
      note: args.note?.trim() || null,
      createdBy: admin.id,
    })
    .returning();
  return created;
}

/** Revoked, not deleted: the record of who was insured when is kept. */
export async function revokeTemporaryInsurance(
  admin: User,
  carId: string,
  insuranceId: string,
  now = new Date(),
): Promise<void> {
  const [revoked] = await db
    .update(temporaryInsurance)
    .set({ revokedAt: now, revokedBy: admin.id })
    .where(
      and(
        eq(temporaryInsurance.id, insuranceId),
        eq(temporaryInsurance.carId, carId),
        isNull(temporaryInsurance.revokedAt),
      ),
    )
    .returning({ id: temporaryInsurance.id });

  if (!revoked) throw new AppError("not_found", "That insurance does not exist or was already removed.");
}

export type UninsuredBooking = {
  id: string;
  userName: string;
  startAt: Date;
  endAt: Date;
  /** The trip is already under way. */
  active: boolean;
};

/**
 * Approved bookings on a car whose driver is not covered for what is left of
 * them — what happens when an admin takes someone off the policy or revokes
 * temporary insurance after approving. They cannot be started (startBooking
 * checks again), so the admin page lists them rather than letting it surprise
 * the driver at the kerb.
 */
export async function uninsuredBookings(carId: string, now = new Date()): Promise<UninsuredBooking[]> {
  const rows = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      userName: users.name,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      actualStartAt: bookings.actualStartAt,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(
      and(
        eq(bookings.carId, carId),
        eq(bookings.status, "approved"),
        isNull(bookings.actualEndAt),
        or(sql`${bookings.actualStartAt} IS NOT NULL`, gt(bookings.endAt, now)),
      ),
    )
    .orderBy(asc(bookings.startAt));

  if (rows.length === 0) return [];
  const coverage = await loadCoverage(
    db,
    rows.map((b) => ({ carId, userId: b.userId })),
    now,
  );

  return rows
    .filter((b) => {
      const from = b.startAt > now ? b.startAt : now;
      const to = b.endAt > from ? b.endAt : new Date(from.getTime() + 60_000);
      return coverageGap(lookupCoverage(coverage, carId, b.userId), from, to) !== null;
    })
    .map((b) => ({
      id: b.id,
      userName: b.userName,
      startAt: b.startAt,
      endAt: b.endAt,
      active: b.actualStartAt !== null,
    }));
}
