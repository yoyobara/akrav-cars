import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { addTemporaryInsurance } from "@/lib/insurance";
import { temporaryInsuranceInput } from "@/lib/schemas";
import { requireAdmin } from "@/lib/session";

/** Temporary insurance for someone not on the car's policy. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const body = temporaryInsuranceInput.parse(await req.json());
    const insurance = await addTemporaryInsurance(admin, (await params).id, {
      userId: body.userId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      note: body.note,
    });
    return NextResponse.json({ insurance }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
