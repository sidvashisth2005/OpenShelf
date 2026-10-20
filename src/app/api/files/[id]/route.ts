import { fileKind } from "@/lib/file-types";
import { getCurrentUser } from "@/server/auth/current-user";
import { getContentForViewer } from "@/server/services/content";
import { storage } from "@/server/storage";

/** Serves a stored file after the same visibility check as the content page. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser();

  // Embedded loads (an <img> on the content page) are already covered by the
  // page-view audit entry; log only direct opens and downloads here.
  const directOpen = request.headers.get("sec-fetch-dest") === "document";
  const item = await getContentForViewer(viewer, id, { logAdminAccess: directOpen });
  if (!item) return new Response("Not found", { status: 404 });

  const file = await storage().get(item.storageKey);
  if (!file) return new Response("File missing", { status: 404 });

  const kind = fileKind(item.mimeType);
  const download = new URL(request.url).searchParams.has("download");
  const inline = !download && kind !== "other";
  const encodedName = encodeURIComponent(item.fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
  const isPublic = item.status === "published" && item.visibility === "public";

  const headers = new Headers({
    "Content-Type": kind === "text" ? `${item.mimeType}; charset=utf-8` : item.mimeType,
    "Content-Length": String(file.size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
    "X-Content-Type-Options": "nosniff",
    // Non-public files must never sit in a shared cache.
    "Cache-Control": isPublic ? "public, max-age=60" : "private, no-store",
  });
  // Uploaded files run with no script privileges (the PDF viewer needs to be left alone).
  if (kind !== "pdf") headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'; media-src 'self'");

  return new Response(file.body, { headers });
}
