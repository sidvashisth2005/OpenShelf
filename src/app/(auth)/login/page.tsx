import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { strParam } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/current-user";
import { requireSetUp } from "@/server/services/server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await requireSetUp();
  if (await getCurrentUser()) redirect("/dashboard");
  const next = strParam((await searchParams).next);
  return (
    <AuthShell
      title="Welcome back"
      subtitle={<>New here? <Link className="link" href="/signup">Create an account</Link></>}
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
