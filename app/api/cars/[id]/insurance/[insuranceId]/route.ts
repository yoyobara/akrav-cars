import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { revokeTemporaryInsurance } from "@/lib/insurance";
import { requireAdmin } from "@/lib/session";

/** Revokes temporary insurance; the record is kept. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; insuranceId: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id, insuranceId } = await params;
    await revokeTemporaryInsurance(admin, id, insuranceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
