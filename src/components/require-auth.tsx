import type { ReactNode } from "react";
import { Boot } from "@/components/boot";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Boot />;
  if (!user) return <RedirectToSignIn />;
  return <>{children}</>;
}
