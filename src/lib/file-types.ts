/** Extension of a file name, lowercased, without the dot. */
function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

/**
 * Upload allowlist: MIME type -> allowed extensions. SVG and HTML are left out
 * on purpose: they can carry script, and this is a public upload host.
 */
export const ALLOWED_TYPES: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "audio/mpeg": ["mp3"],
  "audio/ogg": ["ogg", "oga"],
  "audio/wav": ["wav"],
  "application/pdf": ["pdf"],
  "text/plain": ["txt"],
  "text/markdown": ["md", "markdown"],
};

export function fileKind(mime: string): "image" | "video" | "audio" | "pdf" | "text" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/")) return "text";
  return "other";
}

/** Validates an upload's type; returns the normalized extension or an error message. */
export function checkUploadType(fileName: string, mime: string): { ext: string; mime: string } | { error: string } {
  const ext = extOf(fileName);
  // Browsers often send an empty type for .md files.
  const normalizedMime = mime || (ext === "md" || ext === "markdown" ? "text/markdown" : "");
  const exts = ALLOWED_TYPES[normalizedMime];
  if (!exts) return { error: `File type "${mime || "unknown"}" is not allowed.` };
  if (!exts.includes(ext)) return { error: `The .${ext || "?"} extension doesn't match the file type ${normalizedMime}.` };
  return { ext, mime: normalizedMime };
}

/** Value for an <input type="file" accept> attribute. */
export const ACCEPT_ATTR = Object.entries(ALLOWED_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)])
  .join(",");
