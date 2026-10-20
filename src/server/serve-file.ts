import "server-only";
import { fileKind } from "@/lib/file-types";
import { storage } from "@/server/storage";

const encodeName = (name: string) => encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);

/** Cache rule shared by every file response: non-public files must never sit in a shared cache. */
export const cacheControl = (isPublic: boolean) => (isPublic ? "public, max-age=60" : "private, no-store");

/** Streams one stored file with safe headers. The caller has already checked access. */
export async function serveStoredFile(opts: {
  storageKey: string;
  mimeType: string;
  fileName: string;
  isPublic: boolean;
  download: boolean;
}): Promise<Response> {
  const file = await storage().get(opts.storageKey);
  if (!file) return new Response("File missing", { status: 404 });

  const kind = fileKind(opts.mimeType);
  const inline = !opts.download && kind !== "other";
  const headers = new Headers({
    "Content-Type": kind === "text" ? `${opts.mimeType}; charset=utf-8` : opts.mimeType,
    "Content-Length": String(file.size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeName(opts.fileName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": cacheControl(opts.isPublic),
  });
  // Uploaded files run with no script privileges (the PDF viewer needs to be left alone).
  if (kind !== "pdf") headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'; media-src 'self'");
  return new Response(file.body, { headers });
}

export function attachmentHeaders(fileName: string, contentType: string, isPublic: boolean): Headers {
  return new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeName(fileName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": cacheControl(isPublic),
  });
}
