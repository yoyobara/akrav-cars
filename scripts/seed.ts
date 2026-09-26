/**
 * Creates a first admin and a couple of cars so the app is usable straight
 * away. Safe to run repeatedly: nothing is duplicated or overwritten.
 *
 * Override the first admin with SEED_ADMIN_EMAIL / SEED_ADMIN_NAME.
 */
import "./env";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { cars, users } from "../lib/db/schema";

const admin = {
  name: process.env.SEED_ADMIN_NAME ?? "Yotam",
  email: (process.env.SEED_ADMIN_EMAIL ?? "yotambarak6@gmail.com").toLowerCase(),
};

const family = [
  { name: "Mom", email: "mom@example.com", role: "admin" as const },
  { name: "Noa", email: "noa@example.com", role: "member" as const },
];

const garage = [
  { nickname: "Mazda 3", make: "Mazda", model: "3", year: 2019, colour: "Grey", plate: "12-345-67" },
  { nickname: "Kia Picanto", make: "Kia", model: "Picanto", year: 2021, colour: "White", plate: "89-012-34" },
];

async function main() {
  const [first] = await db
    .insert(users)
    .values({ name: admin.name, email: admin.email, role: "admin" })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (first) console.log(`admin: ${first.name} <${first.email}>`);
  else console.log(`admin: ${admin.email} already exists`);

  for (const person of family) {
    const [created] = await db
      .insert(users)
      .values(person)
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (created) console.log(`member: ${created.name} <${created.email}>`);
  }

  for (const car of garage) {
    const existing = await db.query.cars.findFirst({ where: eq(cars.nickname, car.nickname) });
    if (existing) continue;
    const [created] = await db.insert(cars).values(car).returning();
    console.log(`car: ${created.nickname}`);
  }

  console.log("\nSign in at /signin and pick a name — no password in development.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
