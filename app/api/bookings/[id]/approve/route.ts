import { NextResponse } from "next/server";
import { approveBooking } from "@/lib/bookings";
import { errorResponse } from "@/lib/errors";
import { approveBookingInput } from "@/lib/schemas";
import { requireAdmin } from "@/lib/session";

/**
 * Admin approves a pending request (SPEC §8). `{ insure: true }` also records
 * temporary insurance for a requester who is not on the car's policy.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const body = approveBookingInput.parse(await req.json().catch(() => ({})));
    const booking = await approveBooking(admin, (await params).id, { insure: body.insure });
    return NextResponse.json({ booking });
  } catch (err) {
    return errorResponse(err);
  }
}
