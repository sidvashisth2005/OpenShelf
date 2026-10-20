import "server-only";

/**
 * Minimal streaming ZIP writer ("stored", no compression) for "Download all".
 * Each entry is streamed once: its CRC-32 goes in a data descriptor after the data.
 * Folder posts are capped well below 4 GB, so ZIP64 isn't needed.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(crc: number, chunk: Uint8Array): number {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < chunk.length; i++) c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export type ZipEntry = { path: string; open: () => Promise<ReadableStream<Uint8Array> | null> };

export function zipStream(entries: ZipEntry[], modified = new Date()): ReadableStream<Uint8Array> {
  const it = zipChunks(entries, modified);
  // Pull-based, so a slow download never buffers the whole folder in memory.
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await it.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      await it.return(undefined);
    },
  });
}

async function* zipChunks(entries: ZipEntry[], modified: Date): AsyncGenerator<Uint8Array> {
  const { time, date } = dosDateTime(modified);
  const enc = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0;
  const out = (b: Uint8Array) => {
    offset += b.length;
    return b;
  };

  for (const entry of entries) {
    const name = enc.encode(entry.path);
    const headerOffset = offset;
    // Local file header. Flags: bit 3 = sizes/CRC follow in a data descriptor, bit 11 = UTF-8 names.
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0808, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint16(26, name.length, true);
    yield out(new Uint8Array(local.buffer));
    yield out(name);

    let crc = 0;
    let size = 0;
    const body = await entry.open();
    if (body) {
      const reader = body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          crc = crc32(crc, value);
          size += value.length;
          yield out(value);
        }
      } finally {
        // Closes the file if the download was aborted mid-entry.
        await reader.cancel().catch(() => {});
      }
    }

    const desc = new DataView(new ArrayBuffer(16));
    desc.setUint32(0, 0x08074b50, true);
    desc.setUint32(4, crc, true);
    desc.setUint32(8, size, true);
    desc.setUint32(12, size, true);
    yield out(new Uint8Array(desc.buffer));

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0808, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, headerOffset, true);
    central.push(new Uint8Array(cd.buffer), name);
  }

  const cdStart = offset;
  for (const part of central) yield out(part);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, offset - cdStart, true);
  end.setUint32(16, cdStart, true);
  yield out(new Uint8Array(end.buffer));
}
