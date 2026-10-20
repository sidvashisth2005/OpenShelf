import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Keep in sync with ROLES in src/lib/rbac.ts (adding a role needs a migration).
export const userRole = pgEnum("user_role", ["user", "super_admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const contentVisibility = pgEnum("content_visibility", ["public", "unlisted", "private"]);
export const contentStatus = pgEnum("content_status", ["published", "draft", "removed"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    // Null for the super admin: their credential lives only in env config.
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("user"),
    status: userStatus("status").notNull().default("active"),
    statusReason: text("status_reason"),
    tosVersion: text("tos_version"),
    tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_key").on(sql`lower(${t.email})`),
    uniqueIndex("users_username_key").on(sql`lower(${t.username})`),
    index("users_role_idx").on(t.role),
    // At most one super admin row can ever exist.
    uniqueIndex("users_single_super_admin_key").on(t.role).where(sql`${t.role} = 'super_admin'`),
    index("users_status_idx").on(t.status),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie token; the raw token never touches the DB.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const tosAcceptances = pgTable(
  "tos_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tos_acceptances_user_idx").on(t.userId)],
);

export const content = pgTable(
  "content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    visibility: contentVisibility("visibility").notNull().default("public"),
    status: contentStatus("status").notNull().default("published"),
    // Status before a moderation removal, so a restore puts it back exactly.
    statusBeforeRemoval: contentStatus("status_before_removal"),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    removedReason: text("removed_reason"),
    removedBy: uuid("removed_by").references(() => users.id, { onDelete: "set null" }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("content_owner_idx").on(t.ownerId),
    index("content_feed_idx").on(t.status, t.visibility, t.createdAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: userRole("actor_role"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId),
    index("audit_logs_target_idx").on(t.targetType, t.targetId),
    index("audit_logs_action_idx").on(t.action),
  ],
);

export type User = typeof users.$inferSelect;
export type Content = typeof content.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
