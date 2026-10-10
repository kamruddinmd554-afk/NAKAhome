import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CategoryIcon } from "@/components/category-icon";
import { CityMap } from "@/components/city-map";
import { JoinWorker } from "@/components/join-worker";
import { RequireAuth } from "@/components/require-auth";
import { SwipeAccept } from "@/components/swipe-accept";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { addWorkerDocument, addWorkerPhoto, declineJob, listMyDocuments, listOpenJobs, listWorkerPhotos, setAvailable, updateBookingStatus, updateProfile, workerEarnings } from "@/lib/server/inbook";
import { compressImageFile } from "@/lib/image";
import { ID_DOCUMENT_KINDS, isKycApproved, kycKindLabel, kycLabel, KYC_PUBLIC_MESSAGE, KYC_REJECTED } from "@/lib/kyc";
import { quoteFromWorkerRate } from "@/lib/pricing";
import { CASH_LABEL, PAY_METHOD_LABEL } from "@/lib/status";
import { useMe } from "@/lib/use-me";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/work")({
  component: () => (
    <RequireAuth>
      <WorkPage />
    </RequireAuth>
  ),
});

function WorkPage() {
  const { me, meLoading, refetchMe } = useMe();
  const [edit, setEdit] = useState(false);
  if (meLoading || !me) return <AppShell mode="worker"><div className="p-6 text-sm text-muted">Loading…</div></AppShell>;
  if (!me.worker || edit) {
    const w = me.worker;
    return (
      <JoinWorker
        initial={{
          name: me.profile.name,
          phone: me.profile.phone,
          phoneVerified: Boolean(me.profile.phone_verified),
          about: w?.about,
          experienceYears: w?.experience_years,
          locationLabel: w?.location_label ?? me.profile.location_label,
          lat: w?.lat ?? me.profile.lat,
          lng: w?.lng ?? me.profile.lng,
          radiusKm: w?.radius_km,
          rateAmount: w?.rate_amount,
          rateType: (w?.rate_type as "hour" | "day" | "job") || "day",
          skillIds: w?.skills.map((s) => s.id),
          photoData: w?.photo_data,
          gender: w?.gender,
          dateOfBirth: w?.date_of_birth,
          ageYears: w?.age_years,
          village: w?.village,
          cityArea: w?.city_area,
          overtimeRate: w?.overtime_rate,
          insuranceStatus: w?.insurance_status,
          insuranceNote: w?.insurance_note,
          availabilityNote: w?.availability_note,
          emergencyName: me.profile.emergency_name,
          emergencyPhone: me.profile.emergency_phone,
          locale: me.profile.locale,
          available: w?.available,
          idVerificationStatus: w?.id_verification_status,
        }}
        onDone={() => {
          setEdit(false);
          void refetchMe();
        }}
      />
    );
  }
  return <Dashboard onEdit={() => setEdit(true)} />;
}

