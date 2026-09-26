import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Avatar, Card, Empty } from "@/components/ui";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Development sign-in: pick who you are. Replaced by Google sign-in
 * (SPEC §9) once OAuth credentials exist — see lib/auth.ts.
 */
export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/");

  const family = await db
    .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.name))
    .catch(() => []);

  async function signInAs(formData: FormData) {
    "use server";
    await signIn("dev", { email: String(formData.get("email")), redirectTo: "/" });
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold">Akrav Cars</h1>
        <p className="text-sm text-muted">Who has which car, and where it was left.</p>
      </div>

      {family.length === 0 ? (
        <Empty title="Nobody here yet">
          Run <code className="font-mono">npm run db:seed</code> to create the first admin, or open
          an invite link.
        </Empty>
      ) : (
        <Card className="space-y-2">
          <p className="text-sm text-muted">Sign in as</p>
          {family.map((person) => (
            <form key={person.id} action={signInAs}>
              <input type="hidden" name="email" value={person.email} />
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl p-2 text-start active:bg-surface-muted"
              >
                <Avatar name={person.name} url={person.avatarUrl} size={36} />
                <span>
                  <span className="block font-semibold">{person.name}</span>
                  <span className="block text-xs text-muted">{person.email}</span>
                </span>
              </button>
            </form>
          ))}
        </Card>
      )}

      <p className="text-center text-xs text-muted">
        Development sign-in — no password. Google sign-in comes with the real deployment.
      </p>
    </main>
  );
}
