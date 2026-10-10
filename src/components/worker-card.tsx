import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Phone, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkerAvatar } from "@/components/worker-avatar";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { WorkerPublic } from "@/lib/server/inbook";
import { openThread } from "@/lib/server/inbook";
import { inr } from "@/lib/utils";

export function WorkerCard({
  worker,
  skillId,
}: {
  worker: WorkerPublic;
  skillId?: string;
}) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const skill = skillId ? worker.skills.find((s) => s.id === skillId) : worker.skills[0];
  const rateLabel = worker.rateType === "hour" ? "/hr" : worker.rateType === "job" ? "/job" : "/day";

  return (
    <article className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <Link to="/worker/$id" params={{ id: worker.userId }} className="flex items-start gap-3">
        {worker.photoData ? (
          <img src={worker.photoData} alt="" className="size-12 rounded-full object-cover outline outline-1 -outline-offset-1 outline-fg/10" />
        ) : (
          <WorkerAvatar name={worker.name || "Worker"} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium">{worker.name || "Worker"}</span>
            {worker.verificationStatus === "verified" ? <ShieldCheck className="size-3.5 text-sage" /> : null}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {skill?.name ?? "Civil worker"}
            {worker.experienceYears > 0 ? ` · ${worker.experienceYears} yrs` : ""}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-0.5">
              <Star className="size-3 fill-accent text-accent" />
              {worker.ratingCount ? worker.rating.toFixed(1) : "New"}
            </span>
            <span>{worker.completedJobs} jobs</span>
            {worker.distanceKm != null ? <span>{worker.distanceKm} km</span> : worker.locationLabel ? <span>{worker.locationLabel}</span> : null}
            <span className={worker.available ? "text-good" : ""}>{worker.available ? "Available" : "Offline"}</span>
          </span>
        </span>
        <span className="text-right">
          <span className="block font-display text-sm tabular-nums">{inr(worker.rateAmount)}</span>
          <span className="text-xs text-muted">{rateLabel}</span>
        </span>
      </Link>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="h-11"
          onClick={() => {
            if (isPending) return;
            if (!user) {
              void navigate({ to: "/login" });
              return;
            }
            toast("Number is shared after the worker accepts a booking.");
          }}
        >
          <Phone className="size-4" />
          Call
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-11"
          onClick={() => {
            if (isPending) return;
            if (!user) {
              void navigate({ to: "/login" });
              return;
            }
            void openThread({ data: { workerId: worker.userId } }).then((t) =>
              navigate({ to: "/messages", search: { thread: t.id } }),
            );
          }}
        >
          <MessageSquare className="size-4" />
          Chat
        </Button>
        <Button size="sm" className="h-11" asChild>
          <Link to="/hire" search={{ skill: skill?.id ?? worker.skills[0]?.id, worker: worker.userId }}>
            Book
          </Link>
        </Button>
      </div>
    </article>
  );
}
