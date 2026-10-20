"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { FieldError, FormError } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state?.error} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={state?.fieldErrors?.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        <FieldError message={state?.fieldErrors?.password} />
      </div>
      <SubmitButton block pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
