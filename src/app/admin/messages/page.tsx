import Link from "next/link";
import { Megaphone, MessageCircle } from "lucide-react";
import { announceAction } from "@/app/actions/messages";
import { AnnouncementList } from "@/components/message-thread";
import { ComposeForm } from "@/components/messages";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { listAnnouncements, listConversations } from "@/server/services/messages";

export const metadata = { title: "Messages" };

export default async function AdminMessagesPage() {
  const admin = await requirePermission("message:manage");
  const [conversations, announcements] = await Promise.all([listConversations(admin), listAnnouncements(5)]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Messages" description="Reply to members, or send an announcement everyone sees." />

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Megaphone className="size-4 text-accent" /> New announcement</h2>
        <ComposeForm action={announceAction} placeholder="Announcement for every member…" label="Announce" />
        {announcements.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm text-muted">Recent announcements</p>
            <AnnouncementList items={announcements} />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Conversations</h2>
        {conversations.length ? (
          <ul className="card divide-y divide-border overflow-hidden">
            {conversations.map((c) => (
              <li key={c.memberId}>
                <Link href={`/admin/messages/${c.memberId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/60">
                  <Avatar name={c.displayName} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {c.displayName} <span className="font-normal text-muted">@{c.username}</span>
                    </p>
                    <p className="truncate text-sm text-muted">{c.lastBody}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted">{formatDate(c.lastAt)}</p>
                    {c.unread > 0 && (
                      <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-fg">{c.unread} new</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MessageCircle}
            title="No conversations yet"
            description="When a member messages you, it shows up here. You can also start one from a member's page in Members."
          />
        )}
      </section>
    </div>
  );
}
