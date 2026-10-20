import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";

/** Invite links look like /join/<token>; the sign-up page validates the token. */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  if (await getCurrentUser()) redirect("/");
  redirect(`/signup?invite=${encodeURIComponent(token)}`);
}
