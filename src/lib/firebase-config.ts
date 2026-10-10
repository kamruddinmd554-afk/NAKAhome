/**
 * Public Firebase web config for Phone Authentication.
 *
 * These values are designed by Firebase to live in the browser (API key is
 * not a secret). Never put a service-account private key here.
 *
 * Set them in the app environment as VITE_FIREBASE_* (or FIREBASE_PROJECT_ID
 * on the server). Empty / placeholder values mean Phone OTP is not active.
 */

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
};

/** Known NAKA HOME Firebase web app (public identifiers). */
const PROJECT_DEFAULTS = {
  apiKey: "AIzaSyDg3cBFKG1irTalR_RmLiZtjZ7tRSqf3zA",
  authDomain: "nakahome-c8b12.firebaseapp.com",
  projectId: "nakahome-c8b12",
  appId: "1:7947780167:web:75b8b60d06e39ed9e63162",
  messagingSenderId: "7947780167",
} as const;

function readEnv(key: string): string {
  const fromProc =
    typeof process !== "undefined" ? String(process.env[key] ?? "").trim() : "";
  let fromVite = "";
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    fromVite = String(env?.[key] ?? "").trim();
  } catch {
    fromVite = "";
  }
  return fromVite || fromProc;
}

function looksPlaceholder(value: string) {
  const v = value.trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  return (
    lower.includes("your_") ||
    lower.includes("replace") ||
    lower === "demo" ||
    lower === "changeme" ||
    lower === "xxx"
  );
}

export function missingFirebaseEnv(): string[] {
  const missing: string[] = [];
  const apiKey = readEnv("VITE_FIREBASE_API_KEY") || PROJECT_DEFAULTS.apiKey;
  if (!apiKey || looksPlaceholder(apiKey) || !apiKey.startsWith("AIza")) {
    missing.push("VITE_FIREBASE_API_KEY");
  }
  return missing;
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = readEnv("VITE_FIREBASE_API_KEY") || PROJECT_DEFAULTS.apiKey;
  const authDomain = readEnv("VITE_FIREBASE_AUTH_DOMAIN") || PROJECT_DEFAULTS.authDomain;
  const projectId =
    readEnv("FIREBASE_PROJECT_ID") || readEnv("VITE_FIREBASE_PROJECT_ID") || PROJECT_DEFAULTS.projectId;
  const appId = readEnv("VITE_FIREBASE_APP_ID") || PROJECT_DEFAULTS.appId;
  const messagingSenderId =
    readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") || PROJECT_DEFAULTS.messagingSenderId;

  if (!apiKey || !authDomain || !projectId || !appId) return null;
  if ([apiKey, authDomain, projectId, appId].some(looksPlaceholder)) return null;
  if (!apiKey.startsWith("AIza")) return null;
  if (!appId.includes(":web:")) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: messagingSenderId || undefined,
  };
}

export function isFirebasePhoneConfigured() {
  return getFirebaseWebConfig() !== null;
}

export const FIREBASE_PHONE_SETUP = [
  {
    title: "Allow India in SMS region policy",
    body: "Authentication → Sign-in method → Phone → SMS region policy. Allow India (+91). Phone can be Enabled and still block SMS until the region is allowed.",
  },
  {
    title: "Authorize NAKA HOME domains",
    body: "Authentication → Settings → Authorized domains. Add inbooc.grok.me.",
  },
  {
    title: "Blaze billing for real SMS",
    body: "Firebase only sends real Indian (+91) SMS on the Blaze plan.",
  },
] as const;
