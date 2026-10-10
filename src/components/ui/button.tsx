import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium outline-none transition-[scale,background-color,color,opacity,box-shadow] duration-150 ease-out active:not-disabled:scale-[0.96] focus-visible:shadow-[0_0_0_3px_var(--color-bg),0_0_0_5px_var(--color-ring)] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-paper",
        secondary: "bg-raised text-fg hover:bg-line",
        outline: "bg-transparent text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
        ghost: "bg-transparent text-fg hover:bg-raised",
        paper: "bg-paper text-ink hover:bg-accent",
        danger: "bg-danger text-paper",
      },
      size: {
        sm: "h-10 rounded-lg px-3 text-sm",
        md: "h-12 rounded-xl px-4 text-sm",
        lg: "h-14 rounded-2xl px-5 text-base",
        icon: "size-12 rounded-xl",
        pill: "h-10 rounded-full px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
