import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { PinInput } from "@/components/pin-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { FIREBASE_PHONE_SETUP, isFirebasePhoneConfigured, missingFirebaseEnv } from "@/lib/firebase-config";
import { FIREBASE_RECAPTCHA_ID, FIREBASE_SEND_BUTTON_ID, clearFirebasePhone, confirmFirebaseOtp, prepareFirebasePhone, sendFirebaseOtp } from "@/lib/firebase-phone";
import { isSixDigitPin, persistPreviewSessionToken, phoneToEmail, pinToPassword } from "@/lib/phone-login";
import { completePhoneAuth } from "@/lib/server/phone-otp";
import { checkPhone, notePhoneAttempt, updateProfile } from "@/lib/server/inbook";
import { digitsPhone, formatInPhone, isValidInPhone } from "@/lib/utils";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const next = redirect && redirect.startsWith("/") ? redirect : "/";
  const [tab, setTab] = useState<"mobile" | "email">("mobile");

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-5 py-10 text-fg">
      <div className="w-full max-w-sm">
        <Logo size="lg" className="mx-auto" />
        <h1 className="mt-6 text-center font-display text-2xl font-semibold tracking-tight">Sign in to NAKA HOME</h1>
        <p className="mt-2 text-center text-sm text-muted">
          One account to book civil labour and to join as a worker.
        </p>

        {authEnabled ? (
          <>
            <div className="mt-6 grid grid-cols-2 rounded-2xl bg-raised p-1">
              <button
                type="button"
                className={`h-11 rounded-xl text-sm font-medium ${tab === "mobile" ? "bg-surface text-fg" : "text-muted"}`}
                onClick={() => setTab("mobile")}
              >
                Mobile
              </button>
              <button
                type="button"
                className={`h-11 rounded-xl text-sm font-medium ${tab === "email" ? "bg-surface text-fg" : "text-muted"}`}
                onClick={() => setTab("email")}
              >
                Email
              </button>
            </div>
            {tab === "mobile" ? <MobileAuth next={next} /> : <EmailAuth next={next} />}
            <div className="my-6 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="flex flex-col gap-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: next })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
        )}
        <p className="mt-8 text-center text-xs text-subtle">
          <Link to="/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
          {" · "}
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  );
}

function MobileAuth({ next }: { next: string }) {
  const firebaseOn = isFirebasePhoneConfigured();
  const [method, setMethod] = useState<"otp" | "pin">(firebaseOn ? "otp" : "pin");

  if (method === "pin") {
    return (
      <div className="mt-6">
        {firebaseOn ? (
          <button type="button" className="mb-4 text-sm text-muted" onClick={() => setMethod("otp")}>
            ← Back to SMS OTP
          </button>
        ) : (
          <FirebaseSetupNote />
        )}
        <PinAuth next={next} />
      </div>
    );
  }

  return <OtpAuth next={next} onUsePin={() => setMethod("pin")} />;
}

function FirebaseSetupNote() {
  const missing = missingFirebaseEnv();
  return (
    <div className="mb-4 rounded-2xl bg-raised p-4 text-sm">
      <p className="font-medium text-fg">Real SMS OTP is not active yet</p>
      <p className="mt-1 text-xs leading-5 text-muted">
        Firebase project <span className="text-fg">nakahome-c8b12</span> is linked, but the public web
        API key is still missing. NAKA HOME will not send a fake or demo OTP. Use email or the 6-digit
        login PIN until the key is added.
      </p>
      {missing.length ? (
        <p className="mt-2 text-xs text-danger">Still needed: {missing.join(", ")}</p>
      ) : null}
      <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-muted">
        {FIREBASE_PHONE_SETUP.map((step) => (
          <li key={step.title}>
            <span className="text-fg">{step.title}.</span> {step.body}
          </li>
        ))}
      </ol>
    </div>
  );
}

