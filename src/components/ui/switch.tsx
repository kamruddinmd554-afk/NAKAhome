import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-line transition-[background-color] duration-150 ease-out data-[state=checked]:bg-good outline-none focus-visible:shadow-[0_0_0_3px_var(--color-bg),0_0_0_5px_var(--color-ring)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-1 rounded-full bg-paper transition-transform duration-150 ease-out data-[state=checked]:translate-x-6" />
    </SwitchPrimitive.Root>
  );
}
