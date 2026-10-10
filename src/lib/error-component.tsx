import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { SIGN_IN_PATH } from "@/lib/auth/gates";
import { isNullSubError } from "@/lib/auth/use-current-user";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const unauth =
    isNullSubError(error) ||
    (error instanceof Error && (error.message === "Unauthorized" || error.name === "UnauthorizedError"));

  if (unauth) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-5 text-center text-fg">
        <div>
          <h1 className="font-display text-xl font-semibold">Sign in to continue</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            You are signed out. Open NAKA HOME again after signing in.
          </p>
          <Link
            to={SIGN_IN_PATH}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "An unexpected error occurred. Try reloading the page."}
      </p>
      <Link to="/" className="mt-2 text-sm text-sage underline-offset-2 hover:underline">
        Back home
      </Link>
    </main>
  );
}
