import { useRef, type KeyboardEvent, type ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

export function PinInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function setAt(i: number, char: string) {
    const next = value.split("");
    while (next.length < 6) next.push("");
    next[i] = char;
    onChange(next.join("").replace(/\s/g, "").slice(0, 6));
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) {
        setAt(i, "");
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        setAt(i - 1, "");
      }
      return;
    }
    if (e.key.length === 1 && /\d/.test(e.key)) {
      e.preventDefault();
      const next = `${value.slice(0, i)}${e.key}${value.slice(i + 1)}`.slice(0, 6);
      onChange(next);
      refs.current[Math.min(i + 1, 5)]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          onChange={() => undefined}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          className={cn(
            "h-14 w-11 rounded-2xl bg-raised text-center font-display text-xl tabular-nums text-fg shadow-[var(--shadow-border)] outline-none focus:shadow-[0_0_0_3px_var(--color-bg),0_0_0_5px_var(--color-ring)]",
          )}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
