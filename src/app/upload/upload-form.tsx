"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CloudUpload, Loader2, X } from "lucide-react";
import { ContentFields } from "@/components/content-fields";
import { FieldError, FormError } from "@/components/form-message";
import { ACCEPT_ATTR } from "@/lib/file-types";
import { formatBytes } from "@/lib/format";
import type { FieldErrors } from "@/lib/validation";

export function UploadForm({ maxMb }: { maxMb: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function pick(f: File | undefined) {
    if (!f) return;
    setFieldErrors((e) => ({ ...e, file: f.size > maxMb * 1024 * 1024 ? `Files can be at most ${maxMb} MB.` : undefined }));
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
    });
    // Keep the hidden input in sync so a plain form submit carries the file too.
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
    if (titleRef.current && !titleRef.current.value) {
      titleRef.current.value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 140);
    }
  }

  function clear() {
    setFile(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return undefined;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setFieldErrors({ file: "Choose a file to upload." });
    if (file.size > maxMb * 1024 * 1024) return setFieldErrors({ file: `Files can be at most ${maxMb} MB.` });
    setPending(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const res = await fetch("/api/content", { method: "POST", body: new FormData(e.currentTarget) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? (res.status === 413 ? "That file is too large." : "Upload failed."));
        setFieldErrors(body.fieldErrors ?? {});
        return;
      }
      router.push(`/c/${body.id}`);
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
        <input ref={inputRef} id="file" name="file" type="file" accept={ACCEPT_ATTR} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        {file ? (
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-2/60 p-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={preview} alt="" className="size-16 rounded-xl object-cover" />
            ) : (
              <span className="grid size-16 place-items-center rounded-xl bg-accent-soft text-accent">
                <CloudUpload className="size-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-sm text-muted">{formatBytes(file.size)} · {file.type || "unknown type"}</p>
            </div>
            <button type="button" onClick={clear} className="btn btn-ghost px-2" aria-label="Remove file"><X /></button>
          </div>
        ) : (
          <label
            htmlFor="file"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
            className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
              dragging ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:border-accent/50 hover:bg-surface-2/50"
            }`}
          >
            <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
              <CloudUpload className="size-7" />
            </span>
            <span className="font-medium">
              Drop a file here, or <span className="text-accent">browse</span>
            </span>
            <span className="mt-1.5 text-sm text-muted">
              Images, MP4/WebM video, audio, PDF or text/Markdown · up to {maxMb} MB
            </span>
          </label>
        )}
        <FieldError message={fieldErrors.file} />
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
