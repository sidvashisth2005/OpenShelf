"use client";

import { useActionState } from "react";
import { changePasswordAction, deleteAccountAction, updateProfileAction } from "@/app/actions/account";
import { FieldError, FormError, FormSuccess } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState(updateProfileAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <div>
        <label className="label" htmlFor="displayName">Display name</label>
        <input className="input" id="displayName" name="displayName" defaultValue={displayName} required maxLength={60} />
        <FieldError message={state?.fieldErrors?.displayName} />
      </div>
      {state?.ok && <FormSuccess message="Profile saved." />}
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3" key={state?.ok ? "done" : "form"}>
      <FormError message={state?.error} />
      <div>
        <label className="label" htmlFor="currentPassword">Current password</label>
        <input className="input" id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        <FieldError message={fe.currentPassword} />
      </div>
      <div>
        <label className="label" htmlFor="newPassword">New password</label>
        <input className="input" id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
        <FieldError message={fe.newPassword} />
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">Repeat new password</label>
        <input className="input" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        <FieldError message={fe.confirmPassword} />
      </div>
      {state?.ok && <FormSuccess message="Password changed. Your other sessions were signed out." />}
      <SubmitButton pendingText="Changing…">Change password</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm({ contentCount }: { contentCount: number }) {
  const [state, action] = useActionState(deleteAccountAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm">
        This permanently deletes your account and all {contentCount} of your uploads, including the files. Your
        username and profile are erased. Security logs are kept as described in the Privacy Policy. This can&apos;t
        be undone.
      </p>
      <FormError message={state?.error} />
      <div>
        <label className="label" htmlFor="deletePassword">Password</label>
        <input className="input" id="deletePassword" name="password" type="password" autoComplete="current-password" required />
        <FieldError message={fe.password} />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Type DELETE to confirm</label>
        <input className="input" id="confirm" name="confirm" required autoComplete="off" />
        <FieldError message={fe.confirm} />
      </div>
      <SubmitButton variant="danger" pendingText="Deleting…">Delete my account</SubmitButton>
    </form>
  );
}
