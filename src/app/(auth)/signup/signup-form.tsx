"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { FieldError, FormError } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function SignupForm({ notice, tosVersion }: { notice: React.ReactNode; tosVersion: string }) {
  const [state, action] = useActionState(signupAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state?.error} />
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

      <SubmitButton block pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
