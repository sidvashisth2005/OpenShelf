import { formatDate } from "@/lib/format";
import type { ThreadMessage } from "@/server/services/messages";

/** Chat-style thread. `mine` decides which side a message sits on for the current viewer. */
export function MessageThread({ messages, mine }: { messages: ThreadMessage[]; mine: (m: ThreadMessage) => boolean }) {
  return (
    <ol className="space-y-3">
      {messages.map((m) => {
        const own = mine(m);
        return (
          <li key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                own ? "rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md border border-border bg-surface-2/70"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[11px] ${own ? "text-accent-fg/75" : "text-muted"}`}>
                {own ? "You" : (m.sender?.displayName ?? "Deleted user")} · {formatDate(m.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AnnouncementList({ items }: { items: ThreadMessage[] }) {
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="rounded-xl border border-accent/25 bg-accent-soft/30 px-4 py-3 text-sm">
          <p className="whitespace-pre-wrap break-words">{a.body}</p>
          <p className="mt-1 text-[11px] text-muted">{a.sender?.displayName ?? "Admin"} · {formatDate(a.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
