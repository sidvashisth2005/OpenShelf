import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

// Cached on globalThis so dev hot-reloads reuse one pool / one PGlite instance
// (two PGlite instances on the same directory would corrupt it).
const g = globalThis as unknown as { __db?: Promise<Db> };

async function connect(): Promise<Db> {
  const e = env();
  if (e.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: e.DATABASE_URL, max: 10 });
    // Production applies migrations explicitly (`npm run db:migrate`) as a deploy step.
    return drizzle(pool, { schema }) as unknown as Db;
  }
  if (e.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production (embedded PGlite is for local development only).");
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.resolve(e.PGLITE_DIR);
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  // Embedded dev database: keep it migrated automatically.
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (!g.__db) {
    g.__db = connect().catch((err) => {
      g.__db = undefined;
      throw err;
    });
  }
  return g.__db;
}

export { schema };
