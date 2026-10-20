import { FOLDER_MIME } from "@/lib/file-types";
import { getCurrentUser } from "@/server/auth/current-user";
import { attachmentHeaders, serveStoredFile } from "@/server/serve-file";
import { getContentForViewer, listContentFiles } from "@/server/services/content";
import { storage } from "@/server/storage";
import { zipStream } from "@/server/zip";

/**
 * Serves a stored file after the same visibility check as the content page.
 * For a folder post it serves every file as one .zip ("Download all").
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser();

  // Embedded loads (an <img> on the content page) are already covered by the
  // page-view audit entry; log only direct opens and downloads here.
  const directOpen = request.headers.get("sec-fetch-dest") === "document";
  const item = await getContentForViewer(viewer, id, { logAdminAccess: directOpen });
  if (!item) return new Response("Not found", { status: 404 });
  const isPublic = item.status === "published" && item.visibility === "public";

  if (item.mimeType === FOLDER_MIME) {
    const files = await listContentFiles(item.id);
    const zip = zipStream(
      files.map((f) => ({ path: f.path, open: async () => (await storage().get(f.storageKey))?.body ?? null })),
      item.createdAt,
    );
    return new Response(zip, { headers: attachmentHeaders(`${item.fileName}.zip`, "application/zip", isPublic) });
  }

  return serveStoredFile({
    storageKey: item.storageKey,
    mimeType: item.mimeType,
    fileName: item.fileName,
    isPublic,
    download: new URL(request.url).searchParams.has("download"),
  });
}
