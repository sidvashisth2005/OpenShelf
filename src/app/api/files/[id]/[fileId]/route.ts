import { getCurrentUser } from "@/server/auth/current-user";
import { serveStoredFile } from "@/server/serve-file";
import { getContentForViewer, listContentFiles } from "@/server/services/content";

/** One file of a folder post, after the same visibility check as the post itself. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]/[fileId]">) {
  const { id, fileId } = await ctx.params;
  const viewer = await getCurrentUser();
  const directOpen = request.headers.get("sec-fetch-dest") === "document";
  const item = await getContentForViewer(viewer, id, { logAdminAccess: directOpen });
  if (!item) return new Response("Not found", { status: 404 });

  const file = (await listContentFiles(item.id)).find((f) => f.id === fileId);
  if (!file) return new Response("Not found", { status: 404 });

  return serveStoredFile({
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    fileName: file.path.slice(file.path.lastIndexOf("/") + 1),
    isPublic: item.status === "published" && item.visibility === "public",
    download: new URL(request.url).searchParams.has("download"),
  });
}
