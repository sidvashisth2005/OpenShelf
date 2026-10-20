import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Prev/next links that keep the other search params intact. */
export function Pagination({
  basePath,
  params,
  page,
  hasNext,
}: {
  basePath: string;
  params?: Record<string, string | undefined>;
  page: number;
  hasNext: boolean;
}) {
  if (page === 1 && !hasNext) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link className="btn btn-secondary" href={href(page - 1)}><ChevronLeft /> Previous</Link>
      ) : (
        <span />
      )}
      <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">Page {page}</span>
      {hasNext ? (
        <Link className="btn btn-secondary" href={href(page + 1)}>Next <ChevronRight /></Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
