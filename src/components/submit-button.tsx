"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  block = false,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
  block?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn btn-${variant} ${block ? "w-full py-2.5" : ""}`}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}
