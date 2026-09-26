import { NextResponse } from "next/server";
import { endBooking } from "@/lib/bookings";
import { errorResponse } from "@/lib/errors";
import { endBookingInput } from "@/lib/schemas";
import { requireUser } from "@/lib/session";

/** Holder or admin ends the trip; the body carries the parking report. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { parking } = endBookingInput.parse(await req.json());
    const booking = await endBooking(user, (await params).id, parking);
    return NextResponse.json({ booking });
  } catch (err) {
    return errorResponse(err);
  }
}
