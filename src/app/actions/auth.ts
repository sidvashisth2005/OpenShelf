"use server";

import { redirect } from "next/navigation";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth/current-user";
import { destroyCurrentSession } from "@/server/auth/session";
import { login, signup } from "@/server/services/auth";
import type { ActionState } from "./types";

/** Only allow same-site relative redirects after login (no open redirect). */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await signup(Object.fromEntries(formData));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  if (result.pending) return { ok: true, message: "pending" };
  redirect("/?joined=1");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await login(Object.fromEntries(formData));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  const user = await getCurrentUser();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  redirect(isAdmin && !formData.get("next") ? "/admin" : safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await audit({ actor: user, action: "auth.logout", targetType: "user", targetId: user.id });
  await destroyCurrentSession();
  redirect("/");
}
