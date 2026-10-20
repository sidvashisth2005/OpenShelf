import { Eye, Lock, ShieldCheck, Upload } from "lucide-react";
import { env } from "@/lib/env";

/** Two-column frame for sign-in / sign-up: brand panel on large screens, form card always. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  const name = env().PLATFORM_NAME;
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-lift lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-8 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-24 -left-10 size-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <p className="relative text-sm font-medium text-white/80">{name}</p>
        <h2 className="relative mt-auto text-2xl leading-tight font-semibold">Your content, your rules, in the open.</h2>
        <ul className="relative mt-8 space-y-3 text-sm text-white/90">
          <li className="flex items-center gap-3"><Upload className="size-4" /> Upload images, video, audio and docs</li>
          <li className="flex items-center gap-3"><Lock className="size-4" /> Choose public, unlisted or private</li>
          <li className="flex items-center gap-3"><Eye className="size-4" /> Moderation powers disclosed up front</li>
          <li className="flex items-center gap-3"><ShieldCheck className="size-4" /> Passwords stored only as bcrypt hashes</li>
        </ul>
      </aside>
      <div className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
