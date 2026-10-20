const tones = {
  neutral: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bad: "bg-red-500/10 text-red-700 dark:text-red-400",
  accent: "bg-accent-soft text-accent",
} as const;

const dots = {
  neutral: "bg-zinc-400",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  accent: "bg-accent",
} as const;

const TONE_FOR: Record<string, keyof typeof tones> = {
  public: "good",
  published: "good",
  active: "good",
  unlisted: "neutral",
  draft: "neutral",
  private: "warn",
  suspended: "warn",
  removed: "bad",
  deleted: "bad",
  super_admin: "accent",
};

const LABEL_FOR: Record<string, string> = { deleted: "removed", super_admin: "super admin" };

export function Badge({ value, tone }: { value: string; tone?: keyof typeof tones }) {
  const t = tone ?? TONE_FOR[value] ?? "neutral";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tones[t]}`}>
      <span className={`size-1.5 rounded-full ${dots[t]}`} />
      {LABEL_FOR[value] ?? value}
    </span>
  );
}
