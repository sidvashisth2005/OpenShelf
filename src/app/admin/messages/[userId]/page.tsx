import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { replyAction } from "@/app/actions/messages";
import { MessageThread } from "@/components/message-thread";
import { ComposeForm } from "@/components/messages";
import { EmptyState, PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/current-user";
import { openThreadForAdmin } from "@/server/services/messages";

export const metadata = { title: "Conversation" };

export default async function AdminThreadPage({ params }: PageProps<"/admin/messages/[userId]">) {
  const admin = await requirePermission("message:manage");
  const { userId } = await params;
  const data = await openThreadForAdmin(admin, userId);
  if (!data) notFound();
  const { member, thread } = data;

  return (
    <div className="space-y-6">
      <Link href="/admin/messages" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> All messages
      </Link>
      <PageHeader
        eyebrow="Conversation"
        title={member.displayName}
        description={<>@{member.username} · <Link className="link" href={`/admin/users/${member.id}`}>Member details</Link></>}
      />
      <section className="card space-y-5 p-5 sm:p-6">
        {thread.length ? (
          <MessageThread messages={thread} mine={(m) => !m.fromMember} />
        ) : (
          <EmptyState icon={MessageCircle} title="No messages yet" description={`Send ${member.displayName} the first message.`} />
        )}
        {member.status === "deleted" ? (
          <p className="text-sm text-muted">This account was deleted.</p>
        ) : (
          <ComposeForm action={replyAction.bind(null, member.id)} placeholder={`Reply to ${member.displayName}…`} label="Reply" />
        )}
      </section>
    </div>
  );
}
