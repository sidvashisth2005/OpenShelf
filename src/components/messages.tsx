"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import type { ActionState } from "@/app/actions/types";
import { FieldError, FormError } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/** A message box that clears itself after a successful send. */
export function ComposeForm({
  action,
  placeholder,
  label = "Send",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  placeholder: string;
  label?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <FormError message={state?.error} />
      <textarea
        className="input min-h-24 resize-y"
        name="body"
        required
        maxLength={4000}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <FieldError message={state?.fieldErrors?.body} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Sending…"><Send /> {label}</SubmitButton>
      </div>
    </form>
  );
}
