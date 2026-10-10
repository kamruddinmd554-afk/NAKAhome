import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Briefcase, HardHat, Mic, Plus, QrCode, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Boot } from "@/components/boot";
import { CategoryIcon } from "@/components/category-icon";
import { CityMap } from "@/components/city-map";
import { Logo } from "@/components/logo";
import { ProposeSkill } from "@/components/skill-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceBook } from "@/components/voice-book";
import { WorkerCard } from "@/components/worker-card";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { CIVIL_SHORTCUTS } from "@/lib/civil-shortcuts";
import { CITIES } from "@/lib/data";
import { projectToMap } from "@/lib/geo";
import { STR } from "@/lib/i18n";
import { listCatalog, listMyBookings, searchWorkers, workerCount } from "@/lib/server/inbook";
import { STATUS_LABEL, isLiveStatus } from "@/lib/status";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const { isPending } = useCurrentUserState();
  if (isPending) return <Boot />;
  return (
    <>
      <SignedOut>
        <Landing />
      </SignedOut>
      <SignedIn>
        <CustomerHome />
      </SignedIn>
    </>
  );
}

function Landing() {
  const count = useQuery({ queryKey: ["worker-count"], queryFn: () => workerCount() });
  const live = count.data ?? 0;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-bg text-fg">
      <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-2">
        <section className="flex flex-col px-5 py-6 lg:px-12 lg:py-10">
          <Logo size="lg" className="mx-auto lg:mx-0" />
          <p className="reveal reveal-1 mt-10 text-xs font-medium tracking-wide text-muted">
            Civil construction labour marketplace
          </p>
          <h1 className="reveal reveal-2 mt-3 font-display text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
            Find work. Find workers.
          </h1>
          <p className="reveal reveal-3 mt-4 max-w-md text-base leading-relaxed text-muted">
            Book masons, steel fixers, shuttering, plaster workers, painters, electricians, plumbers,
            helpers, excavation and loading labour for the site.
          </p>
          <div className="reveal reveal-4 mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:flex-1" asChild>
              <Link to="/login">
                Sign in to book
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:flex-1" asChild>
              <Link to="/login" search={{ redirect: "/work" }}>
                <HardHat className="size-4" />
                Join as worker
              </Link>
            </Button>
          </div>
          <Button size="lg" variant="ghost" className="reveal reveal-4 mt-2 w-full" asChild>
            <Link to="/share">
              <QrCode className="size-4" />
              Share NAKA HOME
            </Link>
          </Button>
          <dl className="reveal reveal-5 mt-10 grid grid-cols-2 gap-3 border-t border-line pt-6">
            <div>
              <dt className="text-xs text-muted">Workers live now</dt>
              <dd className="mt-1 font-display text-lg font-semibold tabular-nums">
                {count.isLoading ? "—" : live}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Trades</dt>
              <dd className="mt-1 font-display text-lg font-semibold">Mason to labour</dd>
            </div>
          </dl>
        </section>
        <section className="relative hidden min-h-dvh lg:block">
          <CityMap className="absolute inset-0" workers={[]} />
        </section>
      </div>
    </main>
  );
}

