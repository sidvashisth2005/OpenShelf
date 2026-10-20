"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Hourglass } from "lucide-react";
import { signupAction } from "@/app/actions/auth";
import { FieldError, FormError } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function SignupForm({
  notice,
  tosVersion,
  formToken,
  turnstileSiteKey,
  invite,
  submitLabel = "Create account",
}: {
  notice: React.ReactNode;
  tosVersion: string;
  formToken: string;
  turnstileSiteKey?: string;
  invite?: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(signupAction, undefined);
  const fe = state?.fieldErrors ?? {};

  if (state?.ok && state.message === "pending") {
    return (
      <div className="rounded-xl bg-surface-2/70 p-6 text-center">
        <Hourglass className="mx-auto mb-3 size-8 text-accent" />
        <p className="font-semibold">Request sent</p>
        <p className="mt-1 text-sm text-muted">
          The admin will review your request. Once it&apos;s approved, you can{" "}
          <Link className="link" href="/login">sign in</Link> with the email and password you just chose.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state?.error} />
      {invite && <input type="hidden" name="invite" value={invite} />}
      {/* Bot protection: a signed issue-time token and a honeypot humans never see. */}
      <input type="hidden" name="formToken" value={formToken} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={fe.email} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input className="input" id="username" name="username" autoComplete="username" placeholder="jane_doe" required minLength={3} maxLength={30} />
          <FieldError message={fe.username} />
        </div>
        <div>
          <label className="label" htmlFor="displayName">Display name</label>
          <input className="input" id="displayName" name="displayName" autoComplete="nickname" placeholder="Jane Doe" required maxLength={60} />
          <FieldError message={fe.displayName} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 10 characters" required minLength={10} />
        <FieldError message={fe.password} />
      </div>

      {notice}

      <div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 shrink-0 accent-(--accent)" required />
          <span>
            I have read and accept the{" "}
            <Link className="text-foreground underline underline-offset-2 hover:text-accent" href="/terms" target="_blank">Terms of Service</Link> and{" "}
            <Link className="text-foreground underline underline-offset-2 hover:text-accent" href="/privacy" target="_blank">Privacy Policy</Link>{" "}
            (v{tosVersion}), including the administrator access described above.
          </span>
        </label>
        <FieldError message={fe.acceptTerms} />
      </div>

      {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="auto" />}

      <SubmitButton block pendingText="Sending…">{submitLabel}</SubmitButton>
    </form>
  );
}
