import Link from "next/link";
import { Eye } from "lucide-react";
import { ADMIN_ACCESS_SUMMARY } from "@/lib/legal";

/** The disclosure users see right before giving consent. Neutral styling so it sits in the theme. */
export function AdminAccessNotice() {
  return (
    <div className="rounded-xl bg-surface-2/70 px-4 py-3 text-[13px] leading-5 text-muted">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Eye className="size-4 text-muted" /> Administrator access
      </p>
      <ul className="mt-1.5 ml-4 list-disc space-y-0.5 marker:text-muted/60">
        {ADMIN_ACCESS_SUMMARY.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2">
        Details in the{" "}
        <Link className="text-foreground underline underline-offset-2 hover:text-accent" href="/terms#admin-powers" target="_blank">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link className="text-foreground underline underline-offset-2 hover:text-accent" href="/privacy#admin-access" target="_blank">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
