import { useQuery } from "@tanstack/react-query";
import { isNullSubError, useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMe } from "@/lib/server/inbook";

function isSignedOutError(error: unknown) {
  if (isNullSubError(error)) return true;
  return error instanceof Error && (error.message === "Unauthorized" || error.name === "UnauthorizedError");
}

export function useMe() {
  const { user, isPending } = useCurrentUserState();
  const query = useQuery({
    queryKey: ["me", user?.id ?? "signed-out"],
    queryFn: async () => {
      try {
        return await getMe();
      } catch (error) {
        if (isSignedOutError(error)) return null;
        throw error;
      }
    },
    enabled: Boolean(user),
    retry: false,
  });
  return {
    user,
    sessionPending: isPending,
    me: query.data ?? null,
    meLoading: isPending || (Boolean(user) && query.isLoading),
    refetchMe: query.refetch,
  };
}
