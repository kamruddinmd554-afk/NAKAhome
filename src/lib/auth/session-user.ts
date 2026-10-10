/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Read JWT/session `sub` only from a real object — never from null. */
export function readSub(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  return readString((raw as Record<string, unknown>).sub);
}

export function isNullSubError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /Cannot read propert(?:y|ies) of null \(reading ['"]sub['"]\)|Cannot read property ['"]sub['"] of null/i.test(
    msg,
  );
}

/**
 * Map a Better Auth / JWT user record to AppUser.
 * Never read `.sub` on a null user — logged-out sessions are null.
 */
export function userFromSessionRecord(raw: unknown): AppUser | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const nested =
    rec.user && typeof rec.user === "object" ? (rec.user as Record<string, unknown>) : rec;
  const id = readString(nested.id) ?? readSub(nested) ?? readSub(rec);
  if (!id) return null;
  return {
    id,
    displayName: readString(nested.name) ?? readString(nested.displayName) ?? readString(rec.name),
    primaryEmail: readString(nested.email) ?? readString(nested.primaryEmail) ?? readString(rec.email),
    profileImageUrl:
      readString(nested.image) ?? readString(nested.profileImageUrl) ?? readString(rec.image),
    isDevFallback: false,
  };
}
