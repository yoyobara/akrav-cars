import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";
import { AppError, errorResponse } from "@/lib/errors";
import { claimInviteInput } from "@/lib/schemas";

/**
 * Claiming an invite creates the family member. With the development sign-in
 * bypass there is no external identity to attach, so the person types their
 * name and email here and can sign in with that email from then on.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = claimInviteInput.parse(await req.json());
    const email = body.email.trim().toLowerCase();

    const user = await db.transaction(async (tx) => {
      const invite = await tx.query.invites.findFirst({ where: eq(invites.token, token) });

      if (!invite) throw new AppError("invite_invalid", "That invite link is not valid.");
      if (invite.claimedAt) throw new AppError("invite_invalid", "That invite link has already been used.");
      if (invite.expiresAt < new Date()) {
        throw new AppError("invite_invalid", "That invite link has expired — ask for a new one.");
      }

      const existing = await tx.query.users.findFirst({ where: eq(users.email, email) });
      if (existing) {
        throw new AppError("invalid_input", "Someone with that email is already in the family.");
      }

      const [created] = await tx
        .insert(users)
        .values({
          name: body.name,
          email,
          role: invite.role,
          invitedBy: invite.createdBy,
        })
        .returning();

      await tx
        .update(invites)
        .set({ claimedBy: created.id, claimedAt: new Date() })
        .where(eq(invites.id, invite.id));

      return created;
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
