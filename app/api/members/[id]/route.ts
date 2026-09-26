import { and, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppError, errorResponse } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";

const memberInput = z.object({
  role: z.enum(["admin", "member"]).optional(),
  isActive: z.boolean().optional(),
});

/** Promote a member, or remove someone from the household. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = memberInput.parse(await req.json());

    const losingAdmin =
      (body.role === "member" || body.isActive === false) &&
      (await isLastAdmin(id));
    if (losingAdmin) {
      throw new AppError("forbidden", "There has to be at least one admin left.");
    }
    if (id === admin.id && body.isActive === false) {
      throw new AppError("forbidden", "You cannot remove yourself.");
    }

    const [user] = await db.update(users).set(body).where(eq(users.id, id)).returning();
    if (!user) throw new AppError("not_found", "That person is not in the family.");

    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

async function isLastAdmin(id: string): Promise<boolean> {
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (target?.role !== "admin" || !target.isActive) return false;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, id)));

  return count === 0;
}
