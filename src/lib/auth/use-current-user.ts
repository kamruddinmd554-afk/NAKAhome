import { authClient, authEnabled } from "./client";
import { DEV_USER, isNullSubError, userFromSessionRecord, type AppUser } from "./session-user";

export type { AppUser } from "./session-user";
export { DEV_USER, isNullSubError, readSub, userFromSessionRecord } from "./session-user";

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

function sessionToUser(session: unknown): AppUser | null {
  if (!session || typeof session !== "object") return null;
  const data = session as Record<string, unknown>;
  if (isNullSubError(data.error)) return null;
  const payload = "data" in data ? data.data : session;
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as Record<string, unknown>;
  if ("user" in rec) return userFromSessionRecord(rec.user);
  return userFromSessionRecord(rec);
}

/**
 * Current user + loading state. Same behavior in live preview and when deployed:
 *   - Auth enabled -> the real signed-in user; `user` is `null` while
 *                            the session resolves (`isPending: true`) and when
 *                            signed out (`isPending: false`).
 *   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
 *
 * Protect a route by waiting out `isPending` before acting on `user`.
 *
 * `authEnabled` is a module-level constant fixed at load, so the guarded hook
 * call keeps a stable hook order across every render of a given component.
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
  const session = authClient.useSession();
  try {
    if (isNullSubError((session as { error?: unknown } | null)?.error)) {
      return { user: null, isPending: false };
    }
    const user = sessionToUser(session);
    return {
      user,
      isPending: Boolean((session as { isPending?: boolean } | null)?.isPending) && !user,
    };
  } catch (error) {
    if (isNullSubError(error)) return { user: null, isPending: false };
    throw error;
  }
}

/**
 * Convenience view of `useCurrentUserState().user` for display.
 * `null` means loading OR signed out — for redirects use `useCurrentUserState()`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
