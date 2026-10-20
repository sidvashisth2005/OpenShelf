"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/server/auth/current-user";
import { adminUserAction } from "@/server/services/users";
import { runMutation, type ActionState } from "./types";

export async function userAction(
  id: string,
  action: "suspend" | "unsuspend" | "remove",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const state = await runMutation(async () =>
    adminUserAction(await assertPermission("user:read:any"), id, action, String(formData.get("reason") ?? "")),
  );
  if (state?.ok) {
    revalidatePath(`/admin/users/${id}`);
    revalidatePath("/admin/users");
  }
  return state;
}
