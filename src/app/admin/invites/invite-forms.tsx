"use client";

import { useActionState } from "react";
import { Link2 } from "lucide-react";
import { createInviteAction, revokeInviteAction } from "@/app/actions/server";
import type { ActionState } from "@/app/actions/types";
import { CopyField } from "@/components/copy-button";
import { FormError } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/** Creates an invite and shows its links once (only a hash of the token is stored). */
export function CreateInviteForm({ bases, lanEnabled }: { bases: { label: string; url: string }[]; lanEnabled: boolean }) {
  const [state, action] = useActionState(createInviteAction, undefined);
  const token = state?.ok ? state.message : undefined;
  return (
    <div className="space-y-5">
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="note">Label <span className="font-normal text-muted">(optional)</span></label>
          <input className="input" id="note" name="note" maxLength={80} placeholder="e.g. Family group" />
        </div>
        <div>
          <label className="label" htmlFor="maxUses">Can be used</label>
          <select className="input" id="maxUses" name="maxUses" defaultValue="0">
            <option value="1">Once</option>
            <option value="5">5 times</option>
            <option value="25">25 times</option>
            <option value="0">Unlimited</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="expiresInDays">Expires</label>
          <select className="input" id="expiresInDays" name="expiresInDays" defaultValue="7">
            <option value="1">In 1 day</option>
            <option value="7">In 7 days</option>
            <option value="30">In 30 days</option>
            <option value="0">Never</option>
          </select>
        </div>
        <SubmitButton pendingText="Creating…"><Link2 /> Create link</SubmitButton>
      </form>
      <FormError message={state?.error} />

      {token && (
        <div className="space-y-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
          <p className="text-sm font-semibold">Your invite link is ready. Copy it now: for security it won&apos;t be shown again.</p>
          {bases.map((b) => (
            <div key={b.url}>
              <p className="mb-1 text-xs font-medium text-muted">{b.label}</p>
              <CopyField value={`${b.url}/join/${token}`} />
            </div>
          ))}
          {!lanEnabled && (
            <p className="text-xs text-muted">
              Turn on <b>Share on my Wi-Fi</b> in Server settings so people on your network can open this link.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const [state, action] = useActionState<ActionState, FormData>(() => revokeInviteAction(id), undefined);
  return (
    <form action={action}>
      <button className="btn btn-danger btn-sm" type="submit">Revoke</button>
      {state?.error && <p className="field-error">{state.error}</p>}
    </form>
  );
}
