import { NextResponse } from "next/server";
import { approveBooking } from "@/lib/bookings";
import { errorResponse } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";

/** Admin approves a pending request (SPEC §8). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const booking = await approveBooking(admin, (await params).id);
    return NextResponse.json({ booking });
  } catch (err) {
    return errorResponse(err);
  }
}
