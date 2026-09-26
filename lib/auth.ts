import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * SPEC §9 calls for Auth.js with Google sign-in. Until Google OAuth
 * credentials exist, the only provider is a development bypass: pick a family
 * member from the list and you are signed in as them, no password.
 *
 * Adding Google later is one entry in `providers` plus GOOGLE_CLIENT_ID /
 * GOOGLE_CLIENT_SECRET; the rest of the app only ever reads the session id.
 *
 * !! The dev provider trusts whoever can reach the sign-in page. Do not put
 * !! this on the public internet before wiring a real provider.
 */

/** Sessions are long-lived: nobody should be logged out on a phone (SPEC §9). */
const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // 400 days, the browser cap

if (process.env.NODE_ENV === "production" && !process.env.GOOGLE_CLIENT_ID) {
  console.warn(
    "[auth] Running in production with the development sign-in bypass enabled. " +
      "Anyone who can open the sign-in page can become any family member.",
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Deployments other than Vercel (Fly.io, SPEC §9) serve behind a proxy that
  // Auth.js will not trust unless told to.
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/signin" },
  providers: [
    Credentials({
      id: "dev",
      name: "Family member",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(raw) {
        const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
        if (!email) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user || !user.isActive) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.avatarUrl };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
