import { and, eq, isNull } from "drizzle-orm";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";

/**
 * Google sign-in (SPEC §9). Only people already in `users` get in; a new
 * person joins by opening an invite link, which leaves the invite token in a
 * short-lived cookie that the first Google sign-in claims.
 */

/** Sessions are long-lived: nobody should be logged out on a phone (SPEC §9). */
const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // 400 days, the browser cap

/** Set by the invite page just before it sends the person to Google. */
export const PENDING_INVITE_COOKIE = "pending_invite";

async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
}

/**
 * Turns the pending invite into a family member with the Google identity.
 * Returns false when there is no usable invite, so the sign-in is refused.
 */
async function claimPendingInvite(profile: { email: string; name?: string | null; picture?: string | null }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_INVITE_COOKIE)?.value;
  if (!token) return false;
  cookieStore.delete(PENDING_INVITE_COOKIE);

  const email = profile.email.trim().toLowerCase();

  return db.transaction(async (tx) => {
    const invite = await tx.query.invites.findFirst({ where: eq(invites.token, token) });
    if (!invite || invite.claimedAt || invite.expiresAt < new Date()) return false;

    const [created] = await tx
      .insert(users)
      .values({
        name: profile.name?.trim() || email.split("@")[0],
        email,
        avatarUrl: profile.picture ?? null,
        role: invite.role,
        invitedBy: invite.createdBy,
      })
      .returning();

    // Guarded on claimed_at so two simultaneous sign-ins cannot both use it.
    const claimed = await tx
      .update(invites)
      .set({ claimedBy: created.id, claimedAt: new Date() })
      .where(and(eq(invites.id, invite.id), isNull(invites.claimedAt)))
      .returning({ id: invites.id });
    if (claimed.length === 0) tx.rollback();

    return true;
  }).catch(() => false);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Deployments other than Vercel (Fly.io, SPEC §9) serve behind a proxy that
  // Auth.js will not trust unless told to.
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  // A refused sign-in lands back on /signin?error=AccessDenied.
  pages: { signIn: "/signin", error: "/signin" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email || !profile.email_verified) return false;

      const existing = await findUserByEmail(profile.email);
      // A removed member stays out, invite or not; an admin can reactivate them.
      if (existing) return existing.isActive;

      return claimPendingInvite({
        email: profile.email,
        name: profile.name,
        picture: typeof profile.picture === "string" ? profile.picture : null,
      });
    },
    async jwt({ token, account }) {
      // Only on sign-in. Google's account id would otherwise be the subject;
      // the session carries ours.
      if (account && token.email) {
        const row = await findUserByEmail(token.email);
        if (row) token.sub = row.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
