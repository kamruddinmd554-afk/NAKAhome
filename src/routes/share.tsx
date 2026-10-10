import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, QrCode, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { nakaHomePublicUrl, NAKA_HOME_PUBLIC_URL } from "@/lib/public-url";

export const Route = createFileRoute("/share")({ component: SharePage });

const QR_OPTIONS = {
  errorCorrectionLevel: "H" as const,
  margin: 2,
  width: 1024,
  color: { dark: "#141513", light: "#FFFFFF" },
};

function SharePage() {
  const url = useMemo(() => nakaHomePublicUrl(), []);
  const [png, setPng] = useState("/naka-home-qr.png");
  const [ready, setReady] = useState(url === NAKA_HOME_PUBLIC_URL);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, QR_OPTIONS)
      .then((data) => {
        if (!cancelled) {
          setPng(data);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPng("/naka-home-qr.png");
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function pngBlob() {
    const res = await fetch(png);
    return res.blob();
  }

  async function downloadQr() {
    try {
      const blob = await pngBlob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "naka-home-qr.png";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1500);
      toast("QR code saved");
    } catch {
      toast("Could not download. Long-press the QR to save.");
    }
  }

  async function shareQr() {
    const text = `NAKA HOME — civil construction labour marketplace\n${url}`;
    try {
      const blob = await pngBlob();
      const file = new File([blob], "naka-home-qr.png", { type: "image/png" });
      const withFile = { title: "NAKA HOME", text, url, files: [file] };
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share(withFile);
        return;
      }
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "NAKA HOME", text, url });
        return;
      }
      openWhatsApp(text);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      openWhatsApp(text);
    }
  }

  function openWhatsApp(text: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-dvh bg-bg px-5 py-8 text-fg">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <Link
          to="/"
          className="mb-6 inline-flex h-11 w-full items-center gap-2 self-start text-sm text-muted"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <Logo size="lg" />
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">Share NAKA HOME</h1>
        <p className="mt-2 text-sm text-muted">Scan to open NAKA HOME</p>

        <div className="mt-6 w-full rounded-[1.75rem] bg-paper p-5 shadow-[var(--shadow-paper)]">
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-white">
            {ready ? (
              <img
                src={png}
                alt="QR code that opens NAKA HOME"
                className="size-full bg-white object-contain"
                width={1024}
                height={1024}
              />
            ) : (
              <div className="grid size-full place-items-center text-ink">
                <QrCode className="size-10" />
              </div>
            )}
          </div>
          <p className="mt-4 font-display text-sm font-semibold tracking-wide text-ink">Scan to Open NAKAhome</p>
          <p className="mt-1 break-all font-mono text-[11px] text-ink/70">{url}</p>
        </div>

        <div className="mt-6 flex w-full flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => void shareQr()}>
            <Share2 className="size-4" />
            Share
          </Button>
          <Button size="lg" variant="secondary" className="w-full" onClick={() => void downloadQr()}>
            <Download className="size-4" />
            Download QR Code
          </Button>
          <Button size="lg" variant="outline" className="w-full" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(`NAKA HOME\n${url}`)}`}>
              Share on WhatsApp
            </a>
          </Button>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted">
          Point another phone camera at the code. It opens the live NAKA HOME site. No app store install is
          required.
        </p>
      </div>
    </main>
  );
}
