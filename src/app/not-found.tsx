import Link from "next/link";
import { Compass, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="mb-6 grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent">
        <SearchX className="size-8" />
      </span>
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link className="btn btn-primary mt-8" href="/"><Compass /> Back to Explore</Link>
    </div>
  );
}