function Dashboard({ onEdit }: { onEdit: () => void }) {
  const { me, refetchMe } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const worker = me!.worker!;
  const kycOk = isKycApproved(worker.id_verification_status);
  const jobs = useQuery({ queryKey: ["open-jobs"], queryFn: () => listOpenJobs(), refetchInterval: 4000 });
  const earn = useQuery({ queryKey: ["earnings"], queryFn: () => workerEarnings() });
  const incoming = jobs.data?.[0];
  let incomingNet = incoming?.rate_amount ?? 0;
  if (incoming) {
    try {
      incomingNet = quoteFromWorkerRate(
        incoming.unit_rate && incoming.unit_rate > 0 ? incoming.unit_rate : incoming.rate_amount,
        incoming.rate_type,
        incoming.duration_hours,
        1,
      ).unitCharge;
    } catch {
      incomingNet = incoming.rate_amount;
    }
  }

  useEffect(() => {
    void updateProfile({ data: { activeMode: "worker" } });
  }, []);

  useEffect(() => {
    if (worker.id_verification_status !== "pending") return;
    const t = setInterval(() => void refetchMe(), 8000);
    return () => clearInterval(t);
  }, [worker.id_verification_status, refetchMe]);

  function accept(id: string) {
    void updateBookingStatus({ data: { id, status: "accepted" } })
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["open-jobs"] });
        toast("Job accepted. Share live location on the job screen.");
        void navigate({ to: "/booking/$id", params: { id } });
      })
      .catch((e: Error) => toast(e.message));
  }

  return (
    <AppShell mode="worker" map={<CityMap searching={worker.available} />}>
      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 lg:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {worker.photo_data ? (
              <img src={worker.photo_data} alt="" className="size-12 rounded-full object-cover" />
            ) : null}
            <div>
              <p className="text-xs font-medium tracking-wide text-muted">Worker</p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{me?.profile.name}</h1>
            </div>
          </div>
          <Badge tone={worker.available ? "good" : "muted"}>{worker.available ? "Available" : "Offline"}</Badge>
        </div>
        <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-medium">{kycLabel(worker.id_verification_status)}</p>
              <p className="mt-1 text-sm text-muted">
                {kycOk
                  ? "Your ID is verified. You can go available and receive bookings."
                  : worker.id_verification_status === KYC_REJECTED
                    ? "Your ID was rejected. Upload a clearer government ID to resubmit."
                    : worker.id_verification_status === "pending"
                      ? "Document submitted. Waiting for admin review — not public yet."
                      : KYC_PUBLIC_MESSAGE}
              </p>
            </div>
            <Badge tone={kycOk ? "good" : worker.id_verification_status === KYC_REJECTED ? "paper" : "muted"}>
              {kycLabel(worker.id_verification_status)}
            </Badge>
          </div>
        </div>
        <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-base font-medium">{worker.available ? "You are available" : "Go available"}</p>
              <p className="mt-1 text-sm text-muted">
                {kycOk
                  ? worker.available
                    ? "Matching jobs for your trades will appear here."
                    : "Turn on to receive job requests."
                  : KYC_PUBLIC_MESSAGE}
              </p>
            </div>
            <Switch
              checked={worker.available}
              disabled={!kycOk}
              onCheckedChange={(v) => {
                void setAvailable({ data: { available: v } })
                  .then(() => refetchMe())
                  .catch((e: Error) => toast(e.message));
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted">No booking = no work. Live location is shared only after you accept a job.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs text-muted">Collected</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{inr(earn.data?.collected ?? 0)}</p>
          </div>
          <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs text-muted">Due on site</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{inr(earn.data?.due ?? 0)}</p>
          </div>
        </div>
        <div>
          <h2 className="font-display text-sm font-medium">Your trades</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {worker.skills.map((s) => (
              <li key={s.id} className="inline-flex h-10 items-center gap-2 rounded-full bg-raised px-3 text-sm">
                <CategoryIcon id={s.id} className="size-4 text-sage" />
                {s.name}
              </li>
            ))}
          </ul>
        </div>
        <p className="font-display text-xl tabular-nums">
          Daily rate {inr(worker.rate_amount)} / {worker.rate_type}
        </p>
        <Button variant="outline" onClick={onEdit}>
          Edit worker profile
        </Button>
        <WorkMedia />
      </div>
      {incoming && worker.available && kycOk ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/70 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:items-center">
          <div className="w-full max-w-md rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium tracking-wide text-muted">New job request</p>
            <h2 className="mt-1 font-display text-xl font-semibold">{incoming.customer_name}</h2>
            <p className="mt-1 text-sm text-muted">
              {incoming.skill_name} · {incoming.crew_size} · {incoming.duration_hours}h
            </p>
            <p className="mt-3 text-sm">{incoming.address}</p>
            <p className="mt-2 text-sm text-muted">{incoming.description}</p>
            <p className="mt-2 text-xs text-muted">
              {incoming.work_date} {incoming.start_time} · {incoming.duration_hours}h · {incoming.crew_size} workers
            </p>
            <p className="mt-3 font-display text-xl tabular-nums">Your net {inr(incomingNet)}</p>
            <p className="mt-1 text-sm text-muted">
              Customer cash {inr(incoming.total)} · Commission {inr(incoming.fee)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {PAY_METHOD_LABEL[incoming.payment_method] ?? "Cash on Site"} · {CASH_LABEL[incoming.payment_status] ?? "Pending"}.
              Worker payout is not automatic.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button size="lg" onClick={() => accept(incoming.id)}>
                ACCEPT
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  void declineJob({ data: { id: incoming.id } }).then(() => qc.invalidateQueries({ queryKey: ["open-jobs"] }));
                }}
              >
                REJECT
              </Button>
              <SwipeAccept onAccept={() => accept(incoming.id)} />
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function WorkMedia() {
  const { user, me, refetchMe } = useMe();
  const qc = useQueryClient();
  const photos = useQuery({
    queryKey: ["my-photos"],
    queryFn: () => listWorkerPhotos({ data: { workerId: user!.id } }),
    enabled: Boolean(user),
  });
  const docs = useQuery({ queryKey: ["my-docs"], queryFn: () => listMyDocuments() });
  const [kind, setKind] = useState("aadhaar");
  const kycStatus = me?.worker?.id_verification_status;
  const rejected = kycStatus === KYC_REJECTED;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-sm font-medium">Work photos</h2>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {(photos.data ?? []).map((p) => (
            <img key={p.id} src={p.data_url} alt="" className="aspect-square rounded-xl object-cover" />
          ))}
        </div>
        <Input
          className="mt-2"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void compressImageFile(file, 480)
              .then((dataUrl) => addWorkerPhoto({ data: { dataUrl } }))
              .then(() => qc.invalidateQueries({ queryKey: ["my-photos"] }))
              .catch((err: Error) => toast(err.message));
          }}
        />
      </div>
      <div>
        <h2 className="font-display text-sm font-medium">Identity / KYC</h2>
        <p className="mt-1 text-sm font-medium">{kycLabel(kycStatus)}</p>
        <p className="mt-1 text-xs text-muted">
          {kycStatus && isKycApproved(kycStatus)
            ? "KYC Approved. You can go available."
            : kycStatus === "pending"
              ? "KYC Pending — admin must approve your ID before you can go public."
              : KYC_PUBLIC_MESSAGE}
        </p>
        <p className="mt-1 text-xs text-muted">
          Aadhaar or another government-issued ID. Admin reviews it — there is no automatic or fake verification.
        </p>
        {rejected ? (
          <p className="mt-2 text-sm text-paper">KYC Rejected. Upload a clearer government ID to resubmit.</p>
        ) : null}
        <ul className="mt-2 text-xs text-muted">
          {(docs.data ?? []).map((d) => (
            <li key={d.id}>
              {kycKindLabel(d.kind)} · {kycLabel(d.status)}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {ID_DOCUMENT_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={
                kind === k.id
                  ? "h-10 rounded-full bg-accent px-3 text-xs text-accent-fg"
                  : "h-10 rounded-full bg-raised px-3 text-xs text-muted"
              }
            >
              {k.en}
            </button>
          ))}
        </div>
        <Input
          className="mt-2"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void compressImageFile(file, 960, "contain")
              .then((dataUrl) => addWorkerDocument({ data: { kind, dataUrl } }))
              .then(() => {
                void qc.invalidateQueries({ queryKey: ["my-docs"] });
                void refetchMe();
                toast("Document submitted. Status: KYC Pending.");
              })
              .catch((err: Error) => toast(err.message));
          }}
        />
      </div>
    </div>
  );
}
