import Link from "next/link";
import { Activity } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { AuditLog } from "@/server/db/schema";
import { EmptyState } from "../ui";

type Row = { entry: AuditLog; actorUsername: string | null };

function targetLink(e: AuditLog) {
  if (!e.targetId) return <span className="text-muted">—</span>;
  const short = e.targetId.slice(0, 8);
  if (e.targetType === "user") return <Link className="link font-mono text-xs" href={`/admin/users/${e.targetId}`}>user:{short}</Link>;
  if (e.targetType === "content") return <Link className="link font-mono text-xs" href={`/c/${e.targetId}`}>content:{short}</Link>;
  return <span className="font-mono text-xs">{short}</span>;
}

function actionTone(action: string) {
  if (action.endsWith("failed")) return "bg-red-500/10 text-red-700 dark:text-red-400";
  if (action.startsWith("admin.")) return "bg-accent-soft text-accent";
  if (action.startsWith("auth.")) return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
  if (action.includes("delete")) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300";
}

const formatValue = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** Compact key/value chips; long values are truncated with the full text on hover. */
function MetadataChips({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;
  return (
    <div className="flex max-w-xs flex-wrap gap-1">
      {entries.map(([k, v]) => {
        const value = formatValue(v);
        return (
          <span
            key={k}
            title={`${k}: ${value}`}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs"
          >
            <span className="text-muted">{k}</span>
            <span className="max-w-36 truncate font-medium">{value}</span>
          </span>
        );
      })}
    </div>
  );
}

export function AuditTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <EmptyState icon={Activity} title="No activity recorded" />;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Details</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry: e, actorUsername }) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap text-muted">{formatDate(e.createdAt)}</td>
                <td>
                  <span className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs whitespace-nowrap ${actionTone(e.action)}`}>
                    {e.action}
                  </span>
                </td>
                <td className="whitespace-nowrap">
                  {e.actorId ? (
                    <Link className="link" href={`/admin/users/${e.actorId}`}>@{actorUsername ?? e.actorId.slice(0, 8)}</Link>
                  ) : (
                    <span className="text-muted">anonymous</span>
                  )}
                </td>
                <td>{targetLink(e)}</td>
                <td className="min-w-56">
                  <MetadataChips metadata={e.metadata} />
                </td>
                <td className="font-mono text-xs whitespace-nowrap text-muted">{e.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
