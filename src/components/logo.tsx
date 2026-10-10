import { cn } from "@/lib/utils";

const SIZE = {
  sm: "h-11",
  md: "h-12",
  lg: "h-[4.5rem]",
} as const;

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn("inline-flex items-center justify-center leading-none", className)}
      aria-label="NAKA HOME"
    >
      <img
        src="/naka-home-lockup.png"
        alt="NAKA HOME"
        className={cn("w-auto max-w-[11rem] rounded-xl object-contain object-center", SIZE[size])}
      />
    </span>
  );
}
