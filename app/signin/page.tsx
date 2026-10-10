import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { ErrorNote } from "@/components/ui";
import { signIn } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  AccessDenied:
    "That Google account is not in the family yet. Ask an admin for an invite link and open it first.",
};

/** Google sign-in (SPEC §9) — see lib/auth.ts. */
export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  if (await getCurrentUser()) redirect("/");

  const { error } = await searchParams;
  const errorMessage =
    typeof error === "string" ? (ERRORS[error] ?? "Sign-in did not work. Please try again.") : null;

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold">Akrav Cars</h1>
        <p className="text-sm text-muted">Who has which car, and where it was left.</p>
      </div>

      <ErrorNote>{errorMessage}</ErrorNote>

      <form action={signInWithGoogle}>
        <GoogleSignInButton />
      </form>
    </main>
  );
}
