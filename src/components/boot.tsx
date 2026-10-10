import { Logo } from "@/components/logo";

export function Boot() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg text-fg">
      <div className="reveal">
        <Logo size="lg" />
      </div>
    </div>
  );
}
