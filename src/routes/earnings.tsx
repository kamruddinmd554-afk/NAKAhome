import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { workerEarnings } from "@/lib/server/inbook";
import { CASH_LABEL, PAYOUT_LABEL } from "@/lib/status";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/earnings")({
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const q = useQuery({ queryKey: ["earnings"], queryFn: () => workerEarnings() });
  const data = q.data;

  return (
    <AppShell mode="worker">
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Earnings</h1>
        <p className="mt-1 text-sm text-muted">
          Worker net only. Admin marks payout Paid. No automatic bank transfer. Customer cash is separate.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs text-muted">Payout paid</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{inr(data?.collected ?? 0)}</p>
          </div>
          <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs text-muted">Payout pending</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{inr(data?.due ?? 0)}</p>
          </div>
        </div>
        <ul className="mt-5 flex flex-col gap-2">
          {(data?.jobs ?? []).map((j) => (
            <li key={j.id}>
              <Link
                to="/booking/$id"
                params={{ id: j.id }}
                className="flex items-center justify-between rounded-3xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]"
              >
                <span>
                  <span className="block font-medium">{j.skill_name}</span>
                  <span className="text-xs text-muted">
                    Worker net · {PAYOUT_LABEL[j.payout_status] ?? j.payout_status}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Customer cash {inr(j.customer_cash)} · {CASH_LABEL[j.payment_status] ?? j.payment_status}
                  </span>
                </span>
                <span className="tabular-nums">{inr(j.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
