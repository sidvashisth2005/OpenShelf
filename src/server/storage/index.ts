import "server-only";
import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "@/lib/env";

/**
 * Storage abstraction. Content rows only store an opaque `storageKey`, so an
 * S3/R2/GCS driver can replace the local one without touching anything else.
 */
export interface StorageDriver {
  put(key: string, body: ReadableStream<Uint8Array>): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]{1,8}$/;

class LocalDiskStorage implements StorageDriver {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    // Keys are generated server-side, but never trust a path: validate and
    // make sure it can't escape the upload root.
    if (!KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Storage key escapes root");
    return full;
  }

  async put(key: string, body: ReadableStream<Uint8Array>): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    try {
      await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), createWriteStream(full, { flags: "wx" }));
    } catch (err) {
      await rm(full, { force: true });
      throw err;
    }
  }

  async get(key: string) {
    const full = this.resolve(key);
    try {
      const { size } = await stat(full);
      const body = Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>;
      return { body, size };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

let driver: StorageDriver | undefined;
export function storage(): StorageDriver {
  driver ??= new LocalDiskStorage(path.resolve(env().UPLOAD_DIR));
  return driver;
}