function OtpAuth({ next, onUsePin }: { next: string; onUsePin: () => void }) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [exists, setExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [resendAt]);

  useEffect(() => {
    void prepareFirebasePhone();
    return () => {
      void clearFirebasePhone();
    };
  }, []);

  const waitSec = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function sendOtp() {
    if (!isValidInPhone(phone)) {
      setError("Enter a valid 10-digit Indian mobile starting with 6–9");
      return;
    }
    if (!isFirebasePhoneConfigured()) {
      setError("Firebase Phone Authentication is not configured.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await checkPhone({ data: { phone: digitsPhone(phone) } });
      setExists(res.exists);
      const sent = await sendFirebaseOtp(digitsPhone(phone));
      setResendAt(sent.resendAt);
      setOtp("");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP from SMS");
      return;
    }
    if (!exists && name.trim().length < 2) {
      setError("Enter your full name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const idToken = await confirmFirebaseOtp(otp);
      const session = await completePhoneAuth({
        data: { idToken, name: exists ? undefined : name.trim() },
      });
      if (session?.token) persistPreviewSessionToken(session.token);
      await clearFirebasePhone();
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify OTP");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {step === "phone" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <div className="flex items-center gap-2">
              <span className="grid h-12 shrink-0 place-items-center rounded-xl bg-raised px-3 text-sm text-muted shadow-[var(--shadow-border)]">
                +91
              </span>
              <Input
                id="phone"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            {isValidInPhone(phone) ? <p className="text-xs text-muted">{formatInPhone(phone)}</p> : null}
          </div>
          <p className="text-xs text-muted">
            We send a real 6-digit SMS OTP to this number. The code is never shown in the app.
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" id={FIREBASE_SEND_BUTTON_ID} size="lg" className="w-full" disabled={busy}>
            {busy ? "Sending OTP…" : "Send OTP"}
          </Button>
          <button type="button" className="text-center text-xs text-muted" onClick={onUsePin}>
            Existing account? Use 6-digit login PIN
          </button>
        </form>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={verifyOtp}>
          <p className="text-sm text-muted">OTP sent to {formatInPhone(phone)}</p>
          <button
            type="button"
            className="self-start text-xs text-muted"
            onClick={() => {
              setStep("phone");
              setOtp("");
              void clearFirebasePhone();
            }}
          >
            Change number
          </button>
          {!exists ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otp-name">Full name</Label>
              <Input id="otp-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label>Enter 6-digit OTP</Label>
            <PinInput value={otp} onChange={setOtp} disabled={busy} />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Verifying…" : "Verify OTP"}
          </Button>
          <button
            type="button"
            className="text-center text-sm text-muted"
            disabled={busy || waitSec > 0}
            onClick={() => void sendOtp()}
          >
            {waitSec > 0 ? `Resend OTP in ${waitSec}s` : "Resend OTP"}
          </button>
        </form>
      )}
      <div id={FIREBASE_RECAPTCHA_ID} className="mt-3 flex justify-center" />
    </div>
  );
}

function PinAuth({ next }: { next: string }) {
  const [step, setStep] = useState<"phone" | "pin">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [exists, setExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockMs, setLockMs] = useState(0);

  useEffect(() => {
    if (lockMs <= 0) return;
    const t = setInterval(() => setLockMs((v) => Math.max(0, v - 1000)), 1000);
    return () => clearInterval(t);
  }, [lockMs]);

  async function goPin() {
    if (!isValidInPhone(phone)) {
      setError("Enter a valid 10-digit Indian mobile starting with 6–9");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await checkPhone({ data: { phone: digitsPhone(phone) } });
      setExists(res.exists);
      setLockMs(res.lockedMs);
      setStep("pin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  async function submitPin(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    if (lockMs > 0) {
      setError(`Too many attempts. Try again in ${Math.ceil(lockMs / 1000)}s`);
      return;
    }
    if (!isSixDigitPin(pin)) {
      setError("Enter a 6-digit PIN");
      return;
    }
    if (!exists && pin !== confirm) {
      setError("PINs do not match");
      return;
    }
    if (!exists && name.trim().length < 2) {
      setError("Enter your full name");
      return;
    }
    setBusy(true);
    setError(null);
    const digits = digitsPhone(phone);
    const email = phoneToEmail(digits);
    const password = pinToPassword(digits, pin);
    try {
      if (exists) {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error("Wrong PIN");
      } else {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name.trim(),
        });
        if (err) throw new Error(err.message);
      }
      await notePhoneAttempt({ data: { phone: digits, success: true } });
      try {
        await updateProfile({
          data: { phone: digits, name: exists ? undefined : name.trim() },
        });
      } catch {
        /* profile sync retries on next load */
      }
      window.location.href = next;
    } catch (err) {
      const note = await notePhoneAttempt({ data: { phone: digits, success: false } }).catch(() => ({
        lockedMs: 0,
      }));
      setLockMs(note.lockedMs);
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void goPin();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pin-phone">Mobile number</Label>
          <Input
            id="pin-phone"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          {isValidInPhone(phone) ? <p className="text-xs text-muted">{formatInPhone(phone)}</p> : null}
        </div>
        <p className="text-xs text-muted">This is your existing 6-digit login PIN, not an SMS OTP.</p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : "Continue with PIN"}
        </Button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submitPin}>
      <p className="text-sm text-muted">{formatInPhone(phone)}</p>
      <button type="button" className="self-start text-xs text-muted" onClick={() => setStep("phone")}>
        Change number
      </button>
      {!exists ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pin-name">Full name</Label>
          <Input id="pin-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label>{exists ? "Enter 6-digit PIN" : "Create 6-digit PIN"}</Label>
        <PinInput value={pin} onChange={setPin} disabled={lockMs > 0} />
      </div>
      {!exists ? (
        <div className="flex flex-col gap-1.5">
          <Label>Confirm PIN</Label>
          <PinInput value={confirm} onChange={setConfirm} disabled={lockMs > 0} />
        </div>
      ) : null}
      {lockMs > 0 ? (
        <p className="text-sm text-danger">Locked. Try again in {Math.ceil(lockMs / 1000)}s</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={busy || lockMs > 0}>
        {busy ? "Please wait…" : exists ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

function EmailAuth({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0]!,
        });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message);
      }
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <>
      <form className="mt-6 flex flex-col gap-3" onSubmit={onEmail}>
        {mode === "up" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "in" ? "Sign in with email" : "Create account"}
        </Button>
      </form>
      <button
        type="button"
        className="mt-3 w-full text-center text-sm text-muted"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </>
  );
}
