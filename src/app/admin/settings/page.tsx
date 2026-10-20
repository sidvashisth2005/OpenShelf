import { Globe2, Wifi } from "lucide-react";
import { CopyField } from "@/components/copy-button";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/current-user";
import { requireSetUp, serverLinks } from "@/server/services/server";
import { ServerSettingsForm } from "./settings-form";

export const metadata = { title: "Server settings · Admin" };

export default async function ServerSettingsPage() {
  await requirePermission("server:manage");
  const [settings, links] = await Promise.all([requireSetUp(), serverLinks()]);
  const managed = Boolean(process.env.OPENSHELF_NETWORK_FILE);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Server" title="Server settings" description="Name your server, choose who can join, and share it on your network." />
      <section className="card p-6">
        <ServerSettingsForm
          defaults={{ name: settings.name, joinMode: settings.joinMode, lanEnabled: settings.lanEnabled }}
          managed={managed}
        />
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Wifi className="size-4 text-accent" /> Your server&apos;s addresses</h2>
        {links.lan.length > 0 ? (
          links.lan.map((url) => <CopyField key={url} value={url} hint="People on the same Wi-Fi can open this address." />)
        ) : (
          <p className="text-sm text-muted">
            {settings.lanEnabled
              ? "Wi-Fi sharing is on, but this PC isn't connected to a network right now."
              : "Turn on Share on my Wi-Fi to get an address that other devices can open."}
          </p>
        )}
        <CopyField value={links.local} hint="Works on this PC only." />
        <p className="flex items-start gap-2 rounded-xl bg-surface-2/70 p-3 text-sm text-muted">
          <Globe2 className="mt-0.5 size-4 shrink-0" />
          Sharing with people on other networks, over the internet, is coming next. Until then, they need to be on the
          same Wi-Fi as this PC.
        </p>
      </section>
    </div>
  );
}
