import { cn } from "@/lib/utils";

export type MapPin = {
  id: string;
  x: number;
  y: number;
  live?: boolean;
  photo?: string | null;
  label?: string;
};

const USER = { x: 50, y: 54 };

export function CityMap({
  workers = [],
  focusId,
  searching = false,
  user = USER,
  className,
  onPick,
  onSelectWorker,
  live = false,
  tracking = false,
  siteLabel = "Site",
}: {
  workers?: MapPin[];
  focusId?: string;
  searching?: boolean;
  user?: { x: number; y: number };
  className?: string;
  onPick?: (x: number, y: number) => void;
  onSelectWorker?: (id: string) => void;
  live?: boolean;
  tracking?: boolean;
  siteLabel?: string;
}) {
  const liveCount = workers.filter((w) => w.live).length;

  return (
    <div className={cn("relative overflow-hidden bg-map", className)}>
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        onClick={
          onPick
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                onPick(x, y);
              }
            : undefined
        }
      >
        <rect width="100" height="100" fill="var(--color-map)" />
        <g opacity="0.55">
          <path d="M0 18 H100" stroke="var(--color-map-road)" strokeWidth="2.4" />
          <path d="M0 34 H100" stroke="var(--color-line)" strokeWidth="1.6" />
          <path d="M0 52 H100" stroke="var(--color-map-road)" strokeWidth="2.8" />
          <path d="M0 68 H100" stroke="var(--color-line)" strokeWidth="1.4" />
          <path d="M0 84 H100" stroke="var(--color-map-road)" strokeWidth="2" />
          <path d="M16 0 V100" stroke="var(--color-map-road)" strokeWidth="2.2" />
          <path d="M38 0 V100" stroke="var(--color-line)" strokeWidth="1.5" />
          <path d="M58 0 V100" stroke="var(--color-map-road)" strokeWidth="3" />
          <path d="M78 0 V100" stroke="var(--color-line)" strokeWidth="1.6" />
        </g>
        <rect x="8" y="38" width="18" height="12" rx="2" fill="var(--color-map-park)" />
        <rect x="63" y="8" width="22" height="16" rx="3" fill="var(--color-map-park)" />
        <path
          d="M0 92 C 24 86, 40 96, 62 90 S 88 84, 100 88 L100 100 L0 100 Z"
          fill="var(--color-map-water)"
        />
        <text x="16" y="14" fill="var(--color-map-label)" fontSize="3.2" fontFamily="Sora, sans-serif">
          {tracking ? "Live tracking" : "Site map"}
        </text>

        {searching ? (
          <g>
            <circle cx={user.x} cy={user.y} r="14" fill="none" stroke="var(--color-sage)" strokeWidth="0.4" className="pulse-ring" />
            <circle cx={user.x} cy={user.y} r="14" fill="none" stroke="var(--color-sage)" strokeWidth="0.4" className="pulse-ring" style={{ animationDelay: "0.7s" }} />
          </g>
        ) : null}

        {workers.map((w) => (
          <path
            key={`r-${w.id}`}
            d={`M ${w.x} ${w.y} Q ${(w.x + user.x) / 2} ${Math.min(w.y, user.y) - 12} ${user.x} ${user.y}`}
            fill="none"
            stroke={w.live ? "var(--color-good)" : "var(--color-accent)"}
            strokeWidth={w.id === focusId ? 1.15 : 0.7}
            strokeDasharray="1.8 1.1"
            opacity={w.live ? 0.95 : 0.55}
          />
        ))}

        <circle cx={user.x} cy={user.y} r="3.4" fill="var(--color-paper)" />
        <circle cx={user.x} cy={user.y} r="1.2" fill="var(--color-ink)" />
      </svg>

      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
        style={{ left: `${user.x}%`, top: `${user.y}%` }}
      >
        <span className="mb-1 block rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium text-ink">
          {siteLabel}
        </span>
      </div>

      {workers.map((w) => (
        <div
          key={w.id}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-700 ease-out",
            onSelectWorker ? "z-[6] cursor-pointer" : "",
          )}
          style={{ left: `${w.x}%`, top: `${w.y}%`, zIndex: w.id === focusId ? 5 : 2 }}
          onClick={onSelectWorker ? (e) => { e.stopPropagation(); onSelectWorker(w.id); } : undefined}
        >
          {w.live ? (
            <span className="absolute inset-0 -m-2 rounded-full border border-good/70 pulse-ring" />
          ) : null}
          {w.photo ? (
            <img
              src={w.photo}
              alt=""
              className={cn(
                "size-9 rounded-full object-cover shadow-[var(--shadow-border)]",
                w.live ? "ring-2 ring-good" : "ring-2 ring-accent",
              )}
            />
          ) : (
            <span className={cn("block size-4 rounded-full", w.live ? "bg-good" : "bg-accent")} />
          )}
          {w.label ? (
            <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg/85 px-2 py-0.5 text-[10px] font-medium text-fg">
              {w.label}
            </span>
          ) : null}
        </div>
      ))}

      {live || liveCount > 0 ? (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-bg/85 px-2.5 py-1 text-[11px] font-medium text-good">
          <span className="size-1.5 rounded-full bg-good" />
          {liveCount > 1 ? `${liveCount} live` : "Worker is live"}
        </span>
      ) : tracking ? (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-bg/85 px-2.5 py-1 text-[11px] font-medium text-muted">
          Location unavailable
        </span>
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          tracking ? "bg-gradient-to-b from-transparent via-transparent to-bg/40" : "bg-gradient-to-b from-bg/20 via-transparent to-bg/70",
        )}
      />
    </div>
  );
}
