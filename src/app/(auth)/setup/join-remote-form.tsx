"use client";

import { useActionState } from "react";
import { LogIn, Undo2 } from "lucide-react";
import { joinRemoteAction, leaveRemoteAction } from "@/app/actions/server";
import { FieldError, FormError } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/** Lets a fresh install open a team's server instead of becoming one. */
export function JoinRemoteForm() {
  const [state, action] = useActionState(joinRemoteAction, undefined);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormError message={state?.error} />
      <div>
        <label className="label" htmlFor="inviteUrl">Invite link</label>
        <input
          className="input"
          id="inviteUrl"
          name="inviteUrl"
          type="url"
          required
          placeholder="http://192.168.1.20:4310/join/…"
          autoComplete="off"
        />
        <p className="hint">Ask the admin for their &quot;same Wi-Fi&quot; invite link. From then on, OpenShelf on this PC opens their server.</p>
        <FieldError message={state?.fieldErrors?.inviteUrl} />
      </div>
      <SubmitButton variant="secondary" block pendingText="Connecting…"><LogIn /> Join this server</SubmitButton>
    </form>
  );
}

export function LeaveRemoteForm() {
  const [state, action] = useActionState(leaveRemoteAction, undefined);
  return (
    <form action={action}>
      <FormError message={state?.error} />
      <SubmitButton variant="secondary" pendingText="Switching…"><Undo2 /> Use this PC as its own server instead</SubmitButton>
    </form>
  );
}
