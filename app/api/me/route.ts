import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { errorResponse } from "@/lib/errors";
import { profileInput } from "@/lib/schemas";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const body = profileInput.parse(await req.json());

    const [user] = await db
      .update(users)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl || null } : {}),
      })
      .where(eq(users.id, me.id))
      .returning();

    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}
