import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Compass, FolderOpen, LogOut, MessageCircle, ShieldCheck, Upload } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { NavLink } from "@/components/nav-link";
import { Avatar, Logo } from "@/components/ui";
import { env } from "@/lib/env";
import { hasPermission } from "@/lib/rbac";
import { getCurrentUser } from "@/server/auth/current-user";
import { unreadCount } from "@/server/services/messages";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateMetadata(): Metadata {
  const name = env().PLATFORM_NAME;
  return { title: { default: name, template: `%s · ${name}` }, description: `${name}: an open content platform.` };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const name = env().PLATFORM_NAME;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="border-t border-border bg-surface/50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-sm text-muted sm:px-6">
            <Logo name={name} />
            <nav className="flex flex-wrap gap-x-6 gap-y-2">
              <Link className="hover:text-foreground" href="/">Feed</Link>
              <Link className="hover:text-foreground" href="/terms">Terms of Service</Link>
              <Link className="hover:text-foreground" href="/privacy">Privacy Policy</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}

async function Header() {
  const user = await getCurrentUser();
  const isAdmin = hasPermission(user, "admin:dashboard");
  const unread = user ? await unreadCount(user) : 0;
  const messagesHref = hasPermission(user, "message:manage") ? "/admin/messages" : "/messages";
  const badge = unread > 0 && (
    <span className="rounded-full bg-accent px-1.5 py-px text-[11px] font-semibold text-accent-fg" aria-label={`${unread} unread`}>{unread}</span>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo name={env().PLATFORM_NAME} />
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          <NavLink href="/" exact><Compass /> Feed</NavLink>
          {user && <NavLink href="/dashboard"><FolderOpen /> My content</NavLink>}
          {user && <NavLink href={messagesHref}><MessageCircle /> Messages {badge}</NavLink>}
          {isAdmin && <NavLink href="/admin"><ShieldCheck /> Admin</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {hasPermission(user, "content:create") && (
                <Link className="btn btn-primary hidden sm:inline-flex" href="/upload"><Upload /> Upload</Link>
              )}
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium transition hover:bg-surface-2"
                title="Settings"
              >
                <Avatar name={user.displayName} />
                <span className="hidden max-w-32 truncate lg:inline">{user.displayName}</span>
              </Link>
              <form action={logoutAction}>
                <button className="btn btn-ghost px-2.5" type="submit" title="Sign out" aria-label="Sign out">
                  <LogOut />
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" href="/login">Sign in</Link>
              <Link className="btn btn-primary" href="/signup">Get started</Link>
            </>
          )}
        </div>
      </div>
      {/* Compact nav for small screens */}
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
        <NavLink href="/" exact><Compass /> Feed</NavLink>
        {user && <NavLink href="/dashboard"><FolderOpen /> Mine</NavLink>}
        {user && <NavLink href={messagesHref}><MessageCircle /> Messages {badge}</NavLink>}
        {user && hasPermission(user, "content:create") && <NavLink href="/upload"><Upload /> Upload</NavLink>}
        {isAdmin && <NavLink href="/admin"><ShieldCheck /> Admin</NavLink>}
      </nav>
    </header>
  );
}
