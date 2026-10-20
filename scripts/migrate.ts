/**
 * Applies pending migrations in ./drizzle. Run as a deploy step in production:
 *   DATABASE_URL=postgres://... npm run db:migrate
 * Without DATABASE_URL it migrates the local PGlite database (the dev server
 * also does this automatically).
 */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const migrationsFolder = path.join(process.cwd(), "drizzle");

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: 1 });
    await migrate(drizzle(pool), { migrationsFolder });
    await pool.end();
    console.log("Migrations applied to Postgres.");
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = path.resolve(process.env.PGLITE_DIR || "./.data/pglite");
    mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    await migrate(drizzle(client), { migrationsFolder });
    await client.close();
    console.log(`Migrations applied to local PGlite at ${dir}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
