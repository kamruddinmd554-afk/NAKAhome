import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Navigation, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CityMap } from "@/components/city-map";
import { EmergencyHelp, NavigateButton, WorkerLiveShare, ago, clockTime } from "@/components/live-share";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WorkerAvatar } from "@/components/worker-avatar";
import { etaMinutes, formatDistanceKm, haversineKm, mapsNavUrl, mapsRouteUrl, projectCrew, projectPair } from "@/lib/geo";
import type { CrewMember, LiveTrack } from "@/lib/server/inbook";
import {
  addRating,
  blockUser,
  cancelBooking,
  getBooking,
  markCashCollected,
  openBookingThread,
  reportUser,
  updateBookingStatus,
} from "@/lib/server/inbook";
import {
  BOOKING_STEPS,
  CASH_LABEL,
  CREW_DOT,
  NEXT_LABEL,
  NEXT_STATUS,
  PAY_METHOD_LABEL,
  STATUS_LABEL,
  crewCounts,
  isLiveStatus,
} from "@/lib/status";
import { useMe } from "@/lib/use-me";
import { cn, formatInPhone, inr } from "@/lib/utils";

export const Route = createFileRoute("/booking/$id")({
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { id } = Route.useParams();
  const { user, me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: () => getBooking({ data: { id } }),
    refetchInterval: 4000,
  });
  const b = q.data;
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  const crew = b?.crew ?? [];
  const tracks = b?.liveTracks ?? [];
  const isCustomer = b?.customer_id === user?.id;
  const isWorker = Boolean(b?.my_status) || b?.worker_id === user?.id;
  const group = (b?.crew_size ?? 1) > 1 || crew.length > 1;
  const liveOn = Boolean(b && (isLiveStatus(b.status) || crew.some((c) => isLiveStatus(c.status))));
  const mode = me?.profile.active_mode === "worker" ? "worker" : "customer";
  const myStatus = b?.my_status || (isWorker ? b?.status : null) || "";
  const next = isWorker ? (NEXT_STATUS[myStatus] ?? null) : null;
  const counts = crewCounts(crew.length ? crew : [{ status: b?.status ?? "requested" }]);

  const siteGeo = b?.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : null;
  const focused = tracks.find((t) => t.workerId === focusId) ?? tracks.find((t) => t.sharing && !t.stale) ?? tracks[0];

  const mapModel = useMemo(() => {
    if (!b) return { pins: [] as Array<{ id: string; x: number; y: number; live?: boolean; photo?: string | null; label?: string }>, site: { x: 50, y: 62 }, live: false };
    if (group) {
      const withGeo = tracks.filter((t) => t.lat != null && t.lng != null) as Array<LiveTrack & { lat: number; lng: number }>;
      const crewMap = projectCrew(
        siteGeo,
        withGeo.map((t) => ({ id: t.workerId, lat: t.lat, lng: t.lng })),
      );
      const pins = crewMap.pins.map((p) => {
        const t = tracks.find((x) => x.workerId === p.id);
        return {
          id: p.id,
          x: p.x,
          y: p.y,
          live: Boolean(t?.sharing && !t.stale),
          photo: t?.photo,
          label: t?.name ?? "Worker",
        };
      });
      return { pins, site: crewMap.sitePin, live: pins.some((p) => p.live) };
    }
    const workerGeo = focused?.lat != null && focused.lng != null ? { lat: focused.lat, lng: focused.lng } : null;
    const pins = projectPair(siteGeo, workerGeo);
    return {
      pins: pins.workerPin
        ? [
            {
              id: focused?.workerId ?? "live",
              x: pins.workerPin.x,
              y: pins.workerPin.y,
              live: Boolean(focused?.sharing && !focused.stale),
              photo: b.worker_photo ?? focused?.photo,
              label: b.worker_name ?? focused?.name ?? "Worker",
            },
          ]
        : [],
      site: pins.sitePin,
      live: Boolean(focused?.sharing && !focused.stale),
    };
  }, [b, focused, group, siteGeo, tracks]);

  if (q.isLoading) {
    return (
      <AppShell mode={mode}>
        <p className="p-5 text-sm text-muted">Loading booking…</p>
      </AppShell>
    );
  }
  if (!b) {
    return (
      <AppShell mode={mode}>
        <p className="p-5 text-sm text-muted">Booking not found.</p>
      </AppShell>
    );
  }

  const step = BOOKING_STEPS.indexOf(b.status as (typeof BOOKING_STEPS)[number]);
  const otherId = isCustomer ? b.worker_id : b.customer_id;
  const phone = isCustomer ? (focused?.workerId ? crew.find((c) => c.workerId === focused.workerId)?.phone : b.worker_phone) : b.customer_phone;
  const canCall = Boolean(phone) && (isLiveStatus(b.status) || step > 1);
  const workerLive = mapModel.live;
  const workerGeo = focused?.lat != null && focused.lng != null ? { lat: focused.lat, lng: focused.lng } : null;
  const distanceKm =
    siteGeo && workerGeo ? haversineKm(workerGeo.lat, workerGeo.lng, siteGeo.lat, siteGeo.lng) : null;
  const eta = distanceKm != null ? etaMinutes(distanceKm) : null;
  const routeHref =
    workerGeo && siteGeo
      ? mapsRouteUrl(workerGeo, siteGeo)
      : workerGeo
        ? mapsNavUrl(b.address, workerGeo.lat, workerGeo.lng)
        : mapsNavUrl(b.address, b.lat, b.lng);
  const unit = b.unit_rate && b.unit_rate > 0 ? b.unit_rate : b.rate_amount;
  const workerCharge = b.worker_charge && b.worker_charge > 0 ? b.worker_charge : Math.max(0, b.total - b.fee);
  const workerNet = unit;
  const cashStatus = CASH_LABEL[b.payment_status] ?? b.payment_status;
  const payMethod = PAY_METHOD_LABEL[b.payment_method] ?? "Cash on Site";

  return (
    <AppShell
      mode={mode}
      mapSize={liveOn ? "track" : "sm"}
      map={
        <CityMap
          tracking={liveOn}
          workers={mapModel.pins}
          user={mapModel.site}
          focusId={focusId ?? mapModel.pins[0]?.id}
          live={workerLive}
          siteLabel="Site"
          onSelectWorker={group ? (wid) => setFocusId(wid) : undefined}
        />
      }
    >
      <div className="flex flex-1 flex-col gap-4 px-4 pb-6 lg:px-5">
        <div className="flex items-start gap-3">
          {b.worker_photo && isCustomer && !group ? (
            <img src={b.worker_photo} alt="" className="size-14 rounded-full object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{b.skill_name}</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {group && liveOn && isCustomer ? "Group Live Tracking" : (STATUS_LABEL[b.status] ?? b.status)}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-subtle">{b.id}</p>
          </div>
        </div>

        {group ? (
          <div className="rounded-3xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
            <p className="font-medium">
              {counts.accepted} of {b.crew_size} workers accepted
            </p>
            <p className="mt-1 text-muted">
              {counts.arrived} arrived · {counts.working} working · {counts.completed} completed
              {counts.rejected ? ` · ${counts.rejected} rejected` : ""}
              {counts.pending ? ` · ${counts.pending} pending` : ""}
            </p>
          </div>
        ) : (
          <ol className="grid grid-cols-6 gap-1">
            {BOOKING_STEPS.map((s, i) => (
              <li key={s}>
                <span
                  className={cn(
                    "mb-1 block h-1 rounded-full",
                    i <= step && b.status !== "cancelled" ? "bg-accent" : "bg-line",
                  )}
                />
                <span className="block text-[10px] leading-tight text-subtle">{STATUS_LABEL[s]}</span>
              </li>
            ))}
          </ol>
        )}

        {liveOn && isCustomer && !group ? (
          <SingleTrack
            name={b.worker_name ?? "Worker"}
            photo={b.worker_photo}
            skill={b.skill_name}
            track={focused}
            distanceKm={distanceKm}
            eta={eta}
            canCall={canCall}
            phone={phone}
            routeHref={routeHref}
            onChat={() =>
              void openBookingThread({ data: { bookingId: id } })
                .then((t) => navigate({ to: "/messages", search: { thread: t.id } }))
                .catch((e: Error) => toast(e.message))
            }
          />
        ) : null}

        {liveOn && isCustomer && group ? (
          <ul className="flex flex-col gap-2">
            {crew.map((c) => {
              const t = tracks.find((x) => x.workerId === c.workerId);
              const tone = liveTone(c, t);
              const href =
                t?.lat != null && t.lng != null
                  ? mapsNavUrl(b.address, t.lat, t.lng)
                  : mapsNavUrl(b.address, b.lat, b.lng);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => c.workerId && setFocusId(c.workerId)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-3xl bg-surface p-3 text-left shadow-[var(--shadow-border)]",
                      focusId === c.workerId && "ring-1 ring-accent",
                    )}
                  >
                    {c.photo ? (
                      <img src={c.photo} alt="" className="size-11 rounded-full object-cover" />
                    ) : (
                      <WorkerAvatar name={c.name || "Worker"} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{c.name || `Seat ${c.slot}`}</span>
                        <span className={cn("size-2 shrink-0 rounded-full", CREW_DOT[c.status] ?? "bg-subtle")} />
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {c.skillName} · {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                      <span className="mt-1 block text-xs">{tone.label}</span>
                      {t?.lastSeenAt ? (
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {ago(t.lastSeenAt)}
                          {t.stale ? ` · ${clockTime(t.lastSeenAt)}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {c.workerId && isLiveStatus(c.status) ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-raised px-3 text-xs font-medium"
                    >
                      <Navigation className="size-3.5" />
                      Open in Google Maps
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {liveOn && isWorker ? (
          <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-sm font-medium">Live location sharing</p>
            <p className="mt-1 text-xs text-muted">
              Shared only with this customer for booking {b.id}. Stops when the job ends.
            </p>
            {focused?.sharing && !focused.stale ? (
              <p className="mt-2 text-sm text-good">Live · {focused.lastSeenAt ? ago(focused.lastSeenAt) : "just now"}</p>
            ) : focused?.lat != null ? (
              <p className="mt-2 text-sm text-muted">
                Last known location · {focused.lastSeenAt ? `${ago(focused.lastSeenAt)} · ${clockTime(focused.lastSeenAt)}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Location temporarily unavailable until you share GPS.</p>
            )}
          </div>
        ) : null}

        {isWorker && liveOn ? <WorkerLiveShare bookingId={id} status={myStatus || b.status} /> : null}

        {isWorker ? <NavigateButton address={b.address} lat={b.lat} lng={b.lng} /> : null}

        <div className="rounded-3xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
          <p className="font-medium">{isWorker ? b.customer_name : b.worker_name ?? "Waiting for workers"}</p>
          <p className="mt-2 text-muted">{b.address}</p>
          <p className="mt-2">{b.description}</p>
          <p className="mt-3 tabular-nums">
            {b.work_date} {b.start_time} · {b.crew_size} worker{b.crew_size === 1 ? "" : "s"} · {b.duration_hours}h
          </p>
          <div className="mt-3 border-t border-line pt-3">
            <div className="flex justify-between">
              <span className="text-muted">Worker rate</span>
              <span className="tabular-nums">{inr(unit)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted">Worker charge</span>
              <span className="tabular-nums">{inr(workerCharge)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted">Platform commission 8%</span>
              <span className="tabular-nums">{inr(b.fee)}</span>
            </div>
            <div className="mt-2 flex justify-between font-medium">
              <span>Customer cash total</span>
              <span className="tabular-nums">{inr(b.total)}</span>
            </div>
            <div className="mt-1 flex justify-between text-muted">
              <span>Worker net (each)</span>
              <span className="tabular-nums">{inr(workerNet)}</span>
            </div>
          </div>
          <p className="mt-3 text-sm">
            Payment method: <span className="font-medium">{payMethod}</span>
          </p>
          <p className="mt-1 text-sm">
            Payment status: <span className="font-medium">{cashStatus}</span>
          </p>
          <p className="mt-2 text-xs text-muted">Cash stays Pending until recorded on site. No online payment.</p>
          {b.status === "cancelled" && b.cancel_reason ? (
            <p className="mt-2 text-sm text-danger">Cancelled: {b.cancel_reason}</p>
          ) : null}
        </div>

        {!(isCustomer && liveOn) ? (
          canCall && phone ? (
            <Button asChild variant="secondary">
              <a href={`tel:+91${phone.replace(/\D/g, "").slice(-10)}`}>
                <Phone className="size-4" />
                Call {formatInPhone(phone)}
              </a>
            </Button>
          ) : (
            <p className="text-xs text-muted">Phone is shared after the job is accepted.</p>
          )
        ) : null}
        {isCustomer && liveOn && group ? (
          <div className="grid grid-cols-2 gap-2">
            {canCall && phone ? (
              <Button asChild variant="secondary">
                <a href={`tel:+91${phone.replace(/\D/g, "").slice(-10)}`}>
                  <Phone className="size-4" />
                  Call
                </a>
              </Button>
            ) : (
              <Button variant="secondary" disabled>
                <Phone className="size-4" />
                Call
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() =>
                void openBookingThread({ data: { bookingId: id } })
                  .then((t) => navigate({ to: "/messages", search: { thread: t.id } }))
                  .catch((e: Error) => toast(e.message))
              }
            >
              <MessageSquare className="size-4" />
              Chat
            </Button>
          </div>
        ) : null}
        {(b.worker_id || crew.some((c) => c.workerId)) && !(isCustomer && liveOn && !group) ? (
          isCustomer && liveOn && group ? null : (
            <Button
              variant="outline"
              onClick={() =>
                void openBookingThread({ data: { bookingId: id } })
                  .then((t) => navigate({ to: "/messages", search: { thread: t.id } }))
                  .catch((e: Error) => toast(e.message))
              }
            >
              <MessageSquare className="size-4" />
              Chat about this job
            </Button>
          )
        ) : null}

        <EmergencyHelp />

        {next ? (
          <Button
            size="lg"
            onClick={() =>
              void updateBookingStatus({ data: { id, status: next } })
                .then(() => qc.invalidateQueries({ queryKey: ["booking", id] }))
                .catch((e: Error) => toast(e.message))
            }
          >
            {NEXT_LABEL[next]}
          </Button>
        ) : null}
        {isWorker && (myStatus === "completed" || b.status === "completed") && b.payment_status === "due" ? (
          <Button
            variant="paper"
            onClick={() =>
              void markCashCollected({ data: { id } }).then(() =>
                qc.invalidateQueries({ queryKey: ["booking", id] }),
              )
            }
          >
            Record cash collected
          </Button>
        ) : null}
        {b.status === "completed" ? (
          <div>
            <p className="text-sm text-muted">Rate {isCustomer ? "the worker" : "the customer"}</p>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  className={cn(
                    "grid size-12 place-items-center rounded-xl",
                    n <= stars ? "bg-accent text-accent-fg" : "bg-raised",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <Textarea
              className="mt-3"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Write a review"
            />
            <Button
              className="mt-3 w-full"
              variant="secondary"
              onClick={() =>
                void addRating({ data: { bookingId: id, stars, review } }).then(() => toast("Review saved"))
              }
            >
              Submit review
            </Button>
          </div>
        ) : null}
        {b.status !== "completed" && b.status !== "cancelled" ? (
          cancelOpen ? (
            <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="text-sm font-medium">Cancel booking</p>
              <Textarea
                className="mt-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() =>
                    void cancelBooking({ data: { id, reason } })
                      .then(() => qc.invalidateQueries({ queryKey: ["booking", id] }))
                      .catch((e: Error) => toast(e.message))
                  }
                >
                  Confirm cancel
                </Button>
                <Button variant="ghost" onClick={() => setCancelOpen(false)}>
                  Keep
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              Cancel booking
            </Button>
          )
        ) : null}
        {otherId ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                const r = window.prompt("Why are you reporting this user?");
                if (r) void reportUser({ data: { targetUserId: otherId, reason: r } }).then(() => toast("Report sent"));
              }}
            >
              Report
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => void blockUser({ data: { targetUserId: otherId } }).then(() => toast("User blocked"))}
            >
              Block
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function liveTone(c: CrewMember, t?: LiveTrack) {
  if (c.status === "pending" || c.status === "invited" || !c.workerId) {
    return { kind: "wait" as const, label: "⚪ Not started" };
  }
  if (c.status === "rejected" || c.status === "cancelled") {
    return { kind: "off" as const, label: STATUS_LABEL[c.status] ?? c.status };
  }
  if (t?.sharing && !t.stale) return { kind: "live" as const, label: "🟢 Live" };
  if (t?.lat != null) {
    return { kind: "last" as const, label: t.lastSeenAt ? `🟡 Last seen ${ago(t.lastSeenAt)}` : "🟡 Last known location" };
  }
  if (isLiveStatus(c.status)) return { kind: "off" as const, label: "🔴 Offline" };
  return { kind: "wait" as const, label: "⚪ Not started" };
}

function SingleTrack({
  name,
  photo,
  skill,
  track,
  distanceKm,
  eta,
  canCall,
  phone,
  routeHref,
  onChat,
}: {
  name: string;
  photo?: string | null;
  skill: string;
  track?: LiveTrack;
  distanceKm: number | null;
  eta: number | null;
  canCall: boolean;
  phone?: string | null;
  routeHref: string;
  onChat: () => void;
}) {
  const workerLive = Boolean(track?.sharing && !track.stale);
  const workerGeo = track?.lat != null;
  return (
    <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center gap-3">
        {photo ? <img src={photo} alt="" className="size-12 rounded-full object-cover" /> : <WorkerAvatar name={name} />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="text-xs text-muted">{skill}</p>
        </div>
        {workerLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-good/15 px-2.5 py-1 text-xs font-medium text-good">
            <span className="size-1.5 rounded-full bg-good" />
            Live
          </span>
        ) : (
          <span className="rounded-full bg-raised px-2.5 py-1 text-xs text-muted">Location unavailable</span>
        )}
      </div>
      <p className="mt-3 text-sm">
        {workerLive ? (
          <span className="text-good">Worker is live</span>
        ) : workerGeo ? (
          <span className="text-muted">Last known location</span>
        ) : (
          <span className="text-muted">Location temporarily unavailable</span>
        )}
      </p>
      {track?.lastSeenAt ? (
        <p className="mt-1 text-xs text-muted">
          Updated: {ago(track.lastSeenAt)}
          {track.stale ? ` · ${clockTime(track.lastSeenAt)}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">Waiting for the worker to share GPS for this booking.</p>
      )}
      {distanceKm != null ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-raised p-3">
            <p className="text-xs text-muted">Distance to site</p>
            <p className="mt-1 font-medium tabular-nums">{formatDistanceKm(distanceKm)}</p>
          </div>
          <div className="rounded-2xl bg-raised p-3">
            <p className="text-xs text-muted">ETA</p>
            <p className="mt-1 font-medium tabular-nums">{eta != null ? `${eta} min` : "—"}</p>
          </div>
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {canCall && phone ? (
          <Button asChild variant="secondary" size="sm" className="h-11">
            <a href={`tel:+91${phone.replace(/\D/g, "").slice(-10)}`}>
              <Phone className="size-4" />
              Call
            </a>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="h-11" disabled>
            <Phone className="size-4" />
            Call
          </Button>
        )}
        <Button variant="secondary" size="sm" className="h-11" onClick={onChat}>
          <MessageSquare className="size-4" />
          Chat
        </Button>
        <Button asChild variant="paper" size="sm" className="h-11">
          <a href={routeHref} target="_blank" rel="noreferrer">
            <Navigation className="size-4" />
            Maps
          </a>
        </Button>
      </div>
    </div>
  );
}
