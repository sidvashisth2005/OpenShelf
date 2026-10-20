"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/types";
import { FieldError, FormError, FormSuccess } from "./form-message";
import { SubmitButton } from "./submit-button";

/**
 * A small form for one privileged action (remove, restore, suspend…). When a
 * reason is required it is collected inline; it is stored and audit-logged.
 */
export function ReasonActionForm({
  action,
  label,
  icon,
  pendingText,
  requireReason = false,
  variant = "secondary",
  block = false,
  confirmText,
  hidden,
  successText,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  icon?: React.ReactNode;
  pendingText?: string;
  requireReason?: boolean;
  variant?: "primary" | "secondary" | "danger";
  block?: boolean;
  confirmText?: string;
  hidden?: Record<string, string>;
  successText?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="space-y-2"
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {requireReason && (
        <div>
          <input name="reason" className="input" placeholder="Reason (shown to the user and logged)" required minLength={3} maxLength={500} />
          <FieldError message={state?.fieldErrors?.reason} />
        </div>
      )}
      <FormError message={state?.error} />
      {state?.ok && <FormSuccess message={successText} />}
      <SubmitButton variant={variant} block={block} pendingText={pendingText}>
        {icon}
        {label}
      </SubmitButton>
    </form>
  );
}
