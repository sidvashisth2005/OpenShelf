"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setupAction } from "@/app/actions/server";
import { FieldError, FormError } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function SetupForm({ suggestedName }: { suggestedName: string }) {
  const [state, action] = useActionState(setupAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state?.error} />
      <div>
        <label className="label" htmlFor="serverName">Server name</label>
        <input className="input" id="serverName" name="serverName" defaultValue={suggestedName} required maxLength={60} />
        <p className="hint">People see this name when you invite them.</p>
        <FieldError message={fe.serverName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="displayName">Your name</label>
          <input className="input" id="displayName" name="displayName" autoComplete="name" placeholder="Jane Doe" required maxLength={60} />
          <FieldError message={fe.displayName} />
        </div>
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input className="input" id="username" name="username" autoComplete="username" placeholder="jane_doe" required />
          <FieldError message={fe.username} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={fe.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 10 characters" required />
        <FieldError message={fe.password} />
      </div>
      <div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 shrink-0 accent-(--accent)" required />
          <span>
            I accept the{" "}
            <Link className="text-foreground underline underline-offset-2 hover:text-accent" href="/terms" target="_blank">Terms of Service</Link> and{" "}
            <Link className="text-foreground underline underline-offset-2 hover:text-accent" href="/privacy" target="_blank">Privacy Policy</Link>.
            As this server&apos;s admin, I&apos;ll use my access to members&apos; content responsibly.
          </span>
        </label>
        <FieldError message={fe.acceptTerms} />
      </div>
      <SubmitButton block pendingText="Creating your server…">Create my server</SubmitButton>
    </form>
  );
}
