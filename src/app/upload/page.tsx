import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { env } from "@/lib/env";
import { hasPermission } from "@/lib/rbac";
import { requireUser } from "@/server/auth/current-user";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload" };

export default async function UploadPage() {
  const user = await requireUser({ next: "/upload" });
  if (!hasPermission(user, "content:create")) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="New upload" title="Share something" description="Add files or a whole folder, give it a title, and choose who can see it." />
      <div className="card p-6 sm:p-8">
        <UploadForm maxMb={env().MAX_UPLOAD_MB} />
      </div>
    </div>
  );
}
