import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Briefcase,
  Flag,
  HardHat,
  HelpCircle,
  QrCode,
  Shield,
  Star,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkerAvatar } from "@/components/worker-avatar";
import { listNotifications, listSaved, markNotificationsRead, reportUser, updateProfile } from "@/lib/server/inbook";
import { kycLabel } from "@/lib/kyc";
import { NOTIF_TYPE_LABEL } from "@/lib/status";
import { useMe } from "@/lib/use-me";
import { cn, formatInPhone, inr } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { me, refetchMe, user } = useMe();
  const mode = me?.profile.active_mode === "worker" ? "worker" : "customer";
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => listSaved() });
  const notifs = useQuery({ queryKey: ["notifs"], queryFn: () => listNotifications() });
  const navigate = useNavigate();

  return (
    <AppShell mode={mode}>
      <div className="flex flex-1 flex-col gap-6 px-4 pb-6 lg:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted">Account</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {me?.profile.name || user?.displayName || "Your profile"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {user?.primaryEmail?.endsWith("@phone.inbook.app")
                ? formatInPhone(user.primaryEmail.split("@")[0] ?? "")
                : user?.primaryEmail}
            </p>
          </div>
          <UserButton />
        </div>

        <form
          className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void updateProfile({
              data: {
                name: String(fd.get("name") ?? ""),
                phone: String(fd.get("phone") ?? ""),
                locale: String(fd.get("locale") ?? "en"),
              },
            }).then(() => refetchMe());
          }}
        >
          <div className="flex items-center gap-3">
            <WorkerAvatar name={me?.profile.name || "You"} size="lg" />
            <div className="flex-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={me?.profile.name} className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Mobile</Label>
            <Input id="phone" name="phone" defaultValue={me?.profile.phone} className="mt-1" placeholder="98765 43210" />
            {me?.profile.phone ? <p className="mt-1 text-xs text-muted">{formatInPhone(me.profile.phone)}</p> : null}
          </div>
          <div>
            <Label htmlFor="locale">Language</Label>
            <select
              id="locale"
              name="locale"
              defaultValue={me?.profile.locale ?? "en"}
              className="mt-1 h-12 w-full rounded-xl bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Save profile
          </Button>
        </form>

        <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs text-muted">Mode</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variant={mode === "customer" ? "primary" : "secondary"}
              onClick={() =>
                void updateProfile({ data: { activeMode: "customer" } }).then(() => {
                  refetchMe();
                  navigate({ to: "/" });
                })
              }
            >
              Customer
            </Button>
            <Button
              variant={mode === "worker" ? "primary" : "secondary"}
              onClick={() =>
                void updateProfile({ data: { activeMode: "worker" } }).then(() => {
                  refetchMe();
                  navigate({ to: "/work" });
                })
              }
            >
              Worker
            </Button>
          </div>
        </div>

        <form
          className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void updateProfile({
              data: {
                emergencyName: String(fd.get("emergencyName") ?? ""),
                emergencyPhone: String(fd.get("emergencyPhone") ?? ""),
              },
            }).then(() => refetchMe());
          }}
        >
          <p className="text-sm font-medium">Emergency contact</p>
          <div>
            <Label htmlFor="emergencyName">Name</Label>
            <Input id="emergencyName" name="emergencyName" defaultValue={me?.profile.emergency_name} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emergencyPhone">Mobile</Label>
            <Input id="emergencyPhone" name="emergencyPhone" defaultValue={me?.profile.emergency_phone} className="mt-1" placeholder="98765 43210" />
          </div>
          <Button type="submit" variant="secondary">
            Save emergency contact
          </Button>
        </form>

        <div className="grid gap-2">
          <Link to="/share" className="flex h-16 items-center justify-between rounded-3xl bg-surface px-4 shadow-[var(--shadow-border)]">
            <span className="flex items-center gap-3">
              <QrCode className="size-5 text-sage" />
              <span>
                <span className="block text-sm font-medium">Share NAKA HOME</span>
                <span className="text-xs text-muted">QR code to open the app</span>
              </span>
            </span>
            <ArrowUpRight className="size-4 text-muted" />
          </Link>
          <Link to="/hire" className="flex h-16 items-center justify-between rounded-3xl bg-surface px-4 shadow-[var(--shadow-border)]">
            <span className="flex items-center gap-3">
              <Briefcase className="size-5 text-sage" />
              <span>
                <span className="block text-sm font-medium">Book labour</span>
                <span className="text-xs text-muted">Customer mode</span>
              </span>
            </span>
            <ArrowUpRight className="size-4 text-muted" />
          </Link>
          <Link to="/work" className="flex h-16 items-center justify-between rounded-3xl bg-surface px-4 shadow-[var(--shadow-border)]">
            <span className="flex items-center gap-3">
              <HardHat className="size-5 text-sage" />
              <span>
                <span className="block text-sm font-medium">{me?.worker ? "Worker home" : "Join as worker"}</span>
                <span className="text-xs text-muted">Skills, availability, jobs</span>
              </span>
            </span>
            <ArrowUpRight className="size-4 text-muted" />
          </Link>
          <Link to="/bookings" className="flex h-16 items-center justify-between rounded-3xl bg-surface px-4 shadow-[var(--shadow-border)]">
            <span className="flex items-center gap-3">
              <Star className="size-5 text-sage" />
              <span className="text-sm font-medium">My bookings & reviews</span>
            </span>
            <ArrowUpRight className="size-4 text-muted" />
          </Link>
        </div>

        {mode === "customer" ? (
          <div>
            <h2 className="font-display text-sm font-medium">Saved workers</h2>
            <p className="mt-2 text-sm text-muted">
              {(saved.data ?? []).length === 0 ? "None saved yet." : `${saved.data?.length} saved`}
            </p>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-sm font-medium">Worker</h2>
            <p className="mt-2 text-sm text-muted">
              {me?.worker
                ? `${inr(me.worker.rate_amount)} / ${me.worker.rate_type} · ${kycLabel(me.worker.id_verification_status)}`
                : "Complete your worker profile"}
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-medium">Notifications</h2>
            <button type="button" className="text-xs text-muted" onClick={() => void markNotificationsRead().then(() => notifs.refetch())}>
              Mark read
            </button>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {(notifs.data ?? []).slice(0, 6).map((n) => (
              <li key={n.id} className={cn("rounded-2xl bg-raised px-3 py-2 text-sm", !n.read && "ring-1 ring-sage/40")}>
                <p className="text-[11px] text-muted">
                  {NOTIF_TYPE_LABEL[n.type] ?? n.type} · {n.read ? "Read" : "Unread"}
                </p>
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-muted">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Link to="/notifications" className="flex h-12 items-center gap-2 text-sm">
            <Star className="size-4 text-sage" /> Notifications
            {(me?.unread ?? 0) > 0 ? <span className="text-xs text-sage">{me?.unread}</span> : null}
          </Link>
          <Link to="/help" className="flex h-12 items-center gap-2 text-sm">
            <HelpCircle className="size-4 text-sage" /> Help & support
          </Link>
          <Link to="/terms" className="flex h-12 items-center gap-2 text-sm">
            <Shield className="size-4 text-sage" /> Terms
          </Link>
          <Link to="/privacy" className="flex h-12 items-center gap-2 text-sm">
            <Shield className="size-4 text-sage" /> Privacy
          </Link>
          <p className="flex h-12 items-center gap-2 text-sm text-muted">
            <Flag className="size-4" /> Emergency: 112
          </p>
          <button
            type="button"
            className="h-12 text-left text-sm text-muted underline-offset-2 hover:underline"
            onClick={() => {
              if (!user?.id) return;
              const ok = window.confirm(
                "Ask NAKAhome to delete this account? Finish open jobs first. An admin reviews the request. Your data is not sold.",
              );
              if (!ok) return;
              void reportUser({
                data: {
                  targetUserId: user.id,
                  reason: "Account deletion request. Remove my public profile and personal data after open jobs are finished.",
                },
              })
                .then(() => toast("Deletion request sent. We will not sell your data while it is reviewed."))
                .catch((e: Error) => toast(e.message));
            }}
          >
            Ask to delete my account
          </button>
        </div>

        {me?.profile.is_admin ? (
          <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>
            Admin dashboard
          </Button>
        ) : null}
      </div>
    </AppShell>
  );
}
