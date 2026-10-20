"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // Clipboard API needs a secure context; fall back to a prompt the user can copy from.
          window.prompt("Copy this link:", value);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** A read-only link field with a copy button. */
export function CopyField({ value, hint }: { value: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <input readOnly value={value} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <CopyButton value={value} />
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
