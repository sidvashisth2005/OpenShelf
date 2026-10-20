import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { ContentCard, ContentGrid } from "@/components/content-card";
import { Pagination } from "@/components/pagination";
import { Avatar, EmptyState } from "@/components/ui";
import { pageParam } from "@/lib/format";
import { listPublicByUsername, PAGE_SIZE } from "@/server/services/content";
import { getPublicProfile } from "@/server/services/users";

export default async function ProfilePage({ params, searchParams }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const page = pageParam((await searchParams).page);

  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const rows = await listPublicByUsername(profile.username, page);
  const items = rows.slice(0, PAGE_SIZE);
  return (
    <div>
      <section className="card relative mb-10 overflow-hidden">
        <div aria-hidden className="h-28 bg-linear-to-r from-violet-600 via-fuchsia-500 to-pink-500 opacity-90" />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-6">
          <div className="-mt-8 rounded-full ring-4 ring-surface">
            <Avatar name={profile.displayName} size="lg" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
            <p className="text-sm text-muted">@{profile.username}</p>
          </div>
        </div>
      </section>
      {items.length === 0 ? (
        <EmptyState icon={ImageOff} title="No public content yet" description={`@${profile.username} hasn't published anything publicly.`} />
      ) : (
        <ContentGrid>
          {items.map((item) => <ContentCard key={item.id} item={item} />)}
        </ContentGrid>
      )}
      <Pagination basePath={`/u/${profile.username}`} page={page} hasNext={rows.length > PAGE_SIZE} />
    </div>
  );
}
