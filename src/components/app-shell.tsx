import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Bell,
  Briefcase,
  ClipboardList,
  House,
  MapPin,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { WorkerLiveShare } from "@/components/live-share";
import { CITIES } from "@/lib/data";
import { useMe } from "@/lib/use-me";
import { listMyBookings, updateProfile } from "@/lib/server/inbook";
import { isLiveStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  map,
  mode,
  mapSize = "sm",
}: {
  children: ReactNode;
  map?: ReactNode;
  mode?: "customer" | "worker";
  mapSize?: "sm" | "track";
}) {
  const { me } = useMe();
  const resolved = mode ?? (me?.profile.active_mode === "worker" ? "worker" : "customer");

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_26.5rem]">
        <div className="relative hidden min-h-dvh lg:block">
          {map ?? <div className="absolute inset-0 bg-surface" />}
          <div className="pointer-events-none absolute top-6 left-6">
            <Logo size="sm" />
          </div>
        </div>
        <div className="relative flex min-h-dvh w-full flex-col bg-bg lg:border-l lg:border-line">
          {map ? (
            <div className={cn("relative shrink-0 lg:hidden", mapSize === "track" ? "h-80" : "h-52")}>{map}</div>
          ) : null}
          <Header />
          <WorkerActiveShare mode={resolved} />
          <div className="flex flex-1 flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </div>
          <BottomNav mode={resolved} />
        </div>
      </div>
    </div>
  );
}

function WorkerActiveShare({ mode }: { mode: "customer" | "worker" }) {
  const { user } = useMe();
  const jobs = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => listMyBookings(),
    enabled: mode === "worker" && Boolean(user),
    refetchInterval: 8000,
  });
  const active = (jobs.data ?? []).find((b) => isLiveStatus(b.my_status || ""));
  if (!active) return null;
  return (
    <div className="px-4 pb-2 lg:px-5">
      <WorkerLiveShare bookingId={active.id} status={active.my_status || active.status} compact />
    </div>
  );
}

function Header() {
  const { me, refetchMe, user } = useMe();
  const [open, setOpen] = useState(false);
  const label = me?.profile.location_label || "Set location";

  return (
    <header className="relative z-20 flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
      <div className="lg:hidden">
        <Logo size="sm" />
      </div>
      <p className="hidden lg:block">
        <Logo size="sm" />
      </p>
      <div className="relative flex items-center gap-2">
        {user ? (
          <Link
            to="/notifications"
            className="relative grid size-11 place-items-center rounded-full bg-raised shadow-[var(--shadow-border)]"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {(me?.unread ?? 0) > 0 ? (
              <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-sage px-1 text-center text-[10px] font-medium text-ink">
                {(me?.unread ?? 0) > 9 ? "9+" : me?.unread}
              </span>
            ) : null}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 max-w-[14rem] items-center gap-1.5 rounded-full bg-raised px-3.5 text-sm text-fg shadow-[var(--shadow-border)]"
        >
          <MapPin className="size-3.5 shrink-0 text-sage" strokeWidth={2} />
          <span className="truncate">{label}</span>
        </button>
        {open ? (
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-3xl bg-surface p-2 shadow-[var(--shadow-border)]">
            <button
              type="button"
              className="flex h-11 w-full items-center rounded-2xl px-3 text-left text-sm hover:bg-raised"
              onClick={() => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                  void updateProfile({
                    data: {
                      locationLabel: "Current location",
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    },
                  }).then(() => refetchMe());
                  setOpen(false);
                });
              }}
            >
              Use current location
            </button>
            {CITIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-sm hover:bg-raised"
                onClick={() => {
                  if (!user) {
                    setOpen(false);
                    return;
                  }
                  void updateProfile({
                    data: { locationLabel: `${c.name}, ${c.area}`, lat: c.lat, lng: c.lng },
                  }).then(() => refetchMe());
                  setOpen(false);
                }}
              >
                <span>
                  <span className="block text-fg">{c.name}</span>
                  <span className="text-xs text-muted">{c.area}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function BottomNav({ mode }: { mode: "customer" | "worker" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { me } = useMe();
  const customer = [
    { to: "/", label: "Home", icon: House, match: "/" },
    { to: "/bookings", label: "Bookings", icon: ClipboardList, match: "/bookings" },
    { to: "/messages", label: "Messages", icon: MessageSquare, match: "/messages" },
    { to: "/account", label: "Account", icon: UserRound, match: "/account" },
  ] as const;
  const worker = [
    { to: "/work", label: "Home", icon: House, match: "/work" },
    { to: "/jobs", label: "Jobs", icon: Briefcase, match: "/jobs" },
    { to: "/messages", label: "Chat", icon: MessageSquare, match: "/messages" },
    { to: "/earnings", label: "Pay", icon: Banknote, match: "/earnings" },
    { to: "/account", label: "Account", icon: UserRound, match: "/account" },
  ] as const;
  const items = mode === "worker" ? worker : customer;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] lg:static lg:border-t"
      aria-label="Main"
    >
      <ul className={cn("mx-auto grid h-[3.75rem] max-w-lg", items.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
        {items.map((item) => {
          const active =
            item.match === "/"
              ? pathname === "/"
              : pathname === item.match || pathname.startsWith(`${item.match}/`);
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <Link
                to={item.to}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-fg" : "text-subtle",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
                  {item.match === "/account" && (me?.unread ?? 0) > 0 ? (
                    <span className="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-sage" />
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
