import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Download, ExternalLink, Eye, Gavel, Pencil, Settings2, Trash2 } from "lucide-react";
import { deleteContentAction, moderateContentAction } from "@/app/actions/content";
import { Badge } from "@/components/badge";
import { FileKindIcon } from "@/components/file-kind-icon";
import { ReasonActionForm } from "@/components/reason-action-form";
import { Avatar, Callout } from "@/components/ui";
import { fileKind } from "@/lib/file-types";
import { formatBytes, formatDate } from "@/lib/format";
import { can, hasPermission } from "@/lib/rbac";
import { getCurrentUser } from "@/server/auth/current-user";
import { getContentForViewer, type ContentWithOwner } from "@/server/services/content";
import { storage } from "@/server/storage";

export const metadata: Metadata = { title: "Content" };

const TEXT_PREVIEW_BYTES = 64 * 1024;

export default async function ContentPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const item = await getContentForViewer(viewer, id, { logAdminAccess: true });
  if (!item) notFound();

  const isOwner = viewer?.id === item.ownerId;
  const isModerator = hasPermission(viewer, "content:moderate:any");
  const isPublic = item.status === "published" && item.visibility !== "private" && item.owner.status === "active";
  const fileUrl = `/api/files/${item.id}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {item.status === "removed" && (
          <Callout tone="danger" icon={Ban}>
            This content was removed by a moderator{item.removedReason ? `: ${item.removedReason}` : "."}
          </Callout>
        )}
        {isModerator && !isOwner && !isPublic && (
          <Callout tone="warn" icon={Eye}>
            Admin view: this content isn&apos;t public. Your access has been recorded in the audit log.
          </Callout>
        )}
        <Preview item={item} fileUrl={fileUrl} />
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Badge value={item.status} />
            <Badge value={item.visibility} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight break-words">{item.title}</h1>
          <Link href={`/u/${item.owner.username}`} className="group mt-4 inline-flex items-center gap-3">
            <Avatar name={item.owner.displayName} />
            <span className="text-sm">
              <span className="block font-medium group-hover:text-accent">{item.owner.displayName}</span>
              <span className="block text-muted">@{item.owner.username} · {formatDate(item.createdAt)}</span>
            </span>
          </Link>
        </div>
        {item.description && (
          <p className="leading-7 whitespace-pre-wrap break-words text-foreground/85">{item.description}</p>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <FileKindIcon mime={item.mimeType} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" title={item.fileName}>{item.fileName}</p>
              <p className="text-xs text-muted">{item.mimeType} · {formatBytes(item.sizeBytes)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a className="btn btn-secondary" href={fileUrl} target="_blank" rel="noopener"><ExternalLink /> Open</a>
            <a className="btn btn-primary" href={`${fileUrl}?download`}><Download /> Download</a>
          </div>
        </div>

        {isOwner && (
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Settings2 className="size-4 text-muted" /> Manage</h2>
            {can(viewer, "update", item) && item.status !== "removed" && (
              <Link className="btn btn-secondary w-full" href={`/c/${item.id}/edit`}><Pencil /> Edit details</Link>
            )}
            <ReasonActionForm
              action={deleteContentAction.bind(null, item.id)}
              label="Delete permanently"
              icon={<Trash2 />}
              pendingText="Deleting…"
              variant="danger"
              block
              confirmText="Delete this content and its file permanently? This can't be undone."
            />
          </div>
        )}

        {isModerator && !isOwner && (
          <div className="card space-y-4 border-accent/30 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-accent"><Gavel className="size-4" /> Moderation</h2>
            <Link href={`/admin/users/${item.ownerId}`} className="flex items-center gap-3 rounded-xl bg-surface-2/60 p-3 text-sm transition hover:bg-surface-2">
              <Avatar name={item.owner.displayName} size="sm" />
              <span className="min-w-0 flex-1 truncate">@{item.owner.username}</span>
              <Badge value={item.owner.status} />
            </Link>
            {item.status === "removed" ? (
              <ReasonActionForm action={moderateContentAction.bind(null, item.id, "restore")} label="Restore" block successText="Restored." />
            ) : (
              <ReasonActionForm
                action={moderateContentAction.bind(null, item.id, "remove")}
                label="Remove from platform"
                icon={<Ban />}
                requireReason
                variant="danger"
                block
                successText="Removed."
              />
            )}
            {hasPermission(viewer, "content:delete:any") && (
              <details className="group text-sm">
                <summary className="cursor-pointer text-muted hover:text-foreground">Delete permanently…</summary>
                <div className="mt-3">
                  <ReasonActionForm
                    action={deleteContentAction.bind(null, item.id)}
                    label="Delete file and record"
                    icon={<Trash2 />}
                    requireReason
                    variant="danger"
                    block
                    hidden={{ returnTo: "admin" }}
                    confirmText="Permanently delete this content and its file? This can't be undone."
                  />
                </div>
              </details>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

async function Preview({ item, fileUrl }: { item: ContentWithOwner; fileUrl: string }) {
  const kind = fileKind(item.mimeType);
  const frame = "card flex items-center justify-center overflow-hidden bg-surface-2/60";
  switch (kind) {
    case "image":
      return (
        <div className={`${frame} p-2`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- served by our access-checked route */}
          <img src={fileUrl} alt={item.title} className="max-h-[70vh] w-auto rounded-xl" />
        </div>
      );
    case "video":
      return <video className="card max-h-[70vh] w-full bg-black" src={fileUrl} controls preload="metadata" />;
    case "audio":
      return (
        <div className={`${frame} flex-col gap-4 p-8`}>
          <FileKindIcon mime={item.mimeType} />
          <audio className="w-full" src={fileUrl} controls preload="metadata" />
        </div>
      );
    case "text":
      return (
        <pre className="card max-h-[70vh] overflow-auto p-6 font-mono text-sm leading-6 whitespace-pre-wrap">
          {await readTextPreview(item)}
        </pre>
      );
    default:
      return (
        <div className={`${frame} aspect-video flex-col gap-4`}>
          <FileKindIcon mime={item.mimeType} />
          <a className="btn btn-secondary" href={fileUrl} target="_blank" rel="noopener">
            <ExternalLink /> Open {kind === "pdf" ? "PDF" : "file"}
          </a>
        </div>
      );
  }
}

async function readTextPreview(item: ContentWithOwner): Promise<string> {
  const file = await storage().get(item.storageKey);
  if (!file) return "(file missing)";
  const reader = file.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < TEXT_PREVIEW_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel();
  const text = new TextDecoder().decode(Buffer.concat(chunks).subarray(0, TEXT_PREVIEW_BYTES));
  return size >= TEXT_PREVIEW_BYTES || file.size > TEXT_PREVIEW_BYTES ? `${text}\n\n… (preview truncated, download for the full file)` : text;
}
