/**
 * Creates the first admin, who signs in with Google and invites everyone
 * else. Safe to run repeatedly: nothing is duplicated or overwritten.
 *
 * Override the first admin with SEED_ADMIN_EMAIL / SEED_ADMIN_NAME.
 */
import "./env";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";

const admin = {
  name: process.env.SEED_ADMIN_NAME ?? "Yotam",
  email: (process.env.SEED_ADMIN_EMAIL ?? "yotambarak6@gmail.com").toLowerCase(),
};

async function main() {
  const [first] = await db
    .insert(users)
    .values({ name: admin.name, email: admin.email, role: "admin" })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (first) console.log(`admin: ${first.name} <${first.email}>`);
  else console.log(`admin: ${admin.email} already exists`);

  console.log("\nSign in at /signin with that Google account.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
