import { Library, Search } from "lucide-react";
import { ContentCard, ContentGrid } from "@/components/content-card";
import { Pagination } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import { pageParam, strParam } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { adminListContent, PAGE_SIZE } from "@/server/services/content";

export const metadata = { title: "Content · Admin" };

export default async function AdminContentPage({ searchParams }: PageProps<"/admin/content">) {
  const admin = await requirePermission("content:read:any");
  const sp = await searchParams;
  const q = strParam(sp.q);
  const status = strParam(sp.status);
  const ownerId = strParam(sp.ownerId);
  const page = pageParam(sp.page);
  const { items, total } = await adminListContent(admin, { q, status, ownerId, page });

  return (
    <div>
      <PageHeader
        eyebrow="Moderation"
        title="All content"
        description={`${total} item${total === 1 ? "" : "s"}, including private, draft and removed. Opening a non-public item is logged.`}
      />
      <form className="card mb-6 flex flex-wrap gap-2 p-3" role="search">
        {ownerId && <input type="hidden" name="ownerId" value={ownerId} />}
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" name="q" placeholder="Search title, file name or username" defaultValue={q} />
        </div>
        <select className="input w-auto" name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="removed">Removed</option>
        </select>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>
      {items.length === 0 ? (
        <EmptyState icon={Library} title="No content matches" description="Try a different search or status filter." />
      ) : (
        <ContentGrid>
          {items.map((item) => <ContentCard key={item.id} item={item} showStatus />)}
        </ContentGrid>
      )}
      <Pagination basePath="/admin/content" params={{ q, status, ownerId }} page={page} hasNext={page * PAGE_SIZE < total} />
    </div>
  );
}
