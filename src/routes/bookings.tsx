import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { listMyBookings } from "@/lib/server/inbook";
import { CASH_LABEL, STATUS_LABEL, isLiveStatus } from "@/lib/status";
import { useMe } from "@/lib/use-me";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/bookings")({
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { user } = useMe();
  const q = useQuery({ queryKey: ["my-bookings"], queryFn: () => listMyBookings(), refetchInterval: 5000 });
  const rows = (q.data ?? []).filter((b) => b.customer_id === user?.id);
  const live = rows.find((b) => isLiveStatus(b.status));

  return (
    <AppShell mode="customer">
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="mt-1 text-sm text-muted">Jobs you hired. Cash on site until recorded.</p>
        {live ? (
          <Link
            to="/booking/$id"
            params={{ id: live.id }}
            className="mt-4 flex items-center justify-between rounded-3xl bg-sage/15 px-4 py-3 text-sm"
          >
            <span>
              <span className="block font-medium">
                {(live.crew_size ?? 1) > 1 ? "Group Live Tracking" : "Live tracking"}
              </span>
              <span className="text-xs text-muted">
                {live.skill_name}
                {live.crew_size > 1 ? ` · ${live.accepted_count ?? 0} of ${live.crew_size} accepted` : ""}
              </span>
            </span>
            <span className="text-xs text-sage">Open</span>
          </Link>
        ) : null}
        {q.isLoading ? (
          <p className="mt-6 text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 rounded-3xl bg-surface p-5 text-sm text-muted">No bookings yet.</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {rows.map((b) => (
              <li key={b.id}>
                <Link
                  to="/booking/$id"
                  params={{ id: b.id }}
                  className="flex items-center justify-between rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]"
                >
                  <span>
                    <span className="block text-sm font-medium">{b.skill_name}</span>
                    <span className="text-xs text-muted">
                      {STATUS_LABEL[b.status] ?? b.status}
                      {b.crew_size > 1 ? ` · ${b.accepted_count ?? 0} of ${b.crew_size} accepted` : ""}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      Cash on Site · {CASH_LABEL[b.payment_status] ?? b.payment_status}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-sm tabular-nums">{inr(b.total)}</span>
                    <span className="text-xs text-muted">{b.work_date}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
