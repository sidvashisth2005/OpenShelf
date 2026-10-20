"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateContentAction } from "@/app/actions/content";
import { ContentFields } from "@/components/content-fields";
import { FormError } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function EditForm({
  id,
  defaults,
}: {
  id: string;
  defaults: { title: string; description: string; visibility: string; status: string };
}) {
  const [state, action] = useActionState(updateContentAction.bind(null, id), undefined);
  return (
    <form action={action} className="space-y-6">
      <FormError message={state?.error} />
      <ContentFields defaults={defaults} errors={state?.fieldErrors} />
      <div className="flex justify-end gap-2 border-t border-border pt-6">
        <Link className="btn btn-secondary" href={`/c/${id}`}>Cancel</Link>
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
