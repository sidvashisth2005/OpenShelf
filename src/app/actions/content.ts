"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/server/auth/current-user";
import { deleteContent, moderateContent, updateContent } from "@/server/services/content";
import { runMutation, type ActionState } from "./types";

export async function updateContentAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runMutation(async () => updateContent(await assertPermission("content:update:own"), id, formData));
  if (!state?.ok) return state;
  revalidatePath(`/c/${id}`);
  redirect(`/c/${id}`);
}

export async function deleteContentAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runMutation(async () => deleteContent(await assertPermission(), id, String(formData.get("reason") ?? "")));
  if (!state?.ok) return state;
  redirect(formData.get("returnTo") === "admin" ? "/admin/content" : "/dashboard");
}

export async function moderateContentAction(
  id: string,
  action: "remove" | "restore",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const state = await runMutation(async () =>
    moderateContent(await assertPermission("content:moderate:any"), id, action, String(formData.get("reason") ?? "")),
  );
  if (state?.ok) revalidatePath(`/c/${id}`);
  return state;
}
