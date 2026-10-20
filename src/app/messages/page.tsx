import { redirect } from "next/navigation";
import { Megaphone, MessageCircle } from "lucide-react";
import { sendToAdminsAction } from "@/app/actions/messages";
import { AnnouncementList, MessageThread } from "@/components/message-thread";
import { ComposeForm } from "@/components/messages";
import { EmptyState, PageHeader } from "@/components/ui";
import { hasPermission } from "@/lib/rbac";
import { requireUser } from "@/server/auth/current-user";
import { openMemberInbox } from "@/server/services/messages";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser({ next: "/messages" });
  if (hasPermission(user, "message:manage")) redirect("/admin/messages");
  const { thread, announcements } = await openMemberInbox(user);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Messages" title="Talk to your admin" description="Only you and this server's admins can see this conversation." />

      {announcements.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Megaphone className="size-4 text-accent" /> Announcements</h2>
          <AnnouncementList items={announcements} />
        </section>
      )}

      <section className="card space-y-5 p-5 sm:p-6">
        {thread.length ? (
          <MessageThread messages={thread} mine={(m) => m.fromMember} />
        ) : (
          <EmptyState icon={MessageCircle} title="No messages yet" description="Ask a question or tell the admin something. They'll reply here." />
        )}
        <ComposeForm action={sendToAdminsAction} placeholder="Write a message to the admin…" />
      </section>
    </div>
  );
}
