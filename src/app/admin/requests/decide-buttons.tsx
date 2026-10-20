"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { decideJoinAction } from "@/app/actions/server";
import type { ActionState } from "@/app/actions/types";
import { SubmitButton } from "@/components/submit-button";

export function DecideButtons({ id, name }: { id: string; name: string }) {
  const [approveState, approve] = useActionState<ActionState, FormData>(decideJoinAction.bind(null, id, true), undefined);
  const [rejectState, reject] = useActionState<ActionState, FormData>(decideJoinAction.bind(null, id, false), undefined);
  const error = approveState?.error ?? rejectState?.error;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={approve}>
        <SubmitButton pendingText="Approving…"><Check /> Approve</SubmitButton>
      </form>
      <form
        action={reject}
        onSubmit={(e) => {
          if (!window.confirm(`Reject ${name}'s request? Their sign-up will be deleted.`)) e.preventDefault();
        }}
      >
        <SubmitButton variant="danger" pendingText="Rejecting…"><X /> Reject</SubmitButton>
      </form>
      {error && <p className="field-error w-full text-right">{error}</p>}
    </div>
  );
}
