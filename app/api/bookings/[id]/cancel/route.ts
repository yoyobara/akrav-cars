import { NextResponse } from "next/server";
import { cancelBooking } from "@/lib/bookings";
import { errorResponse } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const booking = await cancelBooking(user, (await params).id);
    return NextResponse.json({ booking });
  } catch (err) {
    return errorResponse(err);
  }
}
