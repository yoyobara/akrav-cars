import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { errorResponse } from "@/lib/errors";
import { requireUser } from "@/lib/session";

/** Everyone can see who is in the family; only admins can change it. */
export async function GET() {
  try {
    await requireUser();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
        isActive: users.isActive,
        joinedAt: users.joinedAt,
      })
      .from(users)
      .orderBy(asc(users.name));

    return NextResponse.json({ members: rows });
  } catch (err) {
    return errorResponse(err);
  }
}
