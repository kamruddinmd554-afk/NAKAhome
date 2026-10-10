type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: {
    results: ArrayLike<{ isFinal?: boolean; length: number; [i: number]: { transcript: string } }>;
  }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecCtor = new () => Rec;

function Recognition(): Rec | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function speechSupported() {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function listenOnce(lang: "hi-IN" | "en-IN"): Promise<string> {
  return listenUtterance(lang);
}

export function listenUtterance(
  lang: "hi-IN" | "en-IN",
  onInterim?: (text: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const rec = Recognition();
    if (!rec) {
      reject(new Error("Voice is not available on this device. Type instead."));
      return;
    }
    rec.lang = lang;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    let settled = false;
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      const text = last?.[0]?.transcript?.trim() ?? "";
      if (last && last.isFinal === false) {
        onInterim?.(text);
        return;
      }
      const alts: string[] = [];
      if (last) {
        for (let i = 0; i < last.length; i++) alts.push(last[i]?.transcript ?? "");
      }
      settled = true;
      resolve([text, ...alts].filter(Boolean).join(" ").trim());
    };
    rec.onerror = (ev) => {
      if (settled) return;
      const err = ev.error;
      if (err === "not-allowed") reject(new Error("Microphone permission denied"));
      else if (err === "no-speech") reject(new Error("No speech heard. Try again."));
      else reject(new Error("Could not hear. Try again or type."));
    };
    rec.onend = () => {
      if (!settled) reject(new Error("No speech heard. Try again."));
    };
    try {
      rec.start();
    } catch {
      reject(new Error("Could not start microphone"));
    }
  });
}

export function speakGuide(text: string, lang: "hi-IN" | "en-IN") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function stopSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
