import { SITE_URL } from "@/lib/seo";

/** Canonical public URL encoded in the NAKA HOME QR code. */
export const NAKA_HOME_PUBLIC_URL = SITE_URL;

export function nakaHomePublicUrl() {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const https = window.location.protocol === "https:";
    if (https && host.endsWith(".grok.me") && host !== "gate.grok.me" && host !== "auth.grok.me") {
      return window.location.origin;
    }
  }
  return NAKA_HOME_PUBLIC_URL;
}
