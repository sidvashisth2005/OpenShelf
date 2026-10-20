import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/rbac";
import { requireUser } from "@/server/auth/current-user";
import { getContentForViewer } from "@/server/services/content";
import { EditForm } from "./edit-form";

export const metadata = { title: "Edit content" };

export default async function EditContentPage({ params }: PageProps<"/c/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser({ next: `/c/${id}/edit` });
  const item = await getContentForViewer(user, id, { logAdminAccess: false });
  if (!item || !can(user, "update", item) || item.status === "removed") notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Edit" title={item.title} description={`File: ${item.fileName}`} />
      <div className="card p-6 sm:p-8">
        <EditForm
          id={item.id}
          defaults={{ title: item.title, description: item.description, visibility: item.visibility, status: item.status }}
        />
      </div>
    </div>
  );
}
