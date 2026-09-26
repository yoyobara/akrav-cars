import { ClaimInviteForm } from "@/components/ClaimInviteForm";
import { Card, Empty } from "@/components/ui";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** First sign-in through an invite link claims it (SPEC §3). */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invite = await db.query.invites.findFirst({ where: eq(invites.token, token) });

  const problem = !invite
    ? "That invite link is not valid."
    : invite.claimedAt
      ? "That invite link has already been used."
      : invite.expiresAt < new Date()
        ? "That invite link has expired — ask for a new one."
        : null;

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
          <ClaimInviteForm token={token} />
        </Card>
      )}
    </main>
  );
}
