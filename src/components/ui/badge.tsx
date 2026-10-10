import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "muted" | "good" | "paper" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "muted" && "bg-raised text-muted",
        tone === "good" && "bg-good/15 text-good",
        tone === "paper" && "bg-paper/10 text-paper",
        tone === "accent" && "bg-accent text-accent-fg",
        className,
      )}
      {...props}
    />
  );
}
