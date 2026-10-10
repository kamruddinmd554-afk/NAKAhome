import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/privacy")({ component: Page });

function Page() {
  return (
    <main className="min-h-dvh bg-bg px-5 py-8 text-fg">
      <div className="mx-auto max-w-lg">
        <Logo />
        <p className="mt-8 text-xs font-medium tracking-wide text-sage">NAKA HOME</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Aapka data, aapki izzat</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Naka pe khada insaan sirf ek profile nahi hota. Woh ghar chalata hai — subah site, shaam par
          apne log. NAKAhome us number, us photo, aur us jagah ko bechne ke liye nahi banaya gaya. Yeh
          sirf itna rakhta hai jitna kaam milane aur kaam poora karne ke liye zaroori hai.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Last updated 8 October 2026. This page is also the privacy policy for the NAKAhome app.
        </p>

        <Section title="Hum kaun hain">
          NAKAhome is a civil-labour marketplace. One account can book workers or join as a worker. We
          are not the employer. The people on a job remain independent.
        </Section>

        <Section title="Kya rakha jata hai">
          Account: name, mobile, email if you use one, language, emergency contact, and the area you set.
          Worker profile: trades, rate, experience, work photos, and a government ID image for KYC. Jobs:
          site address, date, crew size, cash amounts, chat, ratings, and reports. Sign-in can use a real
          SMS OTP (Firebase), Google, X, or email. We never show a fake OTP inside the app.
        </Section>

        <Section title="Location — sirf usi booking ke liye">
          A rough area helps customers find nearby workers. Live GPS starts only after a worker accepts
          that job and allows location. It is shown only to the customer and the workers on that booking.
          It is not on the public worker list. If the signal drops, the last known time stays visible. When
          the job is completed or cancelled, live sharing stops. Another person’s booking cannot see it.
        </Section>

        <Section title="Phone, KYC, aur paisa">
          The other person’s mobile opens only after a booking is accepted. ID photos are for admin review,
          not for the public page. Payment is cash on site: Pending, Cash Collected, or Paid. We do not
          store card numbers, UPI IDs, or bank accounts, and we do not run an online gateway or automatic
          payout. The 8% platform amount and the worker’s own net are shown separately before you confirm.
        </Section>

        <Section title="Hum bechte nahi">
          We do not sell personal data. We do not run ads on your location. Sign-in providers process only
          the login you choose. Messages stay between the people on that job. Admins can see KYC and cash
          records so a listing can be approved and a manual payout can be marked. That is the limit.
        </Section>

        <Section title="Bacche">
          NAKAhome is for adults who book or do civil site work. It is not for anyone under 18.
        </Section>

        <Section title="Aap kya kar sakte ho">
          You can correct your profile, turn availability off, report or block someone, and stop live
          location when the job ends. From Account you can ask us to delete your account. Finish open jobs
          first. An admin then removes the public profile. We do not keep a live map after the job is over.
        </Section>

        <p className="mt-8 text-sm leading-relaxed text-fg">
          Jo aadmi naka pe intezaar karta hai, uski jagah uske bina kisi ke haath nahi lagani chahiye.
          NAKAhome wahi vaada rakhta hai.
        </p>

        <div className="mt-8 flex flex-col gap-2 text-sm">
          <Link to="/account" className="underline-offset-2 hover:underline">
            Account — ask to delete
          </Link>
          <Link to="/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
          <Link to="/help" className="underline-offset-2 hover:underline">
            Help
          </Link>
          <Link to="/" className="underline-offset-2 hover:underline">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-sm font-medium text-fg">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </section>
  );
}
