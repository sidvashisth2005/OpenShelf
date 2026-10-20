import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Library } from "lucide-react";

export function Logo({ name }: { name: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-accent to-accent-2 text-white shadow-soft">
        <Library className="size-4.5" strokeWidth={2.25} />
      </span>
      <span className="text-[15px]">{name}</span>
    </Link>
  );
}

const AVATAR_TONES = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const tone = AVATAR_TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const dims = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-14 text-lg" }[size];
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full bg-linear-to-br font-semibold text-white ${tone} ${dims}`} aria-hidden>
      {initials || "?"}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1.5 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-8 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="size-6" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "accent",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: "accent" | "success" | "warn" | "danger" | "info";
}) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
    info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = "card p-4";
  return href ? (
    <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-lift`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Callout({
  tone,
  icon: Icon,
  children,
}: {
  tone: "warn" | "danger" | "info";
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const tones = {
    warn: "border-amber-500/30 bg-warn-bg text-warn-fg",
    danger: "border-danger/30 bg-danger/5 text-danger",
    info: "border-accent/25 bg-accent-soft/60 text-foreground",
  };
  return (
    <div role={tone === "info" ? "status" : "alert"} className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