function CustomerHome() {
  const { me, meLoading, user } = useMe();
  const locale = me?.profile.locale === "hi" ? "hi" : "en";
  const t = STR[locale];
  const [skillQuery, setSkillQuery] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [panel, setPanel] = useState<"voice" | "search" | "new" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => listCatalog() });
  const workers = useQuery({
    queryKey: ["workers", me?.profile.lat, me?.profile.lng, placeQuery],
    queryFn: () =>
      searchWorkers({
        data: {
          q: placeQuery || undefined,
          lat: me?.profile.lat ?? null,
          lng: me?.profile.lng ?? null,
        },
      }),
  });
  const bookings = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => listMyBookings(),
    enabled: Boolean(user),
    refetchInterval: 4000,
  });
  const origin = me?.profile.lat && me?.profile.lng
    ? { lat: me.profile.lat, lng: me.profile.lng }
    : { lat: CITIES[0].lat, lng: CITIES[0].lng };

  const pins = useMemo(
    () =>
      (workers.data ?? [])
        .filter((w) => w.lat != null && w.lng != null)
        .map((w) => ({
          id: w.userId,
          ...projectToMap(w.lat!, w.lng!, origin.lat, origin.lng),
        })),
    [workers.data, origin.lat, origin.lng],
  );

  const skills = catalog.data?.skills ?? [];
  const filteredSkills = skills.filter((s) => {
    const q = skillQuery.trim().toLowerCase();
    if (!q) return false;
    return s.name.toLowerCase().includes(q) || s.hindi.includes(skillQuery);
  });
  const nearby = (workers.data ?? []).filter((w) => !(me?.blockedIds ?? []).includes(w.userId));
  const recent = (bookings.data ?? []).slice(0, 3);
  const hi = locale === "hi";
  const liveHire = (bookings.data ?? []).find((b) => b.customer_id === user?.id && isLiveStatus(b.status));

  return (
    <AppShell mode="customer" map={<CityMap workers={pins} />}>
      <div className="flex flex-1 flex-col gap-6 px-4 pb-6 lg:px-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted">
            {meLoading ? "…" : me?.profile.name ? `Namaste, ${me.profile.name}` : "NAKA HOME"}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {hi ? "साइट पर क्या चाहिए?" : "What do you need on site?"}
          </h1>
        </div>
        {liveHire ? (
          <Link
            to="/booking/$id"
            params={{ id: liveHire.id }}
            className="flex items-center justify-between rounded-3xl bg-sage/15 px-4 py-3"
          >
            <span>
              <span className="block text-sm font-medium">
                {(liveHire.crew_size ?? 1) > 1 ? "Group Live Tracking" : "Live tracking"}
              </span>
              <span className="text-xs text-muted">
                {liveHire.skill_name}
                {(liveHire.crew_size ?? 1) > 1
                  ? ` · ${liveHire.accepted_count ?? 0} of ${liveHire.crew_size} accepted`
                  : ` · ${STATUS_LABEL[liveHire.status] ?? liveHire.status}`}
              </span>
            </span>
            <span className="text-xs font-medium text-sage">Open</span>
          </Link>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" className="w-full" asChild>
            <Link to="/hire">
              <Briefcase className="size-4" />
              {t.bookLabour}
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full" asChild>
            <Link to="/work">
              <HardHat className="size-4" />
              {t.joinWorker}
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPanel(panel === "voice" ? null : "voice")}
            className="flex h-20 flex-col items-start justify-center gap-1 rounded-3xl bg-surface px-4 text-left shadow-[var(--shadow-border)]"
          >
            <Mic className="size-4 text-sage" />
            <span className="text-sm font-medium">{hi ? "आवाज़ से खोजें" : "Voice Search"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPanel("search");
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
            className="flex h-20 flex-col items-start justify-center gap-1 rounded-3xl bg-surface px-4 text-left shadow-[var(--shadow-border)]"
          >
            <Search className="size-4 text-sage" />
            <span className="text-sm font-medium">{hi ? "स्किल खोजें" : "Skill Search"}</span>
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "new" ? null : "new")}
            className="flex h-20 flex-col items-start justify-center gap-1 rounded-3xl bg-surface px-4 text-left shadow-[var(--shadow-border)]"
          >
            <Plus className="size-4 text-sage" />
            <span className="text-sm font-medium">{hi ? "नया स्किल" : "New Skill"}</span>
          </button>
          <Link
            to="/hire"
            search={{ all: "1" }}
            className="flex h-20 flex-col items-start justify-center gap-1 rounded-3xl bg-surface px-4 text-left shadow-[var(--shadow-border)]"
          >
            <Briefcase className="size-4 text-sage" />
            <span className="text-sm font-medium">{hi ? "सभी स्किल" : "All Skills"}</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CIVIL_SHORTCUTS.map((s) => (
            <Link
              key={s.id}
              to="/hire"
              search={{ skill: s.id }}
              className="flex h-12 items-center justify-center rounded-2xl bg-raised px-2 text-center text-xs font-medium"
            >
              {hi ? s.hi : s.en}
            </Link>
          ))}
        </div>
        {panel === "voice" ? <VoiceBook hi={hi} /> : null}
        {panel === "new" ? <ProposeSkill hi={hi} /> : null}
        {panel === "search" || skillQuery ? (
          <div className="flex flex-col gap-2">
            <Input
              ref={searchRef}
              placeholder={t.searchSkill}
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
            />
            {skillQuery ? (
              <ul className="flex flex-col gap-1">
                {filteredSkills.slice(0, 8).map((s) => (
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
                {filteredSkills.length === 0 ? (
                  <li className="text-sm text-muted">
                    {hi ? "मैच नहीं मिला। नया स्किल जोड़ें।" : "No match. Add a new skill."}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Input
          placeholder={t.searchLocation}
          value={placeQuery}
          onChange={(e) => setPlaceQuery(e.target.value)}
        />
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-sm font-medium">{t.nearby}</h2>
            <p className="text-xs text-muted tabular-nums">{nearby.length} available</p>
          </div>
          {workers.isLoading ? (
            <p className="text-sm text-muted">Loading workers…</p>
          ) : nearby.length === 0 ? (
            <p className="rounded-3xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]">
              {t.noWorkers}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {nearby.slice(0, 4).map((w) => (
                <WorkerCard key={w.userId} worker={w} />
              ))}
              <Button size="lg" variant="paper" className="mt-1 w-full" asChild>
                <Link to="/workers" search={{ q: placeQuery || skillQuery || undefined }}>
                  {nearby.length > 4 ? `${t.seeMore} · ${nearby.length - 4} more` : t.seeMore}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          )}
          {nearby.length === 0 ? (
            <Button size="lg" variant="paper" className="mt-3 w-full" asChild>
              <Link to="/workers" search={{ q: placeQuery || skillQuery || undefined }}>
                {t.seeMore}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </section>
        <section>
          <h2 className="font-display text-sm font-medium">{t.recent}</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No bookings yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {recent.map((b) => (
                <li key={b.id}>
                  <Link
                    to="/booking/$id"
                    params={{ id: b.id }}
                    className="flex items-center justify-between rounded-3xl bg-surface px-4 py-3 text-sm shadow-[var(--shadow-border)]"
                  >
                    <span>
                      <span className="block font-medium">{b.skill_name}</span>
                      <span className="text-xs text-muted">{STATUS_LABEL[b.status] ?? b.status}</span>
                    </span>
                    <span className="text-xs text-muted">{b.work_date || "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
