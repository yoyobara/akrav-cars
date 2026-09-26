import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The connection is opened lazily: `next build` imports every route module to
 * collect its metadata, and a missing DATABASE_URL should fail the request
 * that needs the database, not the build.
 *
 * postgres.js opens a pool per module instance and Next reloads modules on
 * every edit in dev, so the client is cached on globalThis to avoid leaking
 * pools.
 */
const globalForDb = globalThis as unknown as {
  akravSql?: ReturnType<typeof postgres>;
  akravDb?: PostgresJsDatabase<typeof schema>;
};

function connect(): PostgresJsDatabase<typeof schema> {
  if (globalForDb.akravDb) return globalForDb.akravDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon connection string.",
    );
  }

  const sql =
    globalForDb.akravSql ??
    postgres(url, {
      // Neon's pooled endpoint does not support prepared statements.
      prepare: false,
      max: 10,
    });

  const instance = drizzle(sql, { schema });
  globalForDb.akravSql = sql;
  globalForDb.akravDb = instance;
  return instance;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get: (_target, prop, receiver) => Reflect.get(connect(), prop, receiver),
});

export { schema };
