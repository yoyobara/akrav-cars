import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";
import { errorResponse } from "@/lib/errors";
import { inviteInput } from "@/lib/schemas";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  try {
    await requireAdmin();
    const rows = await db
      .select({
        id: invites.id,
        token: invites.token,
        role: invites.role,
        expiresAt: invites.expiresAt,
        claimedAt: invites.claimedAt,
        claimedBy: users.name,
        createdAt: invites.createdAt,
      })
      .from(invites)
      .leftJoin(users, eq(users.id, invites.claimedBy))
      .orderBy(desc(invites.createdAt))
      .limit(20);

    return NextResponse.json({ invites: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Admin generates an invite link; the first sign-in through it claims it. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = inviteInput.parse(await req.json().catch(() => ({})));

    const [invite] = await db
      .insert(invites)
      .values({
        token: randomBytes(24).toString("base64url"),
        createdBy: admin.id,
        role: body.role,
        expiresAt: new Date(Date.now() + body.expiresInDays * 86_400_000),
      })
      .returning();

    return NextResponse.json({ invite }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
