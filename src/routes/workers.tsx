import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CityMap } from "@/components/city-map";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkerCard } from "@/components/worker-card";
import { CATALOG_CATEGORIES, CATALOG_SKILLS } from "@/lib/catalog";
import { CITIES } from "@/lib/data";
import { projectToMap } from "@/lib/geo";
import { STR } from "@/lib/i18n";
import { searchWorkers } from "@/lib/server/inbook";
import { useMe } from "@/lib/use-me";

type WorkersSearch = {
  skill?: string;
  q?: string;
};

export const Route = createFileRoute("/workers")({
  validateSearch: (s: Record<string, unknown>): WorkersSearch => ({
    skill: typeof s.skill === "string" ? s.skill : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: () => (
    <RequireAuth>
      <WorkersPage />
    </RequireAuth>
  ),
});

const RATE_PRESETS = [
  { id: "any", min: undefined, max: undefined, label: "Any rate" },
  { id: "lt300", min: undefined, max: 300, label: "Under ₹300" },
  { id: "300600", min: 300, max: 600, label: "₹300–600" },
  { id: "6001000", min: 600, max: 1000, label: "₹600–1,000" },
  { id: "gt1000", min: 1000, max: undefined, label: "₹1,000+" },
] as const;

function WorkersPage() {
  const search = Route.useSearch();
  const { me } = useMe();
  const t = STR[me?.profile.locale === "hi" ? "hi" : "en"];
  const [q, setQ] = useState(search.q ?? "");
  const [skill, setSkill] = useState(search.skill ?? "");
  const [place, setPlace] = useState("");
  const [rateId, setRateId] = useState<(typeof RATE_PRESETS)[number]["id"]>("any");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [filtersOpen, setFiltersOpen] = useState(true);
  const rate = RATE_PRESETS.find((r) => r.id === rateId) ?? RATE_PRESETS[0];
  const query = [q, place].filter(Boolean).join(" ");

  const workers = useQuery({
    queryKey: ["workers-all", skill, query, rateId, availableOnly, workDate, me?.profile.lat, me?.profile.lng],
    queryFn: () =>
      searchWorkers({
        data: {
          skillId: skill || undefined,
          q: query || undefined,
          lat: me?.profile.lat ?? null,
          lng: me?.profile.lng ?? null,
          workDate: workDate || undefined,
          minRate: rate.min,
          maxRate: rate.max,
          availableOnly,
        },
      }),
  });

  const blocked = me?.blockedIds ?? [];
  const list = (workers.data ?? []).filter((w) => !blocked.includes(w.userId));
  const origin = me?.profile.lat && me?.profile.lng
    ? { lat: me.profile.lat, lng: me.profile.lng }
    : { lat: CITIES[0].lat, lng: CITIES[0].lng };
  const pins = useMemo(
    () =>
      list
        .filter((w) => w.lat != null && w.lng != null)
        .slice(0, 24)
        .map((w) => ({
          id: w.userId,
          ...projectToMap(w.lat!, w.lng!, origin.lat, origin.lng),
        })),
    [list, origin.lat, origin.lng],
  );

  return (
    <AppShell mode="customer" map={<CityMap workers={pins} />}>
      <div className="flex flex-1 flex-col gap-4 px-4 pb-6 lg:px-5">
        <div className="flex items-center gap-2">
          <Link to="/" className="grid size-11 place-items-center rounded-xl hover:bg-raised">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{t.nearby}</p>
            <h1 className="font-display text-xl font-semibold tracking-tight">{t.allWorkers}</h1>
          </div>
          <Button
            type="button"
            variant={filtersOpen ? "primary" : "secondary"}
            size="icon"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label={t.filters}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        </div>

        <label className="relative block">
          <Search className="absolute top-3.5 left-3.5 size-4 text-subtle" />
          <Input
            className="pl-10"
            placeholder={`${t.searchSkill} / name`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        {filtersOpen ? (
          <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium tracking-wide text-muted">{t.filters}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="skill">{t.searchSkill}</Label>
              <select
                id="skill"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                className="h-12 w-full rounded-xl bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              >
                <option value="">{t.anySkill}</option>
                {CATALOG_CATEGORIES.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    {CATALOG_SKILLS.filter((s) => s.categoryId === cat.id).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="place">{t.searchLocation}</Label>
              <Input
                id="place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="City, area, village"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">{t.workDate}</Label>
              <Input id="date" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
            </div>
            <div>
              <p className="mb-2 text-sm">{t.dailyRate}</p>
              <div className="flex flex-wrap gap-2">
                {RATE_PRESETS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRateId(r.id)}
                    className={
                      rateId === r.id
                        ? "h-10 rounded-full bg-accent px-3 text-sm text-accent-fg"
                        : "h-10 rounded-full bg-raised px-3 text-sm text-muted"
                    }
                  >
                    {r.id === "any" ? t.anyRate : r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAvailableOnly(true)}
                className={
                  availableOnly
                    ? "h-12 rounded-2xl bg-accent text-sm font-medium text-accent-fg"
                    : "h-12 rounded-2xl bg-raised text-sm text-muted"
                }
              >
                {t.availableNow}
              </button>
              <button
                type="button"
                onClick={() => setAvailableOnly(false)}
                className={
                  !availableOnly
                    ? "h-12 rounded-2xl bg-accent text-sm font-medium text-accent-fg"
                    : "h-12 rounded-2xl bg-raised text-sm text-muted"
                }
              >
                {t.includeOffline}
              </button>
            </div>
            <p className="text-xs text-muted">{t.busyHidden}</p>
          </div>
        ) : null}

        <p className="text-xs text-muted tabular-nums">
          {workers.isLoading ? "Loading…" : `${list.length} workers`}
        </p>
        {workers.isLoading ? (
          <p className="text-sm text-muted">Loading workers…</p>
        ) : list.length === 0 ? (
          <p className="rounded-3xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]">{t.noWorkers}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((w) => (
              <WorkerCard key={w.userId} worker={w} skillId={skill || undefined} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
