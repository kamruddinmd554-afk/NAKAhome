import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TONES = [
  "bg-raised text-accent",
  "bg-line text-paper",
  "bg-good/20 text-good",
  "bg-sage/20 text-sage",
];

export function WorkerAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tone = TONES[name.length % TONES.length]!;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display font-semibold tracking-tight",
        size === "sm" && "size-9 text-xs",
        size === "md" && "size-12 text-sm",
        size === "lg" && "size-16 text-lg",
        tone,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
