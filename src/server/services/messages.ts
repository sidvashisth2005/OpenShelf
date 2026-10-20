import "server-only";
import { and, count, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { hasPermission } from "@/lib/rbac";
import { fieldErrors, messageSchema } from "@/lib/validation";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { getDb, schema } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { isUuid, type MutationResult } from "./content";

/**
 * Messaging on a server: each member has one private thread with the server's admins
 * (memberId = the member), and admins can post announcements to everyone (memberId null).
 */

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: Date;
  fromMember: boolean;
  sender: { displayName: string } | null;
};

const LIMITED = { ok: false as const, status: 400 as const, error: "You're sending messages too fast. Wait a minute and try again." };

/** Sent by someone other than this member (an admin, or an admin account since deleted). */
const notFrom = (memberId: string) => sql`${schema.messages.senderId} is distinct from ${memberId}`;

function parseBody(input: Record<string, unknown>) {
  return messageSchema.safeParse(input);
}

async function loadThread(memberId: string): Promise<ThreadMessage[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.messages.id,
      body: schema.messages.body,
      createdAt: schema.messages.createdAt,
      senderId: schema.messages.senderId,
      senderName: schema.users.displayName,
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.users.id, schema.messages.senderId))
    .where(eq(schema.messages.memberId, memberId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(200);
  return rows.reverse().map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    fromMember: r.senderId === memberId,
    sender: r.senderName ? { displayName: r.senderName } : null,
  }));
}

/** A member writes to the server's admins. */
export async function sendToAdmins(member: CurrentUser, input: Record<string, unknown>): Promise<MutationResult> {
  if (member.status !== "active" || hasPermission(member, "message:manage")) {
    return { ok: false, status: 403, error: "Admins reply from Admin → Messages." };
  }
  const parsed = parseBody(input);
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };
  if (!rateLimit(`msg:${member.id}`, 20, 60_000).ok) return LIMITED;
  const db = await getDb();
  await db.insert(schema.messages).values({ memberId: member.id, senderId: member.id, body: parsed.data.body });
  return { ok: true, data: undefined };
}

/** An admin replies in a member's thread. */
export async function replyToMember(admin: CurrentUser, memberId: string, input: Record<string, unknown>): Promise<MutationResult> {
  if (!hasPermission(admin, "message:manage")) return { ok: false, status: 403, error: "Not allowed." };
  if (!isUuid(memberId)) return { ok: false, status: 404, error: "Member not found." };
  const parsed = parseBody(input);
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };
  const db = await getDb();
  const [member] = await db.select({ role: schema.users.role, status: schema.users.status }).from(schema.users).where(eq(schema.users.id, memberId)).limit(1);
  if (!member || member.role !== "user" || member.status === "deleted") return { ok: false, status: 404, error: "Member not found." };
  if (!rateLimit(`msg:${admin.id}`, 60, 60_000).ok) return LIMITED;
  await db.insert(schema.messages).values({ memberId, senderId: admin.id, body: parsed.data.body });
  return { ok: true, data: undefined };
}

/** An admin posts an announcement every member sees. */
export async function announce(admin: CurrentUser, input: Record<string, unknown>): Promise<MutationResult> {
  if (!hasPermission(admin, "message:manage")) return { ok: false, status: 403, error: "Not allowed." };
  const parsed = parseBody(input);
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };
  if (!rateLimit(`announce:${admin.id}`, 10, 60_000).ok) return LIMITED;
  const db = await getDb();
  const [row] = await db.insert(schema.messages).values({ memberId: null, senderId: admin.id, body: parsed.data.body }).returning({ id: schema.messages.id });
  await audit({ actor: admin, action: "admin.message.announce", targetType: "message", targetId: row.id, metadata: { length: parsed.data.body.length } });
  return { ok: true, data: undefined };
}

