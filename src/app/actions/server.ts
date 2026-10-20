"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/server/auth/current-user";
import { createInvite, decideJoinRequest, revokeInvite, setupServer, updateServerSettings } from "@/server/services/server";
import { connectToRemote, disconnectRemote } from "@/server/services/remote";
import { runMutation, type ActionState } from "./types";

export async function setupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await setupServer(Object.fromEntries(formData));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  redirect("/admin?welcome=1");
}

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runMutation(async () => updateServerSettings(await assertPermission("server:manage"), Object.fromEntries(formData)));
  if (state?.ok) revalidatePath("/", "layout");
  return state;
}

export async function createInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let token = "";
  const state = await runMutation(async () => {
    const res = await createInvite(await assertPermission("invite:manage"), Object.fromEntries(formData));
    if (res.ok) token = res.data.token;
    return res;
  });
  if (state?.ok) {
    revalidatePath("/admin/invites");
    return { ok: true, message: token };
  }
  return state;
}

export async function revokeInviteAction(id: string): Promise<ActionState> {
  const state = await runMutation(async () => revokeInvite(await assertPermission("invite:manage"), id));
  if (state?.ok) revalidatePath("/admin/invites");
  return state;
}

export async function decideJoinAction(id: string, approve: boolean): Promise<ActionState> {
  const state = await runMutation(async () => decideJoinRequest(await assertPermission("user:approve"), id, approve));
  if (state?.ok) {
    revalidatePath("/admin/requests");
    revalidatePath("/admin");
  }
  return state;
}

export async function joinRemoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await connectToRemote(Object.fromEntries(formData));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  redirect(result.data.joinUrl);
}

export async function leaveRemoteAction(): Promise<ActionState> {
  const state = await runMutation(disconnectRemote);
  if (state?.ok) revalidatePath("/setup");
  return state;
}
