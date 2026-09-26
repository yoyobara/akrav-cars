import { NextResponse } from "next/server";
import { rejectBooking } from "@/lib/bookings";
import { errorResponse } from "@/lib/errors";
import { rejectBookingInput } from "@/lib/schemas";
import { requireAdmin } from "@/lib/session";

/** Admin rejects a pending request, with an optional reason (SPEC §8). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { reason } = rejectBookingInput.parse(await req.json().catch(() => ({})));
    const booking = await rejectBooking(admin, (await params).id, reason);
    return NextResponse.json({ booking });
  } catch (err) {
    return errorResponse(err);
  }
}
