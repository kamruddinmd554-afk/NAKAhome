import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMessages, listThreads, sendMessage } from "@/lib/server/inbook";
import { useMe } from "@/lib/use-me";

type Search = { thread?: string };

export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    thread: typeof s.thread === "string" ? s.thread : undefined,
  }),
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { thread: threadId } = Route.useSearch();
  const { user, me } = useMe();
  const qc = useQueryClient();
  const threads = useQuery({ queryKey: ["threads"], queryFn: () => listThreads() });
  const msgs = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listMessages({ data: { threadId: threadId! } }),
    enabled: Boolean(threadId),
    refetchInterval: 3000,
  });
  const [body, setBody] = useState("");
  const mode = me?.profile.active_mode === "worker" ? "worker" : "customer";

  if (threadId) {
    return (
      <AppShell mode={mode}>
        <div className="flex flex-1 flex-col px-4 pb-4 lg:px-5">
          <h1 className="font-display text-xl font-semibold">Chat</h1>
          <ul className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
            {(msgs.data ?? []).map((m) => (
              <li
                key={m.id}
                className={
                  m.sender_id === user?.id
                    ? "max-w-[80%] self-end rounded-2xl bg-accent px-3 py-2 text-sm text-accent-fg"
                    : "max-w-[80%] self-start rounded-2xl bg-raised px-3 py-2 text-sm"
                }
              >
                {m.body}
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = body.trim();
              if (!text) return;
              setBody("");
              void sendMessage({ data: { threadId, body: text } }).then(() =>
                qc.invalidateQueries({ queryKey: ["messages", threadId] }),
              );
            }}
          >
            <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" />
            <Button type="submit">Send</Button>
          </form>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell mode={mode}>
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Messages</h1>
        {(threads.data ?? []).length === 0 ? (
          <p className="mt-6 text-sm text-muted">No chats yet. Open Chat on a worker card.</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {(threads.data ?? []).map((t) => (
              <li key={t.id}>
                <Link
                  to="/messages"
                  search={{ thread: t.id }}
                  className="block rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]"
                >
                  <p className="text-sm font-medium">
                    {user?.id === t.customer_id ? t.worker_name : t.customer_name}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">{t.last_body ?? "No messages"}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
