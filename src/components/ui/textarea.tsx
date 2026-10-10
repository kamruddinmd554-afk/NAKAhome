import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-none rounded-xl bg-raised px-3.5 py-3 text-sm text-fg outline-none placeholder:text-subtle shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 ease-out focus-visible:shadow-[0_0_0_3px_var(--color-bg),0_0_0_5px_var(--color-ring)]",
        className,
      )}
      {...props}
    />
  );
}
