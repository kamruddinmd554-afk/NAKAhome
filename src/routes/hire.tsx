import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LocateFixed } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CategoryIcon } from "@/components/category-icon";
import { CityMap } from "@/components/city-map";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceBook } from "@/components/voice-book";
import { ProposeSkill } from "@/components/skill-picker";
import { WorkerCard } from "@/components/worker-card";
import { skillById } from "@/lib/catalog";
import { CITIES } from "@/lib/data";
import { mapToLatLng, projectToMap, readDeviceLocation } from "@/lib/geo";
import { STR } from "@/lib/i18n";
import { quoteFromWorkerRate } from "@/lib/pricing";
import { createBooking, listCatalog, searchWorkers } from "@/lib/server/inbook";
import { useMe } from "@/lib/use-me";
import { cn, inr } from "@/lib/utils";
import { formatDraftTime } from "@/lib/voice-book";

type HireSearch = {
  skill?: string;
  worker?: string;
  category?: string;
  crew?: string;
  date?: string;
  time?: string;
  hours?: string;
  address?: string;
  lat?: string;
  lng?: string;
  voice?: string;
  all?: string;
};

export const Route = createFileRoute("/hire")({
  validateSearch: (s: Record<string, unknown>): HireSearch => ({
    skill: typeof s.skill === "string" ? s.skill : undefined,
    worker: typeof s.worker === "string" ? s.worker : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
    crew: typeof s.crew === "string" ? s.crew : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    time: typeof s.time === "string" ? s.time : undefined,
    hours: typeof s.hours === "string" ? s.hours : undefined,
    address: typeof s.address === "string" ? s.address : undefined,
    lat: typeof s.lat === "string" ? s.lat : undefined,
    lng: typeof s.lng === "string" ? s.lng : undefined,
    voice: typeof s.voice === "string" ? s.voice : undefined,
    all: typeof s.all === "string" ? s.all : undefined,
  }),
  component: () => (
    <RequireAuth>
      <HirePage />
    </RequireAuth>
  ),
});

