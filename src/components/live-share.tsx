import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getLiveLocation, pingLiveLocation, stopLiveLocation } from "@/lib/server/inbook";
import { isLiveStatus } from "@/lib/status";
import { watchDeviceLocation } from "@/lib/geo";

let geoStop: (() => void) | null = null;
let geoBooking = "";
const liveFlag = { id: "", sharing: false };
const liveSubs = new Set<() => void>();

function setLiveFlag(id: string, on: boolean) {
  liveFlag.id = id;
  liveFlag.sharing = on;
  liveSubs.forEach((fn) => fn());
}

function startGeo(
  bookingId: string,
  onPos: (p: { lat: number; lng: number; accuracy?: number }) => void,
  onErr: (message: string, code: number) => void,
) {
  if (geoBooking === bookingId && geoStop) return;
  geoStop?.();
  geoBooking = bookingId;
  geoStop = watchDeviceLocation(onPos, onErr);
}

function haltGeo(bookingId?: string) {
  if (bookingId && geoBooking !== bookingId) return;
  geoStop?.();
  geoStop = null;
  geoBooking = "";
}

export function WorkerLiveShare({
  bookingId,
  status,
  compact = false,
}: {
  bookingId: string;
  status: string;
  compact?: boolean;
}) {
  const active = isLiveStatus(status);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied" | "gps_off">("unknown");
  const [sharing, setSharing] = useState(liveFlag.id === bookingId && liveFlag.sharing);
  const [last, setLast] = useState<{ lat: number; lng: number } | null>(null);
  const lastPing = useRef(0);

  useEffect(() => {
    const sync = () => setSharing(liveFlag.id === bookingId && liveFlag.sharing);
    liveSubs.add(sync);
    return () => {
      liveSubs.delete(sync);
    };
  }, [bookingId]);

  useEffect(() => {
    if (!active) {
      setSharing(false);
      setLiveFlag(bookingId, false);
      haltGeo(bookingId);
      void stopLiveLocation({ data: { bookingId } }).catch(() => undefined);
      return;
    }
    return undefined;
  }, [active, bookingId]);

  useEffect(() => {
    if (!active || !sharing) return;
    startGeo(
      bookingId,
      (pos) => {
        setLast(pos);
        setPermission("granted");
        const now = Date.now();
        if (lastPing.current !== 0 && now - lastPing.current < 2000) return;
        lastPing.current = now;
        void pingLiveLocation({
          data: { bookingId, lat: pos.lat, lng: pos.lng, permission: "granted", accuracy: pos.accuracy },
        }).catch((e: Error) => {
          if (e.message.includes("active booking")) {
            haltGeo(bookingId);
            setLiveFlag(bookingId, false);
            setSharing(false);
          }
        });
      },
      (message, code) => {
        const perm = code === 1 ? "denied" : "gps_off";
        setPermission(perm);
        setSharing(false);
        haltGeo(bookingId);
        void pingLiveLocation({ data: { bookingId, permission: perm } }).catch(() => undefined);
        toast(message);
      },
    );
    return () => {
      /* keep geo running across screens for this booking */
    };
  }, [active, sharing, bookingId]);

  if (!active) return null;

  if (compact) {
    if (sharing && permission === "granted") {
      return (
        <p className="flex items-center gap-2 text-xs text-good">
          <span className="size-1.5 rounded-full bg-good" />
          Live location sharing for this job
        </p>
      );
    }
    if (sharing) {
      return <p className="text-xs text-muted">Getting GPS… allow location if asked.</p>;
    }
    if (permission === "denied" || permission === "gps_off") {
      return (
        <button
          type="button"
          className="flex h-11 w-full items-center justify-between rounded-2xl bg-raised px-3 text-left text-xs text-danger"
          onClick={() => {
            setLiveFlag(bookingId, true);
            setSharing(true);
            setPermission("unknown");
          }}
        >
          <span>{permission === "denied" ? "Location permission denied — tap to retry" : "GPS is off — turn it on, then retry"}</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        className="flex h-11 w-full items-center justify-between rounded-2xl bg-raised px-3 text-left text-xs"
        onClick={() => {
          setLiveFlag(bookingId, true);
          setSharing(true);
          setPermission("unknown");
        }}
      >
        <span>Share live location for active job</span>
        <span className="text-sage">Enable</span>
      </button>
    );
  }

  return (
    <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-sm font-medium">Live location for this booking</p>
      <p className="mt-1 text-xs text-muted">
        Shared only with this customer while the job is active. Stops automatically when the job ends.
      </p>
      {permission === "denied" ? (
        <p className="mt-3 text-sm text-danger">
          Location permission denied. In your browser or phone settings, allow location for NAKA, then tap Share
          again.
        </p>
      ) : null}
      {permission === "gps_off" ? (
        <p className="mt-3 text-sm text-danger">GPS is off. Turn on location/GPS, then tap Share again.</p>
      ) : null}
      {sharing && permission === "granted" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-good">
          <span className="size-2 rounded-full bg-good" />
          Live · sharing now
          {last ? ` · ${last.lat.toFixed(4)}, ${last.lng.toFixed(4)}` : null}
        </p>
      ) : (
        <Button
          className="mt-4 w-full"
          onClick={() => {
            setLiveFlag(bookingId, true);
            setSharing(true);
            setPermission("unknown");
          }}
        >
          Share live location
        </Button>
      )}
      {sharing ? (
        <Button
          className="mt-2 w-full"
          variant="ghost"
          onClick={() => {
            setLiveFlag(bookingId, false);
            setSharing(false);
            haltGeo(bookingId);
            void stopLiveLocation({ data: { bookingId } });
          }}
        >
          Pause sharing
        </Button>
      ) : null}
    </div>
  );
}

export function useBookingLive(bookingId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["live", bookingId],
    queryFn: () => getLiveLocation({ data: { bookingId } }),
    enabled,
    refetchInterval: enabled ? 2000 : false,
    staleTime: 0,
  });
}

export function LiveStatusLine({
  bookingId,
  enabled,
}: {
  bookingId: string;
  enabled: boolean;
}) {
  const q = useBookingLive(bookingId, enabled);
  const live = q.data;
  if (!enabled) return null;
  if (!live || (!live.sharing && live.lat == null)) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <MapPin className="size-4" />
        Location temporarily unavailable
      </p>
    );
  }
  const stale = live.stale;
  return (
    <p className={stale ? "flex items-center gap-2 text-sm text-muted" : "flex items-center gap-2 text-sm text-good"}>
      <span className={stale ? "size-2 rounded-full bg-muted" : "size-2 rounded-full bg-good"} />
      {stale ? "Last known location" : "Live"}
      {live.lastSeenAt ? ` · ${ago(live.lastSeenAt)}` : null}
    </p>
  );
}

export function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 8) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function clockTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function NavigateButton({
  address,
  lat,
  lng,
}: {
  address: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const href =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  return (
    <Button asChild variant="secondary">
      <a href={href} target="_blank" rel="noreferrer">
        <Navigation className="size-4" />
        Navigate to site
      </a>
    </Button>
  );
}

export function EmergencyHelp() {
  return (
    <div className="flex gap-2">
      <Button asChild variant="danger" className="flex-1">
        <a href="tel:112">
          <ShieldAlert className="size-4" />
          Emergency 112
        </a>
      </Button>
      <Button asChild variant="outline" className="flex-1">
        <Link to="/help">Help</Link>
      </Button>
    </div>
  );
}
