"use client";

import { useActionState } from "react";
import { DoorOpen, Lock, UserCheck, Wifi } from "lucide-react";
import { saveSettingsAction } from "@/app/actions/server";
import { FieldError, FormError, FormSuccess } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const MODES = [
  { value: "invite", label: "Invite only", hint: "Only people with an invite link can join.", Icon: Lock },
  { value: "approval", label: "Ask to join", hint: "Anyone can ask; you approve each request.", Icon: UserCheck },
  { value: "open", label: "Open", hint: "Anyone who can open your server can join.", Icon: DoorOpen },
] as const;

export function ServerSettingsForm({
  defaults,
  managed,
}: {
  defaults: { name: string; joinMode: string; lanEnabled: boolean };
  managed: boolean;
}) {
  const [state, action] = useActionState(saveSettingsAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-6">
      <FormError message={state?.error} />
      <div className="max-w-md">
        <label className="label" htmlFor="name">Server name</label>
        <input className="input" id="name" name="name" defaultValue={defaults.name} required maxLength={60} />
        <FieldError message={fe.name} />
      </div>

      <fieldset>
        <legend className="label">Who can join</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map(({ value, label, hint, Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-xl border border-border bg-surface p-3 shadow-soft transition hover:border-accent/40 has-checked:border-accent has-checked:bg-accent-soft/40 has-checked:ring-4 has-checked:ring-(--ring)"
            >
              <input type="radio" name="joinMode" value={value} defaultChecked={defaults.joinMode === value} className="sr-only" />
              <Icon className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft has-checked:border-accent">
        <input type="checkbox" name="lanEnabled" defaultChecked={defaults.lanEnabled} className="mt-1 size-4 shrink-0 accent-(--accent)" />
        <span>
          <span className="flex items-center gap-2 font-medium"><Wifi className="size-4 text-accent" /> Share on my Wi-Fi</span>
          <span className="mt-1 block text-sm text-muted">
            Lets phones and computers on the same Wi-Fi or office network open your server and use invite links. It&apos;s
            the fastest way to share, because files never leave your network.
            {managed
              ? " OpenShelf restarts in the background to apply this. Windows may ask once whether to allow it on private networks: choose Allow."
              : " When you run OpenShelf with npm run dev it is already reachable on your network."}
          </span>
        </span>
      </label>

      {state?.ok && <FormSuccess message="Settings saved." />}
      <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
    </form>
  );
}
