import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  adminListBookings,
  adminListDocuments,
  adminListPayments,
  adminListPayouts,
  adminListReports,
  adminListUsers,
  adminListWorkers,
  adminOverview,
  adminSetDocument,
  adminSetPayout,
  adminSetWorker,
  adminSuspendUser,
  adminListSkills,
  adminSetSkillStatus,
  adminMarkCashPaid,
  markCashCollected,
} from "@/lib/server/inbook";
import { CASH_LABEL, PAY_METHOD_LABEL, PAYOUT_LABEL, STATUS_LABEL } from "@/lib/status";
import { isKycApproved, kycKindLabel, kycLabel, KYC_PENDING, KYC_REJECTED, KYC_VERIFIED } from "@/lib/kyc";
import { useMe } from "@/lib/use-me";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { me, meLoading } = useMe();
  const qc = useQueryClient();
  const enabled = Boolean(me?.profile.is_admin);
  const ov = useQuery({ queryKey: ["admin-ov"], queryFn: () => adminOverview(), enabled });
  const workers = useQuery({ queryKey: ["admin-workers"], queryFn: () => adminListWorkers(), enabled });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => adminListUsers(), enabled });
  const bookings = useQuery({ queryKey: ["admin-bookings"], queryFn: () => adminListBookings(), enabled });
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: () => adminListReports(), enabled });
  const payments = useQuery({ queryKey: ["admin-pay"], queryFn: () => adminListPayments(), enabled });
  const payouts = useQuery({ queryKey: ["admin-payouts"], queryFn: () => adminListPayouts(), enabled });
  const docs = useQuery({ queryKey: ["admin-docs"], queryFn: () => adminListDocuments(), enabled });
  const catalog = useQuery({ queryKey: ["admin-skills"], queryFn: () => adminListSkills(), enabled });

  if (meLoading) return <main className="min-h-dvh bg-bg p-6 text-fg">Loading…</main>;
  if (!me?.profile.is_admin) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg p-6 text-fg">
        <p className="text-sm text-muted">Admin access required. The first signed-in account becomes admin.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-6 text-fg">
      <div className="mx-auto max-w-3xl">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-semibold">Admin</h1>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat k="Users" v={String(ov.data?.users ?? 0)} />
          <Stat k="Workers" v={String(ov.data?.workers ?? 0)} />
          <Stat k="Bookings" v={String(ov.data?.bookings ?? 0)} />
          <Stat k="Earnings" v={inr(ov.data?.collected ?? 0)} />
          <Stat k="Reports" v={String(ov.data?.reports ?? 0)} />
          <Stat k="KYC pending" v={String(ov.data?.pendingKyc ?? 0)} />
        </div>
        <h2 className="mt-8 font-display text-sm font-medium">Workers</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {(workers.data ?? []).map((w) => (
            <li key={w.user_id} className="rounded-3xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
              <p className="font-medium">{w.name}</p>
              <p className="text-xs text-muted">
                {w.phone || "no phone"} · {w.approved ? "listed" : "not listed"} · {kycLabel(w.id_verification_status)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {w.id_verification_status === KYC_PENDING ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const doc = (docs.data ?? []).find((d) => d.worker_id === w.user_id && d.status === KYC_PENDING);
                      if (!doc) {
                        toast("No pending ID document for this worker.");
                        return;
                      }
                      void adminSetDocument({ data: { id: doc.id, status: KYC_VERIFIED } })
                        .then(() => {
                          toast("KYC Approved. Worker can now go available.");
                          void qc.invalidateQueries({ queryKey: ["admin-docs"] });
                          void qc.invalidateQueries({ queryKey: ["admin-workers"] });
                          void qc.invalidateQueries({ queryKey: ["admin-ov"] });
                          void qc.invalidateQueries({ queryKey: ["me"] });
                        })
                        .catch((e: Error) => toast(e.message));
                    }}
                  >
                    Approve KYC
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void adminSetWorker({ data: { userId: w.user_id, approved: !w.approved } }).then(() =>
                      qc.invalidateQueries({ queryKey: ["admin-workers"] }),
                    )
                  }
                >
                  {w.approved ? "Unlist worker" : "List worker"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void adminSetWorker({
                      data: { userId: w.user_id, verificationStatus: "verified" },
                    }).then(() => qc.invalidateQueries({ queryKey: ["admin-workers"] }))
                  }
                >
                  Mark profile checked
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminSetWorker({ data: { userId: w.user_id, suspended: !w.suspended } }).then(() =>
                      qc.invalidateQueries({ queryKey: ["admin-workers"] }),
                    )
                  }
                >
                  {w.suspended ? "Unsuspend" : "Suspend"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <h2 className="mt-8 font-display text-sm font-medium">KYC documents</h2>
        <p className="mt-1 text-xs text-muted">
          Review the submitted government ID. Approve or reject manually — NAKA HOME never auto-verifies Aadhaar.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {(docs.data ?? []).length === 0 ? (
            <li className="rounded-3xl bg-surface p-4 text-sm text-muted">No KYC documents submitted yet.</li>
          ) : (
            [...(docs.data ?? [])]
              .sort((a, b) => {
                const rank = (s: string) => (s === KYC_PENDING ? 0 : isKycApproved(s) ? 2 : 1);
                return rank(a.status) - rank(b.status);
              })
              .map((d) => (
                <li key={d.id} className="rounded-3xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
                  <p className="font-medium">
                    {d.name} · {kycKindLabel(d.kind)}
                  </p>
                  <p className="mt-1 text-xs text-muted">{kycLabel(d.status)}</p>
                  {d.data_url ? (
                    <a href={d.data_url} target="_blank" rel="noreferrer" className="mt-2 block">
                      <img src={d.data_url} alt="Submitted ID" className="mt-2 max-h-56 w-full rounded-xl object-contain bg-raised" />
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-muted">Document image missing.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void adminSetDocument({ data: { id: d.id, status: KYC_VERIFIED } })
                          .then(() => {
                            toast("KYC Approved. Worker can now go available.");
                            void qc.invalidateQueries({ queryKey: ["admin-docs"] });
                            void qc.invalidateQueries({ queryKey: ["admin-workers"] });
                            void qc.invalidateQueries({ queryKey: ["admin-ov"] });
                            void qc.invalidateQueries({ queryKey: ["me"] });
                          })
                          .catch((e: Error) => toast(e.message))
                      }
                    >
                      Approve KYC
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void adminSetDocument({ data: { id: d.id, status: KYC_REJECTED } })
                          .then(() => {
                            toast("KYC Rejected. Worker stays private.");
                            void qc.invalidateQueries({ queryKey: ["admin-docs"] });
                            void qc.invalidateQueries({ queryKey: ["admin-workers"] });
                            void qc.invalidateQueries({ queryKey: ["admin-ov"] });
                            void qc.invalidateQueries({ queryKey: ["me"] });
                          })
                          .catch((e: Error) => toast(e.message))
                      }
                    >
                      Reject KYC
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void adminSetDocument({ data: { id: d.id, status: KYC_PENDING } })
                          .then(() => {
                            toast("Requested resubmission.");
                            void qc.invalidateQueries({ queryKey: ["admin-docs"] });
                            void qc.invalidateQueries({ queryKey: ["admin-workers"] });
                            void qc.invalidateQueries({ queryKey: ["me"] });
                          })
                          .catch((e: Error) => toast(e.message))
                      }
                    >
                      Request resubmit
                    </Button>
                  </div>
                </li>
              ))
          )}
        </ul>
        <h2 className="mt-8 font-display text-sm font-medium">Users</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {(users.data ?? []).map((u) => (
            <li key={u.user_id} className="flex items-center justify-between rounded-3xl bg-surface p-4 text-sm">
              <span>
                {u.name || u.user_id}
                <span className="block text-xs text-muted">
                  {u.phone} {u.is_admin ? "· admin" : ""} {u.suspended ? "· suspended" : ""}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void adminSuspendUser({ data: { userId: u.user_id, suspended: !u.suspended } }).then(() =>
                    qc.invalidateQueries({ queryKey: ["admin-users"] }),
                  )
                }
              >
                {u.suspended ? "Restore" : "Suspend"}
              </Button>
            </li>
          ))}
        </ul>
        <h2 className="mt-8 font-display text-sm font-medium">Bookings</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {(bookings.data ?? []).map((b) => (
            <li key={b.id} className="rounded-3xl bg-surface p-4 text-sm">
              <p>
                {b.skill_name} · {STATUS_LABEL[b.status] ?? b.status} · {b.crew_size} worker
                {b.crew_size === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Customer cash {inr(b.total)} · {PAY_METHOD_LABEL[b.payment_method] ?? "Cash on Site"} ·{" "}
                {CASH_LABEL[b.payment_status] ?? b.payment_status}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {b.payment_status === "due" || b.payment_status === "pending" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void markCashCollected({ data: { id: b.id } })
                        .then(() => {
                          toast("Cash collected recorded.");
                          void qc.invalidateQueries({ queryKey: ["admin-bookings"] });
                          void qc.invalidateQueries({ queryKey: ["admin-pay"] });
                        })
                        .catch((e: Error) => toast(e.message))
                    }
                  >
                    Record cash collected
                  </Button>
                ) : null}
                {b.payment_status === "collected" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void adminMarkCashPaid({ data: { bookingId: b.id } })
                        .then(() => {
                          toast("Marked Paid. No gateway.");
                          void qc.invalidateQueries({ queryKey: ["admin-bookings"] });
                          void qc.invalidateQueries({ queryKey: ["admin-pay"] });
                        })
                        .catch((e: Error) => toast(e.message))
                    }
                  >
                    Mark cash Paid
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <h2 className="mt-8 font-display text-sm font-medium">Cash payments</h2>
        <p className="mt-1 text-xs text-muted">
          Cash on Site only. Status stays Pending until cash is recorded. Paid is manual — no Razorpay/UPI.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {(payments.data ?? []).map((p) => (
            <li key={p.id} className="rounded-3xl bg-surface p-4 text-sm">
              <p>
                {inr(p.cash_amount || p.amount)} · {PAY_METHOD_LABEL[p.method] ?? "Cash on Site"} ·{" "}
                {CASH_LABEL[p.status] ?? p.status}
              </p>
              <p className="mt-1 text-xs text-muted">
                Booking {p.booking_id} · Customer cash {inr(p.gross || p.amount)} · Commission {inr(p.commission ?? 0)} ·
                Worker net {inr(p.worker_payout ?? 0)}
              </p>
              {p.collected_at ? (
                <p className="mt-1 text-xs text-muted">Recorded {new Date(p.collected_at).toLocaleString("en-IN")}</p>
              ) : null}
              <span className="mt-1 block text-xs text-muted">{p.note}</span>
              {p.status === "collected" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() =>
                    void adminMarkCashPaid({ data: { bookingId: p.booking_id } })
                      .then(() => {
                        toast("Marked Paid.");
                        void qc.invalidateQueries({ queryKey: ["admin-pay"] });
                        void qc.invalidateQueries({ queryKey: ["admin-bookings"] });
                      })
                      .catch((e: Error) => toast(e.message))
                  }
                >
                  Mark Paid
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <h2 className="mt-8 font-display text-sm font-medium">Worker payouts</h2>
        <p className="mt-1 text-xs text-muted">
          Manual only. Customer cash and worker net are separate. Do not treat the customer total as the worker payout.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {(payouts.data ?? []).length === 0 ? (
            <li className="rounded-3xl bg-surface p-4 text-sm text-muted">No worker payouts yet. Created when a worker completes a job.</li>
          ) : (
            (payouts.data ?? []).map((p) => (
              <li key={p.id} className="rounded-3xl bg-surface p-4 text-sm">
                <p className="font-medium">
                  {p.worker_name || p.worker_id} · {inr(p.amount)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Booking {p.booking_id} · {PAYOUT_LABEL[p.status] ?? p.status}
                  {p.paid_at ? ` · ${new Date(p.paid_at).toLocaleString("en-IN")}` : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  {p.status !== "paid" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void adminSetPayout({ data: { id: p.id, status: "paid" } })
                          .then(() => {
                            toast("Payout marked Paid. No bank transfer.");
                            void qc.invalidateQueries({ queryKey: ["admin-payouts"] });
                          })
                          .catch((e: Error) => toast(e.message))
                      }
                    >
                      Mark payout Paid
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void adminSetPayout({ data: { id: p.id, status: "pending" } })
                          .then(() => {
                            toast("Payout set back to Pending.");
                            void qc.invalidateQueries({ queryKey: ["admin-payouts"] });
                          })
                          .catch((e: Error) => toast(e.message))
                      }
                    >
                      Mark pending
                    </Button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
        <h2 className="mt-8 font-display text-sm font-medium">Pending skills</h2>
        <p className="mt-1 text-xs text-muted">Worker-submitted trades. Approve before customers can book them.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {(catalog.data ?? []).filter((s) => s.status === "pending").length === 0 ? (
            <li className="text-sm text-muted">No pending skills.</li>
          ) : (
            (catalog.data ?? [])
              .filter((s) => s.status === "pending")
              .map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted">{s.hindi || s.category_id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void adminSetSkillStatus({ data: { id: s.id, status: "approved" } }).then(() =>
                          qc.invalidateQueries({ queryKey: ["admin-skills"] }),
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void adminSetSkillStatus({ data: { id: s.id, status: "rejected" } }).then(() =>
                          qc.invalidateQueries({ queryKey: ["admin-skills"] }),
                        )
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))
          )}
        </ul>
        <h2 className="mt-8 font-display text-sm font-medium">Complaints</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {(reports.data ?? []).map((r) => (
            <li key={r.id} className="rounded-3xl bg-surface p-4 text-sm">
              {r.reason}
              <span className="block text-xs text-muted">
                {r.reporter_id} → {r.target_user_id}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-3xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <p className="text-xs text-muted">{k}</p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums">{v}</p>
    </div>
  );
}
