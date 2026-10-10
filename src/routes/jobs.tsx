import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { listMyBookings } from "@/lib/server/inbook";
import { quoteFromWorkerRate } from "@/lib/pricing";
import { STATUS_LABEL } from "@/lib/status";
import { useMe } from "@/lib/use-me";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/jobs")({
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { user } = useMe();
  const q = useQuery({ queryKey: ["my-bookings"], queryFn: () => listMyBookings(), refetchInterval: 5000 });
  const [tab, setTab] = useState<"active" | "done">("active");
  const mine = (q.data ?? []).filter((b) => Boolean(b.my_status) || b.worker_id === user?.id);
  const rows = mine.filter((b) =>
    tab === "done" ? b.status === "completed" || b.status === "cancelled" : b.status !== "completed" && b.status !== "cancelled",
  );

  return (
    <AppShell mode="worker">
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-sm text-muted">Active and completed work. Amounts are your net, not customer cash.</p>
        <div className="mt-4 grid grid-cols-2 rounded-2xl bg-raised p-1">
          <button
            type="button"
            className={`h-11 rounded-xl text-sm font-medium ${tab === "active" ? "bg-surface" : "text-muted"}`}
            onClick={() => setTab("active")}
          >
            Active
          </button>
          <button
            type="button"
            className={`h-11 rounded-xl text-sm font-medium ${tab === "done" ? "bg-surface" : "text-muted"}`}
            onClick={() => setTab("done")}
          >
            Completed
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="mt-6 rounded-3xl bg-surface p-5 text-sm text-muted">
            {tab === "active"
              ? "No active jobs. Go available on Home to receive requests."
              : "No completed jobs yet."}
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {rows.map((b) => {
              let net = b.rate_amount;
              try {
                net = quoteFromWorkerRate(
                  b.unit_rate && b.unit_rate > 0 ? b.unit_rate : b.rate_amount,
                  b.rate_type,
                  b.duration_hours,
                  1,
                ).unitCharge;
              } catch {
                net = b.worker_charge && b.crew_size ? Math.round(b.worker_charge / b.crew_size) : b.rate_amount;
              }
              return (
                <li key={b.id}>
                  <Link
                    to="/booking/$id"
                    params={{ id: b.id }}
                    className="flex items-center justify-between rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]"
                  >
                    <span>
                      <span className="block text-sm font-medium">{b.customer_name}</span>
                      <span className="text-xs text-muted">
                        {b.skill_name} · {STATUS_LABEL[b.my_status || b.status] ?? b.status}
                        {b.crew_size > 1 ? ` · crew ${b.crew_size}` : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-display text-sm tabular-nums">{inr(net)}</span>
                      <span className="text-xs text-muted">your net</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
