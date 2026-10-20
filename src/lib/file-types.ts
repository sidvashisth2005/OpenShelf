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

/**
 * Source code and other text formats. Whatever type the browser claims, these are
 * stored and always served as text/plain (with nosniff and a sandbox CSP), so even
 * .html or .js files display as text and never run.
 */
export const CODE_EXTENSIONS: readonly string[] = [
  "js", "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx", "vue", "svelte", "astro",
  "html", "htm", "css", "scss", "sass", "less",
  "py", "ipynb", "rb", "php", "java", "kt", "kts", "scala", "groovy", "gradle", "go", "rs", "swift", "dart", "lua", "r", "pl",
  "c", "h", "cc", "cpp", "cxx", "hpp", "hh", "cs", "fs", "m", "mm",
  "sh", "bash", "zsh", "fish", "ps1", "psm1", "bat", "cmd",
  "sql", "graphql", "gql", "proto", "tf", "hcl",
  "json", "jsonc", "json5", "yaml", "yml", "toml", "ini", "cfg", "conf", "properties", "xml", "csv", "tsv", "log",
  "tex", "rst", "adoc", "diff", "patch", "lock",
];
/** Extensionless text files that are common in code folders. (.env files are left out: they hold secrets.) */
export const TEXT_FILE_NAMES: readonly string[] = [
  "dockerfile", "makefile", "license", "readme", "changelog", "procfile", "gemfile",
  ".gitignore", ".gitattributes", ".dockerignore", ".editorconfig", ".prettierrc", ".eslintrc", ".npmrc", ".nvmrc",
];

/** Most files one post may hold, e.g. a shared folder. */
export const MAX_FILES_PER_POST = 100;
/** A folder post may total this many times the per-file limit. */
export const FOLDER_SIZE_FACTOR = 4;
/** mimeType of a post that holds several files (a folder). */
export const FOLDER_MIME = "application/x-openshelf-folder";

/** Folders that are almost never meant to be shared (and are huge). */
export const SKIPPED_FOLDERS: readonly string[] = ["node_modules", ".git", ".next", "__pycache__", ".venv", "venv", "dist", "build", ".idea", ".vscode"];

export function fileKind(mime: string): "image" | "video" | "audio" | "pdf" | "text" | "folder" | "other" {
  if (mime === FOLDER_MIME) return "folder";
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
  const base = fileName.slice(fileName.lastIndexOf("/") + 1).toLowerCase();
  if (CODE_EXTENSIONS.includes(ext)) return { ext, mime: "text/plain" };
  if (TEXT_FILE_NAMES.includes(base)) return { ext: "txt", mime: "text/plain" };
  // Browsers send an empty or generic type for files they don't recognise (often .md):
  // then go by the extension. The contents are still checked against it (matchesSignature).
  const generic = !mime || mime === "application/octet-stream";
  const normalizedMime = generic ? (Object.entries(ALLOWED_TYPES).find(([, exts]) => exts.includes(ext))?.[0] ?? "") : mime;
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
export const ACCEPT_ATTR = [
  ...Object.entries(ALLOWED_TYPES).flatMap(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)]),
  ...CODE_EXTENSIONS.map((e) => `.${e}`),
].join(",");

/** Client-side pre-check, same rules as the server (which also checks contents). */
export function isAllowedFileName(fileName: string): boolean {
  const ext = extOf(fileName);
  const base = fileName.slice(fileName.lastIndexOf("/") + 1).toLowerCase();
  return CODE_EXTENSIONS.includes(ext) || TEXT_FILE_NAMES.includes(base) || Object.values(ALLOWED_TYPES).some((exts) => exts.includes(ext));
}

/**
 * Cleans a path from a folder upload ("project/src/app.js") for display. Returns null
 * for anything odd. Paths are only ever shown, never used to build storage paths.
 */
export function cleanUploadPath(raw: string, fallback: string): string | null {
  const parts = (raw || fallback).replaceAll("\\", "/").split("/").map((p) => p.trim()).filter((p) => p && p !== ".");
  if (!parts.length || parts.some((p) => p === ".." || p.length > 120 || /[\u0000-\u001f]/.test(p))) return null;
  const path = parts.join("/");
  return path.length <= 300 ? path : null;
}
