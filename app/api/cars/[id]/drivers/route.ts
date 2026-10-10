import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { setCarDrivers } from "@/lib/insurance";
import { carDriversInput } from "@/lib/schemas";
import { requireAdmin } from "@/lib/session";

/** Who the car's insurance covers: anyone, or exactly the people named. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const body = carDriversInput.parse(await req.json());
    await setCarDrivers(admin, (await params).id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
