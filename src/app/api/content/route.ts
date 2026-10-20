import { NextResponse } from "next/server";
import { assertPermission, AuthError } from "@/server/auth/current-user";
import { createContent } from "@/server/services/content";

/**
 * Upload endpoint (multipart/form-data). A Route Handler rather than a Server
 * Action so large files aren't subject to the Server Action body limit.
 */
export async function POST(request: Request) {
  try {
    const user = await assertPermission("content:create");
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
