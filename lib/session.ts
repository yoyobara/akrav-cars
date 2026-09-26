import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";

/**
 * The session cookie only carries a user id. Role and is_active are read from
 * the database on every request, so a demoted or removed member loses access
 * immediately instead of at their next sign-in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user || !user.isActive) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthenticated", "Please sign in first.");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new AppError("forbidden", "Only an admin can do that.");
  }
  return user;
}

export function isAdmin(user: Pick<User, "role">): boolean {
  return user.role === "admin";
}
