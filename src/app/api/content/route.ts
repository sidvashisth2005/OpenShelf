import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { FOLDER_SIZE_FACTOR } from "@/lib/file-types";
import { assertPermission, AuthError } from "@/server/auth/current-user";
import { rateLimit } from "@/server/rate-limit";
import { createContent } from "@/server/services/content";

/** Same-origin only: browsers always send Origin on POST, and cross-site callers must not upload. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Upload endpoint (multipart/form-data). A Route Handler rather than a Server
 * Action so large files aren't subject to the Server Action body limit.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const user = await assertPermission("content:create");

    // Reject oversized bodies before buffering them (1 MB headroom for the form fields).
    // Several files shared together may total FOLDER_SIZE_FACTOR times the per-file limit;
    // createContent checks each file and the total precisely.
    const maxTotalMb = env().MAX_UPLOAD_MB * FOLDER_SIZE_FACTOR;
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > (maxTotalMb + 1) * 1024 * 1024) {
      return NextResponse.json({ error: `Uploads can total at most ${maxTotalMb} MB.` }, { status: 413 });
    }
    const limit = rateLimit(`upload:${user.id}`, 30, 60 * 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Upload limit reached (30 per hour). Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    const form = await request.formData();
    const res = await createContent(user, form);
    if (!res.ok) {
      return NextResponse.json({ error: res.error, fieldErrors: res.fieldErrors }, { status: res.status });
    }
    return NextResponse.json({ id: res.data.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof TypeError) return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
    throw err;
  }
}
