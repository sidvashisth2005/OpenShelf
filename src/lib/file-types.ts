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

const ascii = (b: Uint8Array, at: number, s: string) => [...s].every((ch, i) => b[at + i] === ch.charCodeAt(0));
const bytes = (b: Uint8Array, at: number, seq: number[]) => seq.every((v, i) => b[at + i] === v);

/**
 * Checks the file's leading bytes ("magic numbers") against its claimed type,
 * so a renamed executable or script can't pass as an image/PDF/media file.
 * Text types must decode as UTF-8 and contain no NUL bytes.
 */
export function matchesSignature(mime: string, head: Uint8Array): boolean {
  switch (mime) {
    case "image/jpeg":
      return bytes(head, 0, [0xff, 0xd8, 0xff]);
    case "image/png":
      return bytes(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return ascii(head, 0, "GIF87a") || ascii(head, 0, "GIF89a");
    case "image/webp":
      return ascii(head, 0, "RIFF") && ascii(head, 8, "WEBP");
    case "image/avif":
      return ascii(head, 4, "ftyp") && (ascii(head, 8, "avif") || ascii(head, 8, "avis"));
    case "video/mp4":
      return ascii(head, 4, "ftyp");
    case "video/webm":
      return bytes(head, 0, [0x1a, 0x45, 0xdf, 0xa3]);
    case "audio/mpeg":
      return ascii(head, 0, "ID3") || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
    case "audio/ogg":
      return ascii(head, 0, "OggS");
    case "audio/wav":
      return ascii(head, 0, "RIFF") && ascii(head, 8, "WAVE");
    case "application/pdf":
      return ascii(head, 0, "%PDF-");
    case "text/plain":
    case "text/markdown": {
      if (head.includes(0)) return false;
      try {
        // Ignore a possibly truncated multi-byte sequence at the end of the sample.
        new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(0, Math.max(0, head.length - 3)));
        return true;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/** Value for an <input type="file" accept> attribute. */
export const ACCEPT_ATTR = Object.entries(ALLOWED_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)])
  .join(",");
