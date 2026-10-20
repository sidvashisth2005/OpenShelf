import Link from "next/link";
import { File, FileText, Film, Image as ImageIcon, Music, type LucideIcon } from "lucide-react";
import { fileKind } from "@/lib/file-types";
import { formatBytes } from "@/lib/format";
import type { ContentWithOwner } from "@/server/services/content";
import { Badge } from "./badge";
import { Avatar } from "./ui";

const KINDS: Record<ReturnType<typeof fileKind>, { label: string; icon: LucideIcon; bg: string }> = {
  image: { label: "Image", icon: ImageIcon, bg: "from-sky-500/15 to-indigo-500/15 text-sky-600 dark:text-sky-400" },
  video: { label: "Video", icon: Film, bg: "from-rose-500/15 to-orange-500/15 text-rose-600 dark:text-rose-400" },
  audio: { label: "Audio", icon: Music, bg: "from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400" },
  pdf: { label: "PDF", icon: FileText, bg: "from-red-500/15 to-amber-500/15 text-red-600 dark:text-red-400" },
  text: { label: "Text", icon: FileText, bg: "from-violet-500/15 to-fuchsia-500/15 text-violet-600 dark:text-violet-400" },
  other: { label: "File", icon: File, bg: "from-zinc-500/15 to-zinc-400/15 text-zinc-500" },
};

export function ContentCard({ item, showStatus = false }: { item: ContentWithOwner; showStatus?: boolean }) {
  const kind = KINDS[fileKind(item.mimeType)];
  const Icon = kind.icon;
  const showImage = fileKind(item.mimeType) === "image" && item.status !== "removed";
  return (
    <Link
      href={`/c/${item.id}`}
      className="group card flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-linear-to-br ${kind.bg}`}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploads are served by our own route with access checks
          <img
            src={`/api/files/${item.id}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <Icon className="size-10 opacity-80" strokeWidth={1.5} />
        )}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          <Icon className="size-3" /> {kind.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 leading-snug font-semibold group-hover:text-accent">{item.title}</h3>
        {showStatus && (
          <div className="flex flex-wrap gap-1.5">
            <Badge value={item.status} />
            <Badge value={item.visibility} />
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 text-xs text-muted">
          <Avatar name={item.owner.displayName} size="sm" />
          <span className="truncate">@{item.owner.username}</span>
          <span className="ml-auto shrink-0 tabular-nums">{formatBytes(item.sizeBytes)}</span>
        </div>
      </div>
    </Link>
  );
}

export function ContentGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}
