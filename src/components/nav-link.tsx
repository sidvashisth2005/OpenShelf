"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Link that highlights itself when its route (or a child route) is active. */
export function NavLink({
  href,
  children,
  exact = false,
  variant = "top",
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  variant?: "top" | "side";
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const base =
    variant === "top"
      ? "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition [&_svg]:size-4"
      : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition [&_svg]:size-4";
  const state = active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground";
  return (
    <Link href={href} className={`${base} ${state}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
