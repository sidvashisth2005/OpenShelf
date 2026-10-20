import { Link2 } from "lucide-react";
import { Badge } from "@/components/badge";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { inviteState, listInvites, serverLinks } from "@/server/services/server";
import { CreateInviteForm, RevokeButton } from "./invite-forms";

export const metadata = { title: "Invite links · Admin" };

const TONE = { active: "good", revoked: "bad", expired: "neutral", "used up": "neutral" } as const;

export default async function InvitesPage() {
  const admin = await requirePermission("invite:manage");
  const [invites, links] = await Promise.all([listInvites(admin), serverLinks()]);
  // Same Wi-Fi first (fastest), then this PC.
  const bases = [
    ...links.lan.map((url) => ({ label: `On the same Wi-Fi (${new URL(url).hostname})`, url })),
    { label: "On this PC", url: links.local },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Members"
        title="Invite links"
        description="Send a link to people you want on your server. Anyone with an active link can join, even when the server is invite-only."
      />
      <section className="card p-6">
        <h2 className="mb-4 font-semibold">Create an invite link</h2>
        <CreateInviteForm bases={bases} lanEnabled={links.lanEnabled} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your links</h2>
        {invites.length === 0 ? (
          <EmptyState icon={Link2} title="No invite links yet" description="Create one above and share it." />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Status</th>
                    <th>Used</th>
                    <th>Expires</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invites.map((i) => {
                    const state = inviteState(i);
                    return (
                      <tr key={i.id}>
                        <td className="font-medium">{i.note || <span className="text-muted">Untitled</span>}</td>
                        <td><Badge value={state} tone={TONE[state]} /></td>
                        <td className="tabular-nums text-muted">{i.uses}{i.maxUses ? ` / ${i.maxUses}` : ""}</td>
                        <td className="whitespace-nowrap text-muted">{i.expiresAt ? formatDate(i.expiresAt) : "Never"}</td>
                        <td className="whitespace-nowrap text-muted">{formatDate(i.createdAt)}</td>
                        <td className="text-right">{state === "active" && <RevokeButton id={i.id} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
