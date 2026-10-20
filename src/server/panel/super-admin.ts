import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

/** The account the Super Admin uses on admin servers they open from the panel. No password: panel tokens only. */
export const PANEL_SUPER_ADMIN_EMAIL = "superadmin@panel.openshelf";

export async function ensurePanelSuperAdmin(): Promise<{ id: string; role: "super_admin" }> {
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${PANEL_SUPER_ADMIN_EMAIL}`)
    .limit(1);
  if (row) {
    await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, row.id));
    return { id: row.id, role: "super_admin" };
  }
  // At most one super_admin row may exist: an env-configured one is reused for the panel.
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "super_admin")).limit(1);
  if (existing) return { id: existing.id, role: "super_admin" };
  const [created] = await db
    .insert(schema.users)
    .values({
      email: PANEL_SUPER_ADMIN_EMAIL,
      username: "superadmin",
      displayName: "Super Admin",
      passwordHash: null,
      role: "super_admin",
      status: "active",
      lastLoginAt: new Date(),
    })
    .returning({ id: schema.users.id });
  return { id: created.id, role: "super_admin" };
}
