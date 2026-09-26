import Link from "next/link";
import { redirect } from "next/navigation";
import { OutboxFlush } from "@/components/OutboxFlush";
import { Avatar } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";

/** Everything behind this layout needs a signed-in family member. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Akrav Cars
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user.role === "admin" && (
              <Link href="/admin/cars" className="text-muted">
                Cars
              </Link>
            )}
            <Link href="/settings" aria-label="Settings">
              <Avatar name={user.name} url={user.avatarUrl} size={32} />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">{children}</main>
      <OutboxFlush />
    </>
  );
}
