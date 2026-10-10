export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function projectToMap(lat: number, lng: number, originLat: number, originLng: number) {
  const x = 50 + (lng - originLng) * 180;
  const y = 50 - (lat - originLat) * 200;
  return {
    x: clamp(x, 8, 92),
    y: clamp(y, 8, 92),
  };
}

export function mapToLatLng(x: number, y: number, originLat: number, originLng: number) {
  return {
    lat: originLat - (y - 50) / 200,
    lng: originLng + (x - 50) / 180,
  };
}

export function projectPair(
  site: { lat: number; lng: number } | null,
  worker: { lat: number; lng: number } | null,
) {
  const crew = projectCrew(site, worker ? [{ id: "live", lat: worker.lat, lng: worker.lng }] : []);
  return { sitePin: crew.sitePin, workerPin: crew.pins[0] ?? null };
}

export function projectCrew(
  site: { lat: number; lng: number } | null,
  workers: Array<{ id: string; lat: number; lng: number }>,
) {
  const pts = [
    ...(site ? [site] : []),
    ...workers.map((w) => ({ lat: w.lat, lng: w.lng })),
  ];
  if (pts.length === 0) {
    return { sitePin: { x: 50, y: 62 }, pins: [] as Array<{ id: string; x: number; y: number }> };
  }
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const spanLat = Math.max(Math.abs(Math.max(...lats) - Math.min(...lats)), 0.004);
  const spanLng = Math.max(Math.abs(Math.max(...lngs) - Math.min(...lngs)), 0.004);
  const scale = Math.min(56 / spanLng, 56 / spanLat, 12000);
  const proj = (lat: number, lng: number) => ({
    x: clamp(50 + (lng - midLng) * scale, 14, 86),
    y: clamp(50 - (lat - midLat) * scale, 18, 84),
  });
  const sitePin = site ? proj(site.lat, site.lng) : { x: 50, y: 64 };
  const used: Array<{ x: number; y: number }> = [sitePin];
  const pins = workers.map((w) => {
    let p = proj(w.lat, w.lng);
    for (const u of used) {
      if (Math.hypot(p.x - u.x, p.y - u.y) < 5) {
        p = { x: clamp(p.x + 4, 14, 86), y: clamp(p.y - 5, 14, 84) };
      }
    }
    used.push(p);
    return { id: w.id, x: p.x, y: p.y };
  });
  return { sitePin, pins };
}

export function formatDistanceKm(km: number) {
  if (!Number.isFinite(km) || km < 0) return "—";
  if (km < 0.1) return `${Math.max(10, Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function etaMinutes(km: number) {
  if (!Number.isFinite(km) || km < 0.04 || km > 40) return null;
  return Math.max(1, Math.round((km / 18) * 60));
}

export function geoErrorMessage(err: GeolocationPositionError | Error) {
  const code = "code" in err ? err.code : 0;
  if (code === 1) {
    return "Location permission denied. Allow location for NAKA in your browser settings, then retry.";
  }
  if (code === 2) {
    return "GPS is off or unavailable. Turn on location/GPS, then retry.";
  }
  if (code === 3) {
    return "Location timed out. Move to an open area and retry.";
  }
  return err.message || "Location permission denied";
}

export function readDeviceLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(geoErrorMessage(err))),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  });
}

export function watchDeviceLocation(
  onPos: (p: { lat: number; lng: number; accuracy?: number }) => void,
  onErr: (message: string, code: number) => void,
): () => void {
  if (!navigator.geolocation) {
    onErr("Location is not available on this device", 2);
    return () => undefined;
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onPos({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined,
      }),
    (err) => onErr(geoErrorMessage(err), err.code),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function mapsNavUrl(address: string, lat?: number | null, lng?: number | null) {
  return lat != null && lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function mapsRouteUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number } | { address: string },
) {
  const dest = "address" in to ? encodeURIComponent(to.address) : `${to.lat},${to.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${dest}`;
}