export async function listAnnouncements(limit = 20): Promise<ThreadMessage[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.messages.id, body: schema.messages.body, createdAt: schema.messages.createdAt, senderName: schema.users.displayName })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.users.id, schema.messages.senderId))
    .where(isNull(schema.messages.memberId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit);
  return rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt, fromMember: false, sender: r.senderName ? { displayName: r.senderName } : null }));
}

/** The member's own thread. Opening it marks the admins' replies and all announcements as read. */
export async function openMemberInbox(member: CurrentUser) {
  const db = await getDb();
  const now = new Date();
  await db
    .update(schema.messages)
    .set({ readAt: now })
    .where(and(eq(schema.messages.memberId, member.id), notFrom(member.id), isNull(schema.messages.readAt)));
  await db.update(schema.users).set({ announcementsReadAt: now }).where(eq(schema.users.id, member.id));
  const [thread, announcements] = await Promise.all([loadThread(member.id), listAnnouncements()]);
  return { thread, announcements };
}

/** One member's thread, for an admin. Opening it marks the member's messages as read. */
export async function openThreadForAdmin(admin: CurrentUser, memberId: string) {
  if (!hasPermission(admin, "message:manage") || !isUuid(memberId)) return null;
  const db = await getDb();
  const [member] = await db
    .select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName, role: schema.users.role, status: schema.users.status })
    .from(schema.users)
    .where(eq(schema.users.id, memberId))
    .limit(1);
  if (!member || member.role !== "user") return null;
  await db
    .update(schema.messages)
    .set({ readAt: new Date() })
    .where(and(eq(schema.messages.memberId, memberId), eq(schema.messages.senderId, memberId), isNull(schema.messages.readAt)));
  return { member, thread: await loadThread(memberId) };
}

export type Conversation = { memberId: string; username: string; displayName: string; lastAt: Date; lastBody: string; unread: number };

/** Every member thread, newest activity first, for the admin inbox. */
export async function listConversations(admin: CurrentUser): Promise<Conversation[]> {
  if (!hasPermission(admin, "message:manage")) return [];
  const db = await getDb();
  type Row = { member_id: string; username: string; display_name: string; last_at: string | Date; last_body: string; unread: number };
  // Both drivers (node-postgres and PGlite) return { rows }.
  const result = (await db.execute(sql`
    select m.member_id, u.username, u.display_name, m.created_at as last_at, m.body as last_body,
      (select count(*)::int from ${schema.messages} x
        where x.member_id = m.member_id and x.sender_id = m.member_id and x.read_at is null) as unread
    from (
      select distinct on (member_id) member_id, created_at, body
      from ${schema.messages} where member_id is not null
      order by member_id, created_at desc
    ) m
    join ${schema.users} u on u.id = m.member_id
    order by m.created_at desc
    limit 200
  `)) as unknown as { rows: Row[] };
  return result.rows.map((r) => ({
    memberId: r.member_id,
    username: r.username,
    displayName: r.display_name,
    lastAt: new Date(r.last_at),
    lastBody: r.last_body,
    unread: Number(r.unread),
  }));
}

/** Badge count in the header: unread member messages for admins; unread replies + announcements for members. */
export async function unreadCount(user: CurrentUser): Promise<number> {
  const db = await getDb();
  if (hasPermission(user, "message:manage")) {
    const [r] = await db
      .select({ n: count() })
      .from(schema.messages)
      .where(and(isNotNull(schema.messages.memberId), eq(schema.messages.senderId, schema.messages.memberId), isNull(schema.messages.readAt)));
    return r.n;
  }
  const [me] = await db.select({ seen: schema.users.announcementsReadAt }).from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
  const [replies, news] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.messages)
      .where(and(eq(schema.messages.memberId, user.id), notFrom(user.id), isNull(schema.messages.readAt))),
    db
      .select({ n: count() })
      .from(schema.messages)
      .where(and(isNull(schema.messages.memberId), me?.seen ? gt(schema.messages.createdAt, me.seen) : undefined)),
  ]);
  return replies[0].n + news[0].n;
}

