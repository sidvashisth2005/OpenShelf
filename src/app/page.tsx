import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, Lock, ShieldCheck, Upload } from "lucide-react";
import { ContentCard, ContentGrid } from "@/components/content-card";
import { Pagination } from "@/components/pagination";
import { Callout, EmptyState } from "@/components/ui";
import { env } from "@/lib/env";
import { pageParam } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/current-user";
import { listPublicFeed, PAGE_SIZE } from "@/server/services/content";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const [rows, user] = await Promise.all([listPublicFeed(page), getCurrentUser()]);
  const items = rows.slice(0, PAGE_SIZE);
  const name = env().PLATFORM_NAME;

  return (
    <div className="space-y-6">
      {sp.account === "deleted" && (
        <Callout tone="info" icon={CheckCircle2}>Your account and all of your content have been deleted.</Callout>
      )}

      {!user && page === 1 && (
        // Compact on purpose: hero + the first row of content should fit on a laptop screen.
        <section className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-6 shadow-soft sm:px-8 sm:py-7">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                Share your work <span className="gradient-text">with the world</span>
              </h1>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Upload images, video, audio, documents and notes to {name}. Publish publicly, share by link, or keep
                them private.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn btn-primary" href="/signup">
                  Create free account <ArrowRight />
                </Link>
                <Link className="btn btn-secondary" href="/login">Sign in</Link>
              </div>
            </div>
            <ul className="grid shrink-0 gap-2 text-sm text-muted">
              <li className="flex items-center gap-2"><Upload className="size-4 text-accent" /> Up to {env().MAX_UPLOAD_MB} MB per file</li>
              <li className="flex items-center gap-2"><Lock className="size-4 text-accent" /> Public, unlisted or private</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-accent" /> Transparent moderation</li>
            </ul>
          </div>
        </section>
      )}

      <section id="explore" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1.5">Explore</p>
            <h2 className="page-title">Latest from the community</h2>
          </div>
          {user && (
            <Link className="btn btn-secondary" href="/upload"><Upload /> Share something</Link>
          )}
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="Nothing published yet"
            description="Be the first to share something with the community."
            action={<Link className="btn btn-primary" href={user ? "/upload" : "/signup"}><Upload /> Upload content</Link>}
          />
        ) : (
          <ContentGrid>
            {items.map((item) => <ContentCard key={item.id} item={item} />)}
          </ContentGrid>
        )}
        <Pagination basePath="/" page={page} hasNext={rows.length > PAGE_SIZE} />
      </section>
    </div>
  );
}
