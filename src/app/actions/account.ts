"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/server/auth/current-user";
import { changePassword, deleteOwnAccount, updateProfile } from "@/server/services/account";
import { runMutation, type ActionState } from "./types";

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runMutation(async () => updateProfile(await assertPermission(), Object.fromEntries(formData)));
  if (state?.ok) revalidatePath("/", "layout");
  return state;
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runMutation(async () => changePassword(await assertPermission(), Object.fromEntries(formData)));
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runMutation(async () => deleteOwnAccount(await assertPermission(), Object.fromEntries(formData)));
  if (!state?.ok) return state;
  redirect("/?account=deleted");
}
