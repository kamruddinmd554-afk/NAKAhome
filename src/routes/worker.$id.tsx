import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { WorkerAvatar } from "@/components/worker-avatar";
import { getWorker, listWorkerPhotos, listWorkerReviews, saveWorker } from "@/lib/server/inbook";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/worker/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["worker", id], queryFn: () => getWorker({ data: { userId: id } }) });
  const reviews = useQuery({ queryKey: ["reviews", id], queryFn: () => listWorkerReviews({ data: { userId: id } }) });
  const photos = useQuery({
    queryKey: ["photos", id],
    queryFn: () => listWorkerPhotos({ data: { workerId: id } }),
  });
  const w = q.data;

  return (
    <AppShell mode="customer">
      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 lg:px-5">
        {!w ? (
          <p className="text-sm text-muted">{q.isLoading ? "Loading…" : "Worker not available."}</p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              {w.photoData ? (
                <img
                  src={w.photoData}
                  alt=""
                  className="size-16 rounded-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                />
              ) : (
                <WorkerAvatar name={w.name} size="lg" />
              )}
              <div>
                <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
                  {w.name}
                  {w.verificationStatus === "verified" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-xs font-medium text-sage">
                      <ShieldCheck className="size-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-muted">Unverified</span>
                  )}
                </h1>
                <p className="text-sm text-muted">{w.locationLabel || "Location not set"}</p>
                <p className="mt-1 flex items-center gap-2 text-sm">
                  <Star className="size-3.5 fill-accent text-accent" />
                  {w.ratingCount ? w.rating.toFixed(1) : "New"} · {w.completedJobs} jobs
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted">{w.about || "No bio yet."}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-raised p-3">
                <p className="text-xs text-muted">Experience</p>
                <p className="mt-1 font-medium">{w.experienceYears} years</p>
              </div>
              <div className="rounded-2xl bg-raised p-3">
                <p className="text-xs text-muted">Service radius</p>
                <p className="mt-1 font-medium">{w.radiusKm} km</p>
              </div>
              <div className="rounded-2xl bg-raised p-3">
                <p className="text-xs text-muted">Availability</p>
                <p className="mt-1 font-medium">{w.available ? "Available" : "Offline"}</p>
              </div>
              <div className="rounded-2xl bg-raised p-3">
                <p className="text-xs text-muted">ID check</p>
                <p className="mt-1 font-medium capitalize">{w.idVerificationStatus}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Skills</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {w.skills.map((s) => (
                  <li key={s.id} className="rounded-full bg-raised px-3 py-2 text-sm">
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
            <p className="font-display text-xl tabular-nums">
              {inr(w.rateAmount)} / {w.rateType}
            </p>
            <p className="text-xs text-muted">Mobile is shared only after a booking is accepted.</p>
            {(photos.data ?? []).length > 0 ? (
              <div>
                <p className="text-xs text-muted">Work photos</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {photos.data!.map((p) => (
                    <img key={p.id} src={p.data_url} alt="" className="aspect-square rounded-2xl object-cover" />
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="text-xs text-muted">Reviews</p>
              {(reviews.data ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted">No reviews yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {reviews.data!.map((r, i) => (
                    <li key={i} className="rounded-2xl bg-raised p-3 text-sm">
                      <p className="font-medium">
                        {r.name} · {r.stars}/5
                      </p>
                      {r.review ? <p className="mt-1 text-muted">{r.review}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button size="lg" asChild>
              <Link to="/hire" search={{ skill: w.skills[0]?.id, worker: w.userId }}>
                Book
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void saveWorker({ data: { workerId: w.userId, saved: true } })}>
              Save worker
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
}
