import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Keep in sync with ROLES in src/lib/rbac.ts (adding a role needs a migration).
// "user" = a member of this server, "admin" = the server owner, "super_admin" = the platform owner.
export const userRole = pgEnum("user_role", ["user", "super_admin", "admin"]);
// "pending" = signed up on a server that requires the admin to approve new members.
export const userStatus = pgEnum("user_status", ["active", "suspended", "deleted", "pending"]);
export const joinMode = pgEnum("join_mode", ["open", "invite", "approval"]);
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
    // Announcements newer than this are unread for the member.
    announcementsReadAt: timestamp("announcements_read_at", { withTimezone: true }),
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
    // Empty for a folder post: its files live in content_files.
    storageKey: text("storage_key").notNull(),
    // For a folder post: the folder name. mimeType is then FOLDER_MIME and sizeBytes the total.
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

/** The files of a folder post (several files shared at once), in upload order. */
export const contentFiles = pgTable(
  "content_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    // Display path inside the folder, e.g. "src/app.js". Never used to build storage paths.
    path: text("path").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("content_files_content_idx").on(t.contentId, t.position)],
);

/**
 * Messages between a member and the server's admins (one thread per member), plus
 * announcements from the admins to everyone (memberId null).
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").references(() => users.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    // When the other side read it (unused for announcements).
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_member_idx").on(t.memberId, t.createdAt)],
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

/** Single-row table (id = 1) describing this server. Absent until the owner finishes /setup. */
export const serverSettings = pgTable("server_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull(),
  joinMode: joinMode("join_mode").notNull().default("invite"),
  // Listen on the local network (Wi-Fi/LAN) instead of this PC only.
  lanEnabled: boolean("lan_enabled").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // SHA-256 of the invite token; the raw token only ever lives in the link.
    tokenHash: text("token_hash").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invites_token_hash_key").on(t.tokenHash)],
);

export type User = typeof users.$inferSelect;
export type Content = typeof content.$inferSelect;
export type ContentFile = typeof contentFiles.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ServerSettings = typeof serverSettings.$inferSelect;
export type Invite = typeof invites.$inferSelect;