function HirePage() {
  const search = Route.useSearch();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => listCatalog() });
  const { me } = useMe();
  const [allQuery, setAllQuery] = useState("");
  const workers = useQuery({
    queryKey: ["workers", search.skill, me?.profile.lat],
    queryFn: () =>
      searchWorkers({
        data: {
          skillId: search.skill,
          lat: me?.profile.lat ?? null,
          lng: me?.profile.lng ?? null,
        },
      }),
  });

  if (search.skill) {
    return (
      <Compose
        skillId={search.skill}
        workerId={search.worker}
        workers={workers.data ?? []}
        preset={search}
      />
    );
  }

  const categories = catalog.data?.categories ?? [];
  const skills = catalog.data?.skills ?? [];
  const showAll = search.all === "1" || Boolean(search.category);
  const needle = allQuery.trim().toLowerCase();
  const grouped = categories
    .filter((c) => !search.category || c.id === search.category)
    .map((c) => ({
      ...c,
      skills: skills.filter((s) => {
        if (s.category_id !== c.id) return false;
        if (!needle) return true;
        return s.name.toLowerCase().includes(needle) || s.hindi.includes(allQuery);
      }),
    }))
    .filter((c) => c.skills.length > 0);
  const hi = me?.profile.locale !== "en";

  return (
    <AppShell mode="customer" map={<CityMap workers={[]} />}>
      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 lg:px-5">
        <div className="flex items-center gap-2">
          {search.category || showAll ? (
            <Link to="/hire" className="grid size-11 place-items-center rounded-xl hover:bg-raised">
              <ArrowLeft className="size-5" />
            </Link>
          ) : null}
          <div>
            <p className="text-xs text-muted">NAKA HOME</p>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {showAll ? (hi ? "सभी काम" : "All skills") : hi ? "काम चुनें" : "Choose a trade"}
            </h1>
          </div>
        </div>
        <VoiceBook hi={hi} />
        {!showAll ? (
          <>
            <Input
              placeholder={hi ? "स्किल खोजें — मिस्त्री, सरिया, शटरिंग…" : "Skill search — mason, steel fixer, shuttering…"}
              value={allQuery}
              onChange={(e) => setAllQuery(e.target.value)}
            />
            {allQuery.trim() ? (
              <ul className="flex flex-col gap-1">
                {skills
                  .filter(
                    (s) =>
                      s.name.toLowerCase().includes(allQuery.trim().toLowerCase()) ||
                      s.hindi.includes(allQuery),
                  )
                  .slice(0, 8)
                  .map((s) => (
                    <li key={s.id}>
                      <Link
                        to="/hire"
                        search={{ skill: s.id }}
                        className="flex h-12 items-center gap-3 rounded-2xl px-2 hover:bg-raised"
                      >
                        <CategoryIcon id={s.id} className="text-sage" />
                        <span className="flex-1 text-sm">{s.name}</span>
                        <span className="text-xs text-muted">{s.hindi}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "mazdoor", en: "Mazdoor", hi: "मजदूर" },
                  { id: "construction-helper", en: "Helper", hi: "हेल्पर" },
                  { id: "loading-labour", en: "Loading", hi: "लोडिंग" },
                  { id: "raj-mistri", en: "Raj Mistri", hi: "राज मिस्त्री" },
                  { id: "painter", en: "Painter", hi: "पेंटर" },
                  { id: "electrician", en: "Electrician", hi: "बिजली" },
                ].map((s) => (
                  <Link
                    key={s.id}
                    to="/hire"
                    search={{ skill: s.id }}
                    className="flex h-14 items-center justify-center rounded-2xl bg-raised px-2 text-center text-xs font-medium"
                  >
                    {hi ? s.hi : s.en}
                  </Link>
                ))}
              </div>
            )}
            <ProposeSkill hi={hi} />
            <Button size="lg" variant="paper" className="w-full" asChild>
              <Link to="/hire" search={{ all: "1" }}>
                {hi ? "सभी स्किल देखें" : "All skills"}
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {categories.slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  to="/hire"
                  search={{ category: cat.id }}
                  className="flex h-[4.5rem] items-center gap-3 rounded-3xl bg-surface px-3.5 shadow-[var(--shadow-border)]"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-raised text-accent">
                    <CategoryIcon id={cat.id} />
                  </span>
                  <span className="text-sm font-medium">{cat.name}</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <Input
              placeholder={hi ? "काम खोजें — मजदूर, मिस्त्री, पेंटर…" : "Search skills — labour, mason, painter…"}
              value={allQuery}
              onChange={(e) => setAllQuery(e.target.value)}
            />
            {grouped.map((cat) => (
            <section key={cat.id}>
              <h2 className="font-display text-sm font-medium">{cat.name}</h2>
              <p className="text-xs text-muted">{cat.hindi}</p>
              <div className="mt-2 grid grid-cols-1 gap-1">
                {cat.skills.map((s) => (
                  <Link
                    key={s.id}
                    to="/hire"
                    search={{ skill: s.id }}
                    className="flex h-14 items-center gap-3 rounded-2xl bg-surface px-3 shadow-[var(--shadow-border)]"
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-raised text-accent">
                      <CategoryIcon id={s.id} />
                    </span>
                    <span className="flex-1 text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted">{inr(s.default_rate)}</span>
                  </Link>
                ))}
              </div>
            </section>
            ))}
            {grouped.length === 0 ? (
              <p className="text-sm text-muted">{hi ? "मैच नहीं मिला। नया स्किल जोड़ें।" : "No match. Add a new skill."}</p>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Compose({
  skillId,
  workerId,
  workers,
  preset,
}: {
  skillId: string;
  workerId?: string;
  workers: Awaited<ReturnType<typeof searchWorkers>>;
  preset: HireSearch;
}) {
  const skill = skillById(skillId);
  const { me } = useMe();
  const t = STR[me?.profile.locale === "hi" ? "hi" : "en"];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const picked = workers.find((w) => w.userId === workerId);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState(preset.address || me?.profile.location_label || "");
  const [lat, setLat] = useState<number | null>(
    preset.lat ? Number(preset.lat) : (me?.profile.lat ?? null),
  );
  const [lng, setLng] = useState<number | null>(
    preset.lng ? Number(preset.lng) : (me?.profile.lng ?? null),
  );
  const [workDate, setWorkDate] = useState(preset.date || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(preset.time || "08:00");
  const [hours, setHours] = useState(preset.hours ? Number(preset.hours) : 8);
  const [crew, setCrew] = useState(preset.crew ? Number(preset.crew) : 1);
  const [customCrew, setCustomCrew] = useState(
    preset.crew && !["1", "2", "3", "4", "5", "10"].includes(preset.crew) ? preset.crew : "",
  );
  const [rateType, setRateType] = useState<"hour" | "day" | "job">(
    (picked?.rateType as "hour" | "day" | "job") ?? "day",
  );
  const [confirm, setConfirm] = useState(Boolean(preset.voice));
  const [busy, setBusy] = useState(false);
  const rateAmount = picked?.rateAmount && picked.rateAmount > 0 ? picked.rateAmount : null;
  const crewSize = Math.min(20, Math.max(1, customCrew ? Number(customCrew) || 1 : crew));
  const quote = useMemo(() => {
    if (rateAmount == null) return null;
    try {
      const q = quoteFromWorkerRate(rateAmount, picked?.rateType || rateType, hours, crewSize);
      return q;
    } catch {
      return null;
    }
  }, [rateAmount, rateType, hours, crewSize, picked?.rateType]);
  const origin = {
    lat: lat ?? me?.profile.lat ?? CITIES[0].lat,
    lng: lng ?? me?.profile.lng ?? CITIES[0].lng,
  };

  async function useGps() {
    try {
      const pos = await readDeviceLocation();
      setLat(pos.lat);
      setLng(pos.lng);
      setAddress((a) => a || "Current location");
      toast("Site location set from this device");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Location permission needed");
    }
  }

  async function submit() {
    if (!picked?.userId || !quote || rateAmount == null) {
      toast("Select a worker so we can use their saved rate.");
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const res = await createBooking({
        data: {
          skillId,
          workerId: picked.userId,
          description,
          address,
          lat,
          lng,
          workDate,
          startTime,
          durationHours: hours,
          crewSize,
          rateAmount,
          rateType,
          paymentMethod: "cash",
        },
      });
      await qc.invalidateQueries({ queryKey: ["my-bookings"] });
      toast("Booking requested");
      await navigate({ to: "/booking/$id", params: { id: res.id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not book");
      setBusy(false);
    }
  }

  return (
    <AppShell
      mode="customer"
      map={
        <CityMap
          searching
          onPick={(x, y) => {
            const geo = mapToLatLng(x, y, origin.lat, origin.lng);
            setLat(geo.lat);
            setLng(geo.lng);
            setAddress((a) => a || "Pinned site on map");
          }}
          user={projectToMap(origin.lat, origin.lng, origin.lat, origin.lng)}
        />
      }
    >
      <div className="flex flex-1 flex-col px-4 pb-5 lg:px-5">
        <div className="flex items-center gap-2">
          <Link to="/hire" className="grid size-11 place-items-center rounded-xl hover:bg-raised">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-xs text-muted">{skill?.hindi}</p>
            <h1 className="font-display text-lg font-semibold">{skill?.name ?? "Trade"}</h1>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <Label>Available workers</Label>
            <div className="mt-2 flex flex-col gap-2">
              {workers.length === 0 ? (
                <p className="rounded-3xl bg-surface p-4 text-sm text-muted">{t.noWorkers}</p>
              ) : (
                <>
                  {workers.slice(0, 4).map((w) => (
                    <div key={w.userId} className={cn(picked?.userId === w.userId && "ring-1 ring-accent rounded-3xl")}>
                      <WorkerCard worker={w} skillId={skillId} />
                    </div>
                  ))}
                  <Button variant="paper" className="w-full" asChild>
                    <Link to="/workers" search={{ skill: skillId }}>
                      {t.seeMore}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desc">Work description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Plot, wing, materials on site…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addr">Site location</Label>
            <Input
              id="addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Search or type site address"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" className="h-11" onClick={() => void useGps()}>
                <LocateFixed className="size-4" />
                Current location
              </Button>
              {CITIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="h-11 rounded-full bg-raised px-3.5 text-sm"
                  onClick={() => {
                    setAddress(`${c.name}, ${c.area}`);
                    setLat(c.lat);
                    setLng(c.lng);
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">Tap the map to drop a site pin.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="time">Start time</Label>
              <Input id="time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Duration</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[2, 4, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHours(n)}
                  className={cn(
                    "h-11 rounded-full px-3.5 text-sm",
                    hours === n ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                  )}
                >
                  {n === 8 ? "Full day" : `${n} hours`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Number of workers</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setCrew(n);
                    setCustomCrew("");
                  }}
                  className={cn(
                    "h-11 rounded-full px-3.5 text-sm",
                    !customCrew && crew === n ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                  )}
                >
                  {n}
                </button>
              ))}
              <Input
                className="h-11 w-24"
                inputMode="numeric"
                placeholder="Custom"
                value={customCrew}
                onChange={(e) => setCustomCrew(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </div>
            <p className="mt-2 text-xs text-muted">Each worker is a real seat on this booking, not a multiplied dummy price.</p>
          </div>
          <div>
            <Label>Rate type</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["hour", "day", "job"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRateType(r)}
                  className={cn(
                    "h-11 rounded-full px-3.5 text-sm capitalize",
                    rateType === r ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                  )}
                >
                  Per {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Payment</Label>
            <div className="mt-2 rounded-2xl bg-raised px-4 py-3">
              <p className="text-sm font-medium">Cash on Site</p>
              <p className="mt-1 text-xs text-muted">{t.payNote}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium tracking-wide text-muted">Cash breakdown</p>
            {quote ? (
              <>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-muted">Worker rate</span>
                  <span className="tabular-nums">{inr(quote.unitRate)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted">Worker charge{quote.crewSize > 1 ? ` · ${quote.crewSize} workers` : ""}</span>
                  <span className="tabular-nums">{inr(quote.workerCharge)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted">Platform commission 8%</span>
                  <span className="tabular-nums">{inr(quote.fee)}</span>
                </div>
                <div className="mt-3 flex justify-between font-display text-base font-medium">
                  <span>Customer cash total</span>
                  <span className="tabular-nums">{inr(quote.total)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm text-muted">
                  <span>Worker net (each)</span>
                  <span className="tabular-nums">{inr(quote.unitCharge)}</span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {inr(rateAmount ?? 0)} {rateType === "hour" ? "/hr" : rateType === "job" ? "/job" : "/day"}
                  {picked ? ` · ${picked.name}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Select a worker to use their saved rate. A price is not shown and no booking is created until then.
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              Cash stays Pending until collected on site. No UPI, Razorpay or online payment. Worker payout is manual.
            </p>
          </div>
          {!confirm ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => setConfirm(true)}
              disabled={!address.trim() || !picked || !quote}
            >
              Review booking
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                {skill?.name} · {workDate} {startTime} · {crewSize} worker{crewSize === 1 ? "" : "s"} ·{" "}
                {quote ? inr(quote.total) : "—"} · Cash on Site
              </p>
              <Button
                size="lg"
                className="w-full"
                disabled={busy || !picked || !quote || rateAmount == null}
                onClick={() => void submit()}
              >
                {busy ? "Sending…" : "Confirm booking"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
