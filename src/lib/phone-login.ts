import { digitsPhone } from "@/lib/utils";

export function phoneToEmail(phone: string) {
  return `${digitsPhone(phone)}@phone.inbook.app`;
}

export function pinToPassword(phone: string, pin: string) {
  return `Inbk.${pin}.${digitsPhone(phone)}`;
}

export function isSixDigitPin(pin: string) {
  return /^\d{6}$/.test(pin);
}

/** Same key the Better Auth client uses for live-preview bearer sessions. */
const PREVIEW_BEARER_KEY = "grok-auth.bearer-token";

export function persistPreviewSessionToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREVIEW_BEARER_KEY, token);
  } catch {
    /* storage unavailable */
  }
}
