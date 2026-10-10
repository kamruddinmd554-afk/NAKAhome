import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/help")({ component: Page });

function Page() {
  return (
    <main className="min-h-dvh bg-bg px-5 py-8 text-fg">
      <div className="mx-auto max-w-lg">
        <Logo />
        <h1 className="mt-8 font-display text-2xl font-semibold">Help & support</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          NAKA HOME is a civil construction labour marketplace. Customers book masons, steel fixers,
          shuttering, plaster, painters, electricians, plumbers and site labour. Workers go available and
          accept jobs. Chat and call open after a booking is accepted.
        </p>
        <h2 className="mt-8 font-display text-sm font-medium">Emergency</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li>
            <a className="text-sage" href="tel:112">
              National emergency 112
            </a>
          </li>
          <li>
            <a className="text-sage" href="tel:100">
              Police 100
            </a>
          </li>
          <li>
            <a className="text-sage" href="tel:108">
              Ambulance 108
            </a>
          </li>
          <li>
            <a className="text-sage" href="tel:1091">
              Women helpline 1091
            </a>
          </li>
        </ul>
        <ul className="mt-6 space-y-3 text-sm text-muted">
          <li>Safety: use in-app chat until a booking is accepted. Report or block from the booking screen.</li>
          <li>
            Payments: cash on site only. Status stays Pending until cash is recorded as Cash Collected or Paid. There is no UPI or online gateway. Worker payout is manual and separate from the customer’s cash total.
          </li>
          <li>Workers: complete your profile, pick trades, then turn Available on.</li>
          <li>Verified badge appears only after an admin verifies the worker.</li>
          <li>
            Live location: after a worker accepts a job and allows GPS, the customer sees that worker on the
            booking map. Sharing stops when the job is completed or cancelled. Location is never shown on the
            public worker list.
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-2 text-sm">
          <Link to="/share" className="underline-offset-2 hover:underline">
            Share NAKA HOME / QR code
          </Link>
          <Link to="/terms" className="underline-offset-2 hover:underline">
            Terms & Conditions
          </Link>
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          <Link to="/" className="underline-offset-2 hover:underline">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
