import Link from "next/link";
import { AlertTriangle, Eye, FolderOpen, HardDrive, Layers, Upload, UserRound } from "lucide-react";
import { Badge } from "@/components/badge";
import { FileKindIcon } from "@/components/file-kind-icon";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { listOwn } from "@/server/services/content";

export const metadata = { title: "My content" };

export default async function DashboardPage() {
  const user = await requireUser({ next: "/dashboard" });
  const items = await listOwn(user);
  const totalBytes = items.reduce((n, i) => n + i.sizeBytes, 0);
  const publicCount = items.filter((i) => i.status === "published" && i.visibility === "public").length;
  const removedCount = items.filter((i) => i.status === "removed").length;

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title={`Hi, ${user.displayName.split(" ")[0]}`}
        description="Everything you've uploaded, in one place."
        actions={
          <>
            <Link className="btn btn-secondary" href={`/u/${user.username}`}><UserRound /> Public profile</Link>
            <Link className="btn btn-primary" href="/upload"><Upload /> Upload</Link>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Layers} label="Items" value={items.length} />
        <StatCard icon={Eye} label="Public" value={publicCount} tone="success" />
        <StatCard icon={HardDrive} label="Storage used" value={formatBytes(totalBytes)} tone="info" />
        <StatCard icon={AlertTriangle} label="Removed by moderators" value={removedCount} tone={removedCount ? "danger" : "warn"} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No uploads yet"
          description="Upload your first image, video, audio file, PDF or note."
          action={<Link className="btn btn-primary" href="/upload"><Upload /> Upload your first file</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Visibility</th>
                  <th className="text-right">Size</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="min-w-64">
                      <Link className="group flex items-center gap-3" href={`/c/${item.id}`}>
                        <FileKindIcon mime={item.mimeType} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:text-accent">{item.title}</span>
                          <span className="block truncate text-xs text-muted">{item.fileName}</span>
                        </span>
                      </Link>
                      {item.status === "removed" && item.removedReason && (
                        <p className="mt-1.5 text-xs text-danger">Removed by a moderator: {item.removedReason}</p>
                      )}
                    </td>
                    <td><Badge value={item.status} /></td>
                    <td><Badge value={item.visibility} /></td>
                    <td className="text-right text-muted tabular-nums">{formatBytes(item.sizeBytes)}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
