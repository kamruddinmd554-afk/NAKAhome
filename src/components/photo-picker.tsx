import { Camera, ImageIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImageFile } from "@/lib/image";
import { cn } from "@/lib/utils";

export function PhotoPicker({
  value,
  onChange,
  hi = false,
  variant = "avatar",
}: {
  value: string | null;
  onChange: (url: string) => void;
  hi?: boolean;
  variant?: "avatar" | "document";
}) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const document = variant === "document";

  function handle(file: File | undefined) {
    if (!file) return;
    void compressImageFile(file, document ? 960 : 240, document ? "contain" : "cover")
      .then(onChange)
      .catch((e: Error) => toast(e.message));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {value ? (
        <img
          src={value}
          alt=""
          className={cn(
            "object-cover shadow-[var(--shadow-border)]",
            document ? "h-36 w-full rounded-2xl object-contain bg-raised" : "size-28 rounded-full",
          )}
        />
      ) : (
        <div
          className={cn(
            "grid place-items-center bg-raised text-muted",
            document ? "h-28 w-full rounded-2xl" : "size-28 rounded-full",
          )}
        >
          <Camera className="size-8" />
        </div>
      )}
      <div className="grid w-full grid-cols-2 gap-2">
        <Button type="button" variant="secondary" className="h-14" onClick={() => cam.current?.click()}>
          <Camera className="size-5" />
          {hi ? "फोटो लें" : "Take photo"}
        </Button>
        <Button type="button" variant="secondary" className="h-14" onClick={() => gal.current?.click()}>
          <ImageIcon className="size-5" />
          {hi ? "गैलरी" : "Gallery"}
        </Button>
      </div>
      <input
        ref={cam}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={gal}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
