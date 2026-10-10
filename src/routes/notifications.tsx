import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { listNotifications, markNotificationsRead } from "@/lib/server/inbook";
import { NOTIF_TYPE_LABEL } from "@/lib/status";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { me, refetchMe } = useMe();
  const mode = me?.profile.active_mode === "worker" ? "worker" : "customer";
  const q = useQuery({ queryKey: ["notifs"], queryFn: () => listNotifications(), refetchInterval: 8000 });

  return (
    <AppShell mode={mode}>
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="mt-1 text-xs text-muted">In-app only. No phone push, SMS or WhatsApp.</p>
          </div>
          <button
            type="button"
            className="text-xs text-muted"
            onClick={() =>
              void markNotificationsRead()
                .then(() => q.refetch())
                .then(() => refetchMe())
            }
          >
            Mark read
          </button>
        </div>
        {(q.data ?? []).length === 0 ? (
          <p className="mt-6 text-sm text-muted">No notifications yet.</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {q.data!.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]",
                  !n.read && "ring-1 ring-sage/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium tracking-wide text-muted">
                    {NOTIF_TYPE_LABEL[n.type] ?? n.type.replaceAll("_", " ")}
                  </p>
                  <p className="text-[11px] text-muted">{formatWhen(n.created_at)}</p>
                </div>
                <p className={cn("mt-1 text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</p>
                {n.body ? <p className="mt-1 text-sm text-muted">{n.body}</p> : null}
                <p className="mt-1 text-[11px] text-muted">{n.read ? "Read" : "Unread"}</p>
                {n.booking_id ? (
                  <Link
                    to="/booking/$id"
                    params={{ id: n.booking_id }}
                    className="mt-2 inline-block text-xs text-sage"
                  >
                    Open booking
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
