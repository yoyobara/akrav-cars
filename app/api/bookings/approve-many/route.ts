import { NextResponse } from "next/server";
import { approveMany } from "@/lib/bookings";
import { errorResponse } from "@/lib/errors";
import { approveManyInput } from "@/lib/schemas";
import { requireAdmin } from "@/lib/session";

/**
 * Bulk-approve the non-conflicting requests in the inbox (SPEC §5.5).
 *
 * Always 200: a partial success is the expected outcome, so the body reports
 * what went through and the sentence for each request that did not.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const { ids } = approveManyInput.parse(await req.json());
    return NextResponse.json(await approveMany(admin, ids));
  } catch (err) {
    return errorResponse(err);
  }
}
