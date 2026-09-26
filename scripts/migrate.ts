/**
 * Applies lib/db/migrations/*.sql in filename order, once each.
 *
 * Hand-written SQL rather than drizzle-kit, because the exclusion constraint
 * in SPEC §7 cannot be expressed in the Drizzle schema DSL.
 */
import "./env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const dir = join(process.cwd(), "lib/db/migrations");
const sql = postgres(url, { prepare: false, max: 1 });

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql<{ filename: string }[]>`SELECT filename FROM _migrations`).map(
      (r) => r.filename,
    ),
  );

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`applying ${file} ... `);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO _migrations (filename) VALUES (${file})`;
    });
    console.log("ok");
    ran++;
  }

  console.log(ran === 0 ? "already up to date" : `${ran} migration(s) applied`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
