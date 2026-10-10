import { Mic, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listenOnce, speechSupported } from "@/lib/speech";
import { cn } from "@/lib/utils";

export function MicButton({
  lang,
  onText,
  size = "md",
  label,
  className,
}: {
  lang: "hi-IN" | "en-IN";
  onText: (text: string) => void;
  size?: "md" | "lg";
  label?: string;
  className?: string;
}) {
  const [listening, setListening] = useState(false);
  const ok = typeof window !== "undefined" && speechSupported();

  async function start() {
    if (!ok) {
      toast(lang === "hi-IN" ? "आवाज़ उपलब्ध नहीं। टाइप करें।" : "Voice not available. Type instead.");
      return;
    }
    setListening(true);
    try {
      const text = await listenOnce(lang);
      if (text) onText(text);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not hear");
    } finally {
      setListening(false);
    }
  }

  return (
    <Button
      type="button"
      variant={listening ? "paper" : "secondary"}
      size={size === "lg" ? "lg" : "icon"}
      className={cn(size === "lg" && "w-full", className)}
      onClick={() => void start()}
      aria-label={label ?? (lang === "hi-IN" ? "बोलें" : "Speak")}
    >
      {listening ? <Square className="size-5" /> : <Mic className="size-5" />}
      {size === "lg" ? (listening ? (lang === "hi-IN" ? "सुन रहे हैं…" : "Listening…") : label) : null}
    </Button>
  );
}
