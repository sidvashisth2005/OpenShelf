"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/server/auth/current-user";
import { announce, replyToMember, sendToAdmins } from "@/server/services/messages";
import { runMutation, type ActionState } from "./types";

export async function sendToAdminsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runMutation(async () => sendToAdmins(await assertPermission(), Object.fromEntries(formData)));
  if (state?.ok) revalidatePath("/messages");
  return state;
}

export async function replyAction(memberId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runMutation(async () => replyToMember(await assertPermission("message:manage"), memberId, Object.fromEntries(formData)));
  if (state?.ok) revalidatePath(`/admin/messages/${memberId}`);
  return state;
}

export async function announceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runMutation(async () => announce(await assertPermission("message:manage"), Object.fromEntries(formData)));
  if (state?.ok) revalidatePath("/admin/messages");
  return state;
}
