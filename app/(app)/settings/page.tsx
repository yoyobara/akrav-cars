import { asc } from "drizzle-orm";
import Link from "next/link";
import { InvitePanel } from "@/components/InvitePanel";
import { MemberList } from "@/components/MemberList";
import { ProfileForm } from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";

  const members = isAdmin
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .orderBy(asc(users.name))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Profile</h2>
        <Card>
          <ProfileForm name={me.name} avatarUrl={me.avatarUrl} email={me.email} />
        </Card>
      </section>

      {isAdmin && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted">Cars</h2>
            <Card>
              <Link href="/admin/cars" className="text-sm font-semibold text-accent">
                Manage cars →
              </Link>
            </Card>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted">Family</h2>
            <Card>
              <MemberList members={members} meId={me.id} />
            </Card>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted">Invite someone</h2>
            <Card>
              <InvitePanel />
            </Card>
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Privacy</h2>
        <Card>
          <p className="text-sm text-muted">
            Location is attached to cars, never to people. It is captured only when someone taps to
            report parking — never in the background — and only the family can see it. Parking
            history older than 90 days is deleted.
          </p>
        </Card>
      </section>

      <SignOutButton />
    </div>
  );
}
