import os from "node:os";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MonitorSmartphone } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { isSetUp } from "@/server/services/server";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Set up your server" };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export default async function SetupPage() {
  if (await isSetUp()) redirect("/");

  // Only the computer OpenShelf is installed on may claim the server.
  const host = ((await headers()).get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
  if (!LOCAL_HOSTS.has(host)) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <MonitorSmartphone className="mx-auto mb-4 size-10 text-accent" />
        <h1 className="text-xl font-semibold">This server isn&apos;t set up yet</h1>
        <p className="mt-2 text-sm text-muted">
          Open OpenShelf on the computer it&apos;s installed on to finish setting it up.
        </p>
      </div>
    );
  }

  const owner = os.userInfo().username;
  const suggested = owner ? `${owner.charAt(0).toUpperCase()}${owner.slice(1)}'s OpenShelf` : "My OpenShelf";
  return (
    <AuthShell
      title="Set up your server"
      subtitle="You installed OpenShelf on this PC, so you're its admin. Create your account to get started."
    >
      <SetupForm suggestedName={suggested.slice(0, 60)} />
    </AuthShell>
  );
}
