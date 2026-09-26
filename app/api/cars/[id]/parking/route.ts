import { NextResponse } from "next/server";
import { reportParking } from "@/lib/bookings";
import { errorResponse } from "@/lib/errors";
import { parkingInput } from "@/lib/schemas";
import { requireUser } from "@/lib/session";

/** Standalone parking report: the car moved without a trip (SPEC §8). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const parking = parkingInput.parse(await req.json());
    const report = await reportParking(user, (await params).id, parking);
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
