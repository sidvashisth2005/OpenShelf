import "server-only";
import type { FieldErrors } from "@/lib/validation";
import { AuthError } from "@/server/auth/current-user";
import type { MutationResult } from "@/server/services/content";

export type ActionState = { error?: string; fieldErrors?: FieldErrors; ok?: boolean; message?: string } | undefined;

/** Runs a service mutation and maps its result (or an auth failure) to form state. */
export async function runMutation(fn: () => Promise<MutationResult<unknown>>): Promise<ActionState> {
  try {
    const res = await fn();
    return res.ok ? { ok: true } : { error: res.error, fieldErrors: res.fieldErrors };
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }
}
