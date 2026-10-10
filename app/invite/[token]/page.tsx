import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Card, Empty } from "@/components/ui";
import { PENDING_INVITE_COOKIE, signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Enough time to get through Google's screens, not enough to linger. */
const PENDING_INVITE_MAX_AGE_SECONDS = 15 * 60;

/**
 * First sign-in through an invite link claims it (SPEC §3). The token rides
 * along in a cookie and lib/auth.ts creates the member from the Google profile.
 */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  if (await getCurrentUser()) redirect("/");

  const invite = await db.query.invites.findFirst({ where: eq(invites.token, token) });

  const problem = !invite
    ? "That invite link is not valid."
    : invite.claimedAt
      ? "That invite link has already been used."
      : invite.expiresAt < new Date()
        ? "That invite link has expired — ask for a new one."
        : null;

  async function joinWithGoogle() {
    "use server";
    (await cookies()).set(PENDING_INVITE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PENDING_INVITE_MAX_AGE_SECONDS,
    });
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-bold">Join Akrav Cars</h1>

      {problem ? (
        <Empty title="This link will not work">{problem}</Empty>
      ) : (
        <Card>
          <p className="mb-3 text-sm text-muted">
            You have been invited as {invite!.role === "admin" ? "an admin" : "a member"}.
          </p>
          <form action={joinWithGoogle} className="space-y-2">
            <GoogleSignInButton label="Join with Google" />
            <p className="text-xs text-muted">
              Use the Google account you want to sign in with from now on.
            </p>
          </form>
        </Card>
      )}
    </main>
  );
}
