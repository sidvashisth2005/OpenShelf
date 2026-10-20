import { File, FileText, Film, FolderOpen, Image as ImageIcon, Music } from "lucide-react";
import { fileKind } from "@/lib/file-types";

const STYLES = {
  image: { Icon: ImageIcon, cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  video: { Icon: Film, cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  audio: { Icon: Music, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  pdf: { Icon: FileText, cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
  text: { Icon: FileText, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  folder: { Icon: FolderOpen, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  other: { Icon: File, cls: "bg-zinc-500/10 text-zinc-500" },
} as const;

export function FileKindIcon({ mime }: { mime: string }) {
  const { Icon, cls } = STYLES[fileKind(mime)];
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${cls}`}>
      <Icon className="size-5" />
    </span>
  );
}
