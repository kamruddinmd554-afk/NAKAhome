import { getFirebaseWebConfig } from "@/lib/firebase-config";
import { digitsPhone } from "@/lib/utils";
import type { Auth, ConfirmationResult, RecaptchaVerifier } from "firebase/auth";

const APP_NAME = "nakahome";
const RECAPTCHA_ID = "naka-firebase-recaptcha";
const SEND_BUTTON_ID = "naka-send-otp";
const RESEND_MS = 60_000;

let authSingleton: Auth | null = null;
let verifier: RecaptchaVerifier | null = null;
let confirmation: ConfirmationResult | null = null;

export function e164India(phone: string) {
  return `+91${digitsPhone(phone)}`;
}

function firebaseErrorDetails(error: unknown): { code: string; raw: string } {
  const obj = error && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const code = obj && "code" in obj ? String(obj.code ?? "") : "";
  const chunks: string[] = [];
  if (error instanceof Error && error.message) chunks.push(error.message);
  if (obj?.message) chunks.push(String(obj.message));
  const custom = obj?.customData;
  if (custom && typeof custom === "object") {
    try {
      chunks.push(JSON.stringify(custom));
    } catch {
      /* ignore */
    }
  }
  return { code, raw: chunks.join(" ").toLowerCase() };
}

function isCaptchaError(details: { code: string; raw: string }) {
  return (
    details.code === "auth/captcha-check-failed" ||
    details.code === "auth/invalid-app-credential" ||
    details.code === "auth/missing-app-credential" ||
    details.raw.includes("captcha") ||
    details.raw.includes("app-credential")
  );
}

export function firebaseOtpMessage(error: unknown): string {
  const details = firebaseErrorDetails(error);
  const { code, raw } = details;

  if (
    raw.includes("region") ||
    raw.includes("sms unable") ||
    (code === "auth/operation-not-allowed" && raw.includes("sms"))
  ) {
    return "Firebase Phone is enabled, but India (+91) SMS is blocked by the SMS region policy. In Firebase Console → Authentication → Sign-in method → Phone → SMS region policy, allow India, then tap Send OTP again.";
  }

  if (code === "auth/unauthorized-domain" || raw.includes("unauthorized domain") || raw.includes("auth domain")) {
    return "This website domain is not in Firebase authorized domains. Add inbooc.grok.me under Authentication → Settings → Authorized domains.";
  }

  switch (code) {
    case "auth/invalid-verification-code":
    case "auth/invalid-verification-id":
      return "Wrong OTP. Check the 6-digit SMS and try again.";
    case "auth/code-expired":
    case "auth/session-expired":
      return "This OTP has expired. Request a new code.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/quota-exceeded":
      return "SMS could not be sent right now (quota). Try again later.";
    case "auth/billing-not-enabled":
      return "Firebase billing (Blaze) is required to send real +91 SMS.";
    case "auth/captcha-check-failed":
    case "auth/invalid-app-credential":
    case "auth/missing-app-credential":
      return "Security check failed. Complete the reCAPTCHA and try again.";
    case "auth/operation-not-allowed":
      return "Firebase could not send SMS to this number. Allow India (+91) in Authentication → Phone → SMS region policy, then try Send OTP again.";
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return "Enter a valid 10-digit Indian mobile number.";
    case "auth/network-request-failed":
      return "Network error. Check your internet and try again.";
    case "auth/admin-restricted-operation":
      return "This domain is not authorized for Firebase Phone Authentication. Add it under Authorized domains.";
    default:
      return error instanceof Error ? error.message : "Could not send or verify the OTP.";
  }
}

async function firebaseAuth(): Promise<Auth> {
  const config = getFirebaseWebConfig();
  if (!config) {
    throw new Error("Firebase Phone Authentication is not configured.");
  }
  const { initializeApp, getApps } = await import("firebase/app");
  const { getAuth } = await import("firebase/auth");
  const existing = getApps().find((app) => app.name === APP_NAME);
  const app =
    existing ??
    initializeApp(
      {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        appId: config.appId,
        messagingSenderId: config.messagingSenderId,
      },
      APP_NAME,
    );
  authSingleton ??= getAuth(app);
  authSingleton.useDeviceLanguage();
  return authSingleton;
}

function clearVerifier() {
  if (!verifier) return;
  try {
    verifier.clear();
  } catch {
    /* widget already gone */
  }
  verifier = null;
}

async function makeVerifier(auth: Auth, visible: boolean): Promise<RecaptchaVerifier> {
  const { RecaptchaVerifier } = await import("firebase/auth");
  if (typeof document === "undefined") {
    throw new Error("Phone OTP must be requested from the browser.");
  }
  clearVerifier();
  const button = document.getElementById(SEND_BUTTON_ID);
  const host = document.getElementById(RECAPTCHA_ID);
  if (!host && !button) {
    const el = document.createElement("div");
    el.id = RECAPTCHA_ID;
    document.body.appendChild(el);
  }
  const container = visible ? RECAPTCHA_ID : button ? SEND_BUTTON_ID : RECAPTCHA_ID;
  verifier = new RecaptchaVerifier(auth, container, {
    size: visible ? "normal" : "invisible",
    callback: () => undefined,
    "expired-callback": () => {
      clearVerifier();
    },
  });
  try {
    await verifier.render();
  } catch {
    /* signInWithPhoneNumber can still solve/render */
  }
  return verifier;
}

export async function prepareFirebasePhone() {
  if (typeof document === "undefined") return;
  if (verifier) return;
  const auth = await firebaseAuth();
  await makeVerifier(auth, false);
}

export async function sendFirebaseOtp(phone: string): Promise<{ resendAt: number }> {
  confirmation = null;
  const auth = await firebaseAuth();
  const e164 = e164India(phone);
  const { signInWithPhoneNumber } = await import("firebase/auth");

  async function sendWith(current: RecaptchaVerifier) {
    confirmation = await signInWithPhoneNumber(auth, e164, current);
  }

  try {
    const recaptcha = verifier ?? (await makeVerifier(auth, false));
    await sendWith(recaptcha);
    return { resendAt: Date.now() + RESEND_MS };
  } catch (first) {
    if (isCaptchaError(firebaseErrorDetails(first))) {
      const visible = await makeVerifier(auth, true);
      try {
        await sendWith(visible);
        return { resendAt: Date.now() + RESEND_MS };
      } catch (second) {
        throw new Error(firebaseOtpMessage(second));
      }
    }
    throw new Error(firebaseOtpMessage(first));
  }
}

export async function confirmFirebaseOtp(code: string): Promise<string> {
  if (!confirmation) {
    throw new Error("Request an OTP first.");
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter the 6-digit OTP from SMS.");
  }
  try {
    const cred = await confirmation.confirm(code);
    const token = await cred.user.getIdToken(true);
    return token;
  } catch (error) {
    throw new Error(firebaseOtpMessage(error));
  }
}

export async function clearFirebasePhone() {
  confirmation = null;
  clearVerifier();
  if (authSingleton) {
    try {
      const { signOut } = await import("firebase/auth");
      await signOut(authSingleton);
    } catch {
      /* ignore */
    }
  }
}

export const FIREBASE_OTP_RESEND_MS = RESEND_MS;
export const FIREBASE_RECAPTCHA_ID = RECAPTCHA_ID;
export const FIREBASE_SEND_BUTTON_ID = SEND_BUTTON_ID;
