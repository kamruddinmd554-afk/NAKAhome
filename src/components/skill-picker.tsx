import { useQuery } from "@tanstack/react-query";
import { Mic, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCatalog, proposeSkill } from "@/lib/server/inbook";
import { cn } from "@/lib/utils";

const COMMON = [
  "mazdoor",
  "construction-helper",
  "loading-labour",
  "raj-mistri",
  "painter",
  "electrician",
  "plumber",
  "tile-fitter",
];

type Skill = { id: string; name: string; hindi: string; category_id: string };

export function ProposeSkill({
  hi,
  onAdded,
}: {
  hi?: boolean;
  onAdded?: (s: { id: string; name: string; status: string }) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (name.trim().length < 2) {
      toast(hi ? "काम का नाम लिखें" : "Enter the skill name");
      return;
    }
    setBusy(true);
    try {
      const res = await proposeSkill({ data: { name: name.trim() } });
      if (res.status === "pending" && !res.existing) {
        toast(hi ? "एडमिन अप्रूवल के लिए भेज दिया गया" : "Sent for admin approval");
      } else if (res.status === "approved") {
        toast(hi ? "यह काम पहले से सूची में है" : "This skill is already listed");
      } else {
        toast(hi ? "यह अनुरोध पहले से पेंडिंग है" : "This skill is already pending approval");
      }
      onAdded?.(res);
      setName("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add skill");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="font-display text-sm font-medium">{hi ? "नया काम जोड़ें" : "New skill"}</p>
      <p className="mt-1 text-xs text-muted">
        {hi
          ? "सूची में नहीं है तो नाम लिखें। एडमिन अप्रूव के बाद ग्राहकों को दिखेगा।"
          : "If the trade is missing, add it. Customers see it after admin approval."}
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={hi ? "जैसे: स्टील फिक्सर" : "e.g. Steel fixer"}
        />
        <Button type="button" size="icon" variant="secondary" disabled={busy} onClick={() => void submit()} aria-label="Add skill">
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  );
}

export function SkillPicker({
  selected,
  onToggle,
  extra = [],
  hi,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  extra?: Array<{ id: string; name: string; status?: string }>;
  hi?: boolean;
}) {
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => listCatalog() });
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const skills = catalog.data?.skills ?? [];
  const categories = catalog.data?.categories ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return skills;
    return skills.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.hindi.includes(q) || s.id.includes(needle),
    );
  }, [skills, q]);

  const common = skills.filter((s) => COMMON.includes(s.id));
  const shown: Skill[] = q ? filtered.slice(0, 16) : all ? [] : common;

  return (
    <div className="flex flex-col gap-4">
      <label className="relative block">
        <Search className="absolute top-3.5 left-3.5 size-4 text-subtle" />
        <Input
          className="pl-10"
          placeholder={hi ? "काम खोजें" : "Search skill"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const s = skills.find((x) => x.id === id) ?? extra.find((x) => x.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggle(id)}
                className="h-10 rounded-full bg-accent px-3 text-sm text-accent-fg"
              >
                {s?.name ?? id} ×
              </button>
            );
          })}
        </div>
      ) : null}
      {!all && !q ? <p className="text-xs text-muted">{hi ? "आम काम — एक से ज़्यादा चुन सकते हैं" : "Common trades — select more than one"}</p> : null}
      {shown.length ? (
        <div className="grid grid-cols-2 gap-2">
          {shown.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s.id)}
                className={cn(
                  "flex min-h-16 items-center gap-2 rounded-2xl px-3 text-left text-sm shadow-[var(--shadow-border)]",
                  on ? "bg-accent text-accent-fg" : "bg-surface",
                )}
              >
                <CategoryIcon id={s.id} className={on ? "text-accent-fg" : "text-sage"} />
                <span>{hi ? s.hindi || s.name : s.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {extra
        .filter((s) => s.status === "pending")
        .map((s) => (
          <p key={s.id} className="text-xs text-muted">
            {s.name} · {hi ? "एडमिन अप्रूवल पेंडिंग" : "Pending admin approval"}
          </p>
        ))}
      {!q ? (
        <Button type="button" variant="paper" onClick={() => setAll((v) => !v)}>
          {all ? (hi ? "कम दिखाएँ" : "Show less") : hi ? "सभी काम" : "All skills"}
        </Button>
      ) : null}
      {all && !q
        ? categories.map((cat) => (
            <div key={cat.id}>
              <p className="mb-2 text-xs font-medium text-muted">{hi ? cat.hindi : cat.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {skills
                  .filter((s) => s.category_id === cat.id)
                  .map((s) => {
                    const on = selected.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onToggle(s.id)}
                        className={cn(
                          "flex min-h-14 items-center gap-2 rounded-2xl px-3 text-left text-sm",
                          on ? "bg-accent text-accent-fg" : "bg-raised",
                        )}
                      >
                        <span>{hi ? s.hindi || s.name : s.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}

export function SkillSearchHint({ className }: { className?: string }) {
  return <Mic className={cn("size-4", className)} />;
}
