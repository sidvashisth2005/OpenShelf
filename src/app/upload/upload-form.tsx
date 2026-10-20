"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloudUpload, FileStack, FolderOpen, Loader2, X } from "lucide-react";
import { ContentFields } from "@/components/content-fields";
import { FieldError, FormError } from "@/components/form-message";
import {
  ACCEPT_ATTR,
  FOLDER_SIZE_FACTOR,
  isAllowedFileName,
  MAX_FILES_PER_POST,
  SKIPPED_FOLDERS,
} from "@/lib/file-types";
import { formatBytes } from "@/lib/format";
import type { FieldErrors } from "@/lib/validation";

/** A picked file and its path inside the picked folder ("project/src/app.js"), or just its name. */
type Entry = { file: File; path: string };

/** Walks folders dropped onto the page (the File System API browsers expose for drag and drop). */
async function entriesFromDrop(items: DataTransferItemList): Promise<Entry[]> {
  const out: Entry[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ file, path: prefix + entry.name });
    } else if (entry.isDirectory) {
      if (SKIPPED_FOLDERS.includes(entry.name)) return;
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns results in batches until it returns an empty one.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  const roots = [...items].map((i) => i.webkitGetAsEntry()).filter((e): e is FileSystemEntry => Boolean(e));
  for (const root of roots) await walk(root, "");
  return out;
}

export function UploadForm({ maxMb }: { maxMb: number }) {
  const router = useRouter();
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [preview, setPreview] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // React has no prop for the folder picker attribute.
  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const total = entries.reduce((n, e) => n + e.file.size, 0);
  const maxTotalMb = maxMb * FOLDER_SIZE_FACTOR;

  function sizeProblem(list: Entry[]): string | undefined {
    const big = list.find((e) => e.file.size > maxMb * 1024 * 1024);
    if (big) return `${big.path} is larger than ${maxMb} MB.`;
    if (list.length > MAX_FILES_PER_POST) return `Share at most ${MAX_FILES_PER_POST} files at once.`;
    if (list.length > 1 && list.reduce((n, e) => n + e.file.size, 0) > maxTotalMb * 1024 * 1024) {
      return `Files shared together can total at most ${maxTotalMb} MB.`;
    }
  }

  function pick(raw: Entry[]) {
    const skip: string[] = [];
    const kept = raw.filter((e) => {
      const inSkippedFolder = e.path.split("/").slice(0, -1).some((p) => SKIPPED_FOLDERS.includes(p));
      const ok = !inSkippedFolder && isAllowedFileName(e.file.name) && e.file.size > 0;
      if (!ok && !inSkippedFolder) skip.push(e.path);
      return ok;
    });
    setSkipped(skip);
    if (!kept.length) {
      setEntries([]);
      setFieldErrors({ file: raw.length ? "None of these files can be shared (unsupported types)." : "Choose a file to upload." });
      return;
    }
    setEntries(kept);
    setFieldErrors({ file: sizeProblem(kept) });
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return kept.length === 1 && kept[0].file.type.startsWith("image/") ? URL.createObjectURL(kept[0].file) : undefined;
    });
    if (titleRef.current && !titleRef.current.value) {
      const first = kept[0].path;
      const name = first.includes("/") ? first.split("/")[0] : kept.length > 1 ? `${kept.length} files` : first.replace(/\.[^.]+$/, "");
      titleRef.current.value = name.replace(/[-_]+/g, " ").slice(0, 140);
    }
  }

  function fromInput(list: FileList | null) {
    pick([...(list ?? [])].map((file) => ({ file, path: file.webkitRelativePath || file.name })));
  }

  function clear() {
    setEntries([]);
    setSkipped([]);
    setFieldErrors({});
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return undefined;
    });
    if (filesRef.current) filesRef.current.value = "";
    if (folderRef.current) folderRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!entries.length) return setFieldErrors({ file: "Choose a file to upload." });
    const problem = sizeProblem(entries);
    if (problem) return setFieldErrors({ file: problem });
    setPending(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const body = new FormData(e.currentTarget);
      for (const { file, path } of entries) {
        body.append("file", file, file.name);
        body.append("path", path);
      }
      const res = await fetch("/api/content", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? (res.status === 413 ? "That's too large to upload." : "Upload failed."));
        setFieldErrors(json.fieldErrors ?? {});
        return;
      }
      router.push(`/c/${json.id}`);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormError message={error} />
      <div>
        <input ref={filesRef} id="files" type="file" multiple accept={ACCEPT_ATTR} className="sr-only" onChange={(e) => fromInput(e.target.files)} />
        <input ref={folderRef} id="folder" type="file" multiple className="sr-only" onChange={(e) => fromInput(e.target.files)} />
        {entries.length ? (
          <div className="rounded-2xl border border-border bg-surface-2/60 p-4">
            <div className="flex items-center gap-4">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={preview} alt="" className="size-16 rounded-xl object-cover" />
              ) : (
                <span className="grid size-16 place-items-center rounded-xl bg-accent-soft text-accent">
                  {entries.length > 1 ? <FileStack className="size-6" /> : <CloudUpload className="size-6" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {entries.length === 1 ? entries[0].path : `${entries.length} files`}
                </p>
                <p className="text-sm text-muted">
                  {formatBytes(total)}
                  {entries.length === 1 && ` · ${entries[0].file.type || "text"}`}
                </p>
              </div>
              <button type="button" onClick={clear} className="btn btn-ghost px-2" aria-label="Remove files"><X /></button>
            </div>
            {entries.length > 1 && (
              <ul className="mt-3 max-h-48 space-y-0.5 overflow-auto border-t border-border pt-3 font-mono text-xs text-muted">
                {entries.map((e) => (
                  <li key={e.path} className="flex justify-between gap-3">
                    <span className="truncate">{e.path}</span>
                    <span className="shrink-0">{formatBytes(e.file.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragging(false);
              const items = e.dataTransfer.items;
              if (items?.length && typeof items[0].webkitGetAsEntry === "function") pick(await entriesFromDrop(items));
              else pick([...e.dataTransfer.files].map((file) => ({ file, path: file.name })));
            }}
            className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging ? "border-accent bg-accent-soft/50" : "border-border bg-surface"
            }`}
          >
            <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
              <CloudUpload className="size-7" />
            </span>
            <span className="font-medium">Drop files or a folder here</span>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <label htmlFor="files" className="btn btn-secondary cursor-pointer"><FileStack /> Choose files</label>
              <label htmlFor="folder" className="btn btn-secondary cursor-pointer"><FolderOpen /> Choose a folder</label>
            </div>
            <span className="mt-3 text-sm text-muted">
              Images, video, audio, PDF, text and code files · up to {maxMb} MB each, {MAX_FILES_PER_POST} files or {maxTotalMb} MB together
            </span>
          </div>
        )}
        <FieldError message={fieldErrors.file} />
        {skipped.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Skipped {skipped.length} unsupported file{skipped.length === 1 ? "" : "s"}: {skipped.slice(0, 5).join(", ")}
            {skipped.length > 5 && `, and ${skipped.length - 5} more`}.
          </p>
        )}
      </div>
      <ContentFields errors={fieldErrors} titleRef={titleRef} />
      <div className="flex justify-end gap-2 border-t border-border pt-6">
        <button type="submit" className="btn btn-primary px-6" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
