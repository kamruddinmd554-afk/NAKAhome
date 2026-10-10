import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/terms")({ component: Page });

function Page() {
  return (
    <main className="min-h-dvh bg-bg px-5 py-8 text-fg">
      <div className="mx-auto max-w-lg">
        <Logo />
        <h1 className="mt-8 font-display text-2xl font-semibold">Terms & Conditions</h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>NAKA HOME is a marketplace connecting customers with independent civil workers and contractors. NAKA HOME is not the employer of workers.</p>
          <p>Bookings are requests until a worker accepts. Either party may cancel before work starts.</p>
          <p>On-site safety, tools, and statutory labour compliance remain the customer’s and worker’s responsibility.</p>
          <p>The platform amount is shown before you confirm: worker charge, 8% commission, customer cash total, and each worker’s net. Payment is cash on site only. Status stays Pending until cash is recorded as Cash Collected or Paid. NAKAhome does not take UPI, cards, or automatic bank payout. Worker payout is marked manually by an admin and is not the same as the customer’s cash total.</p>
        </div>
        <Link to="/" className="mt-8 inline-block text-sm underline-offset-2 hover:underline">Back home</Link>
      </div>
    </main>
  );
}
