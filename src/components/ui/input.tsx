import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl bg-raised px-3.5 text-sm text-fg outline-none placeholder:text-subtle shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 ease-out focus-visible:shadow-[0_0_0_3px_var(--color-bg),0_0_0_5px_var(--color-ring)]",
          className,
        )}
        {...props}
      />
    );
  },
);
