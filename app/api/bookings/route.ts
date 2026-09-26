import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createBooking } from "@/lib/bookings";
import { db } from "@/lib/db";
import { bookings, users } from "@/lib/db/schema";
import { errorResponse } from "@/lib/errors";
import { createBookingInput } from "@/lib/schemas";
import { requireUser } from "@/lib/session";

/** Calendar feed (SPEC §8): everything overlapping [from, to). */
export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);

    const from = new Date(searchParams.get("from") ?? Date.now());
    const to = new Date(searchParams.get("to") ?? Date.now() + 7 * 86_400_000);
    const carId = searchParams.get("car_id");

    const rows = await db
      .select({
        id: bookings.id,
        carId: bookings.carId,
        userId: bookings.userId,
        status: bookings.status,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
        actualStartAt: bookings.actualStartAt,
        actualEndAt: bookings.actualEndAt,
        note: bookings.note,
        user: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(
        and(
          lt(bookings.startAt, to),
          gt(bookings.endAt, from),
          inArray(bookings.status, ["pending", "approved", "completed"]),
          carId ? eq(bookings.carId, carId) : undefined,
        ),
      )
      .orderBy(asc(bookings.startAt));

    return NextResponse.json({ bookings: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Create a booking. Auto-approved when it starts now and the car is free,
 * otherwise it waits for an admin (open question O1, option b).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createBookingInput.parse(await req.json());

    const booking = await createBooking(user, {
      carId: body.carId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      note: body.note,
      startNow: body.startNow,
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
