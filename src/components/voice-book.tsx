import { useNavigate } from "@tanstack/react-router";
import { Keyboard, Mic, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listenUtterance, speakGuide, speechSupported, stopSpeech } from "@/lib/speech";
import {
  formatDraftTime,
  missingBookingFields,
  nextBookingPrompt,
  parseBookingSpeech,
  type BookDraft,
} from "@/lib/voice-book";
import { cn } from "@/lib/utils";

export function VoiceBook({ hi = true, className }: { hi?: boolean; className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [draft, setDraft] = useState<BookDraft>({ raw: "" });
  const [manual, setManual] = useState(false);
  const ok = typeof window !== "undefined" && speechSupported();
  const prompt = nextBookingPrompt(draft, hi);
  const ready = missingBookingFields(draft).length === 0;

  async function listen() {
    if (!ok) {
      toast(hi ? "आवाज़ उपलब्ध नहीं। टाइप करें।" : "Voice not available. Type instead.");
      setManual(true);
      setOpen(true);
      return;
    }
    setOpen(true);
    setListening(true);
    try {
      const text = await listenUtterance(hi ? "hi-IN" : "en-IN", setHeard);
      setHeard(text);
      const next = parseBookingSpeech(text, draft);
      setDraft(next);
      const q = nextBookingPrompt(next, hi);
      if (q) speakGuide(q, hi ? "hi-IN" : "en-IN");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not hear");
    } finally {
      setListening(false);
    }
  }

  function goConfirm() {
    if (!draft.skillId) {
      toast(hi ? "पहले काम चुनें" : "Choose a trade first");
      return;
    }
    stopSpeech();
    void navigate({
      to: "/hire",
      search: {
        skill: draft.skillId,
        crew: draft.crewSize ? String(draft.crewSize) : undefined,
        date: draft.date,
        time: draft.time,
        hours: draft.hours ? String(draft.hours) : undefined,
        address: draft.location,
        lat: draft.lat != null ? String(draft.lat) : undefined,
        lng: draft.lng != null ? String(draft.lng) : undefined,
        voice: "1",
      },
    });
  }

  return (
    <div className={cn("rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-sm font-medium">{hi ? "बोलकर बुक करें" : "Book by voice"}</p>
          <p className="mt-1 text-xs text-muted">
            {hi ? "हिंदी / हिंग्लिश में बोलें। बुकिंग तभी बनेगी जब आप Confirm दबाएँ।" : "Speak in Hindi or English. Nothing is booked until you confirm."}
          </p>
        </div>
        <Button type="button" size="icon" variant={listening ? "paper" : "secondary"} onClick={() => void listen()} aria-label="Speak">
          {listening ? <Square className="size-5" /> : <Mic className="size-5" />}
        </Button>
      </div>
      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          {listening ? <p className="text-sm text-sage">{heard || (hi ? "सुन रहे हैं…" : "Listening…")}</p> : null}
          {!listening && heard ? <p className="text-sm text-muted">“{heard}”</p> : null}
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <Fact k={hi ? "काम" : "Work"} v={draft.skillName} />
            <Fact k={hi ? "वर्कर" : "Workers"} v={draft.crewSize ? String(draft.crewSize) : undefined} />
            <Fact k={hi ? "जगह" : "Location"} v={draft.location} />
            <Fact k={hi ? "तारीख" : "Date"} v={draft.date} />
            <Fact k={hi ? "समय" : "Time"} v={formatDraftTime(draft.time) || draft.time} />
            <Fact
              k={hi ? "अवधि" : "Duration"}
              v={draft.hours === 8 ? (hi ? "पूरा दिन" : "Full day") : draft.hours ? `${draft.hours}h` : undefined}
            />
          </ul>
          {prompt && !ready ? <p className="text-sm text-sage">{prompt}</p> : null}
          {manual ? (
            <Input
              placeholder={hi ? "यहाँ टाइप करें" : "Type here"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = e.currentTarget.value.trim();
                  if (!v) return;
                  setHeard(v);
                  setDraft(parseBookingSpeech(v, draft));
                  e.currentTarget.value = "";
                }
              }}
            />
          ) : (
            <button type="button" className="inline-flex h-11 items-center gap-2 text-xs text-muted" onClick={() => setManual(true)}>
              <Keyboard className="size-4" />
              {hi ? "टाइप करें" : "Type instead"}
            </button>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" size="lg" onClick={() => void listen()}>
              <Mic className="size-4" />
              {hi ? "फिर बोलें" : "Speak again"}
            </Button>
            <Button className="flex-1" size="lg" variant="paper" disabled={!draft.skillId} onClick={goConfirm}>
              {hi ? "आगे बढ़ें" : "Continue"}
            </Button>
          </div>
          <button
            type="button"
            className="text-xs text-subtle"
            onClick={() => {
              setOpen(false);
              setDraft({ raw: "" });
              setHeard("");
              stopSpeech();
            }}
          >
            {hi ? "रद्द करें" : "Cancel"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Fact({ k, v }: { k: string; v?: string }) {
  return (
    <li className="rounded-2xl bg-raised p-3">
      <p className="text-[11px] text-muted">{k}</p>
      <p className="mt-1 font-medium">{v || "—"}</p>
    </li>
  );
}
