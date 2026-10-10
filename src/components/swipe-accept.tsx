import { ChevronRight } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";

export function SwipeAccept({
  onAccept,
  label = "Slide to accept",
}: {
  onAccept: () => void;
  label?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const start = useRef(0);
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [done, setDone] = useState(false);

  function maxTravel() {
    const el = trackRef.current;
    return el ? Math.max(80, el.clientWidth - 56) : 220;
  }

  function finish() {
    if (done) return;
    setDone(true);
    setDx(maxTravel());
    onAccept();
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (done) return;
    dragging.current = true;
    start.current = event.clientX - dxRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!dragging.current || done) return;
    const cap = maxTravel();
    const next = Math.min(cap, Math.max(0, event.clientX - start.current));
    dxRef.current = next;
    setDx(next);
    if (next > cap * 0.84) {
      dragging.current = false;
      finish();
    }
  }

  function onPointerUp() {
    if (!dragging.current || done) return;
    dragging.current = false;
    const cap = maxTravel();
    if (dxRef.current > cap * 0.72) finish();
    else {
      dxRef.current = 0;
      setDx(0);
    }
  }

  return (
    <div
      ref={trackRef}
      className="relative h-14 overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]"
    >
      <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">
        {label}
      </span>
      <button
        type="button"
        aria-label={label}
        className="absolute top-1 left-1 grid size-12 place-items-center rounded-xl bg-accent text-accent-fg transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <ChevronRight className="size-5" strokeWidth={2} />
      </button>
    </div>
  );
}
