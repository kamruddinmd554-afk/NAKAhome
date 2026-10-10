import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { isNullSubError } from "@/lib/auth/use-current-user";
import { SIGN_IN_PATH } from "@/lib/auth/gates";

function isUnauthorized(error: unknown) {
  return (
    isNullSubError(error) ||
    (error instanceof Error && (error.message === "Unauthorized" || error.name === "UnauthorizedError"))
  );
}

function SessionCrashGuard() {
  useEffect(() => {
    const goLogin = () => {
      if (typeof window === "undefined") return;
      if (window.location.pathname === SIGN_IN_PATH) return;
      window.location.assign(SIGN_IN_PATH);
    };
    const onError = (event: ErrorEvent) => {
      if (isNullSubError(event.error) || isNullSubError(event.message)) {
        event.preventDefault();
        goLogin();
      }
    };
    const onReject = (event: PromiseRejectionEvent) => {
      if (isNullSubError(event.reason)) {
        event.preventDefault();
        goLogin();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 8_000,
            retry: (count, error) => (isUnauthorized(error) ? false : count < 1),
            refetchOnWindowFocus: false,
            throwOnError: false,
          },
          mutations: {
            throwOnError: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionCrashGuard />
      {children}
    </QueryClientProvider>
  );
}
