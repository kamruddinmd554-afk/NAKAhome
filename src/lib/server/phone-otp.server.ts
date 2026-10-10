import { createRemoteJWKSet, jwtVerify } from "jose";
import { serializeSignedCookie } from "better-call";
import { parseSetCookieHeader } from "better-auth/cookies";
import { getFirebaseWebConfig } from "@/lib/firebase-config";
import { phoneToEmail } from "@/lib/phone-login";
import { getSql } from "@/lib/db";
import { digitsPhone, isValidInPhone } from "@/lib/utils";

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

const AUTH_TIME_MAX_AGE_SEC = 15 * 60;

function e164ToDigits(phone: string) {
  const digits = digitsPhone(phone);
  if (!isValidInPhone(digits)) {
    throw new Error("Firebase verified a number that is not a valid Indian mobile.");
  }
  return digits;
}

export async function verifyFirebasePhoneIdToken(idToken: string) {
  const config = getFirebaseWebConfig();
  if (!config) {
    throw new Error("Firebase Phone Authentication is not configured on the server.");
  }
  if (!idToken || idToken.length < 40) {
    throw new Error("Missing Firebase ID token.");
  }
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${config.projectId}`,
    audience: config.projectId,
    clockTolerance: 5,
  });
  const firebase = payload.firebase as { sign_in_provider?: string } | undefined;
  if (firebase?.sign_in_provider !== "phone") {
    throw new Error("Phone verification required.");
  }
  const authTime = typeof payload.auth_time === "number" ? payload.auth_time : 0;
  if (!authTime || Date.now() / 1000 - authTime > AUTH_TIME_MAX_AGE_SEC) {
    throw new Error("Verification expired. Request a new OTP.");
  }
  const phone = typeof payload.phone_number === "string" ? payload.phone_number : "";
  if (!phone) {
    throw new Error("Firebase token did not include a phone number.");
  }
  return { phone: e164ToDigits(phone) };
}

async function mintSession(userId: string): Promise<{ token: string }> {
  const { auth, SESSION_TOKEN_COOKIE } = await import("@/lib/auth/server");
  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(userId);
  if (!session?.token) {
    throw new Error("Could not create a signed-in session.");
  }
  const maxAge = ctx.sessionConfig?.expiresIn ?? 60 * 60 * 24 * 7;
  const header = await serializeSignedCookie(SESSION_TOKEN_COOKIE, session.token, ctx.secret, {
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "lax",
    maxAge,
  });
  const cookieValue = parseSetCookieHeader(header).get(SESSION_TOKEN_COOKIE)?.value;
  if (!cookieValue) {
    throw new Error("Could not sign the session cookie.");
  }
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(SESSION_TOKEN_COOKIE, cookieValue, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge,
    });
  } catch {
    /* preview may still authenticate via the returned bearer token */
  }
  return { token: cookieValue };
}

export async function completeVerifiedPhoneLogin(idToken: string, name?: string) {
  const { phone } = await verifyFirebasePhoneIdToken(idToken);
  const sql = await getSql();
  const email = phoneToEmail(phone);

  const byPhone = await sql<{ user_id: string; suspended: boolean; name: string }>`
    select user_id, suspended, name from profiles
    where phone = ${phone}
    order by created_at asc
    limit 1
  `;
  const byEmail = await sql<{ id: string; name: string }>`
    select id, name from "user" where email = ${email} limit 1
  `;

  let userId = byPhone[0]?.user_id || byEmail[0]?.id || "";
  const displayName = (name ?? "").trim() || byPhone[0]?.name || byEmail[0]?.name || "";

  if (!userId) {
    if (displayName.length < 2) {
      throw new Error("Enter your full name to create the account.");
    }
    const { auth } = await import("@/lib/auth/server");
    const ctx = await auth.$context;
    const created = await ctx.internalAdapter.createUser({
      email,
      name: displayName,
      emailVerified: true,
    });
    if (!created?.id) throw new Error("Could not create account.");
    userId = created.id;
  }

  const suspended = await sql<{ suspended: boolean }>`
    select suspended from profiles where user_id = ${userId}
  `;
  if (suspended[0]?.suspended) {
    throw new Error("This account is suspended.");
  }

  const admins = await sql<{ n: number }>`select count(*)::int as n from profiles where is_admin = true`;
  const makeAdmin = (admins[0]?.n ?? 0) === 0;
  await sql`
    insert into profiles (user_id, name, phone, phone_verified, is_admin)
    values (
      ${userId},
      ${displayName || "Member"},
      ${phone},
      true,
      ${makeAdmin}
    )
    on conflict (user_id) do update set
      phone = excluded.phone,
      phone_verified = true,
      name = case
        when profiles.name is null or profiles.name = '' or profiles.name = 'Member'
        then excluded.name
        else profiles.name
      end
  `;

  return mintSession(userId);
}
