import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Tracky refuses to invent tracking events, how the delivery workflow fits a team that runs its own drivers, and what the app does and does not do.",
};

export default function AboutPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          About Tracky
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-600">
          Tracky is post-purchase order tracking and last-mile delivery
          management for Shopify merchants who deliver with their own drivers,
          rather than handing parcels to a national carrier.
        </p>
      </header>

      <Section title="The problem it was built for">
        <p>
          If you deliver your own orders, the usual tracking apps do not fit.
          They expect a carrier to supply a stream of scans, and when there is
          no scan to show they fill the gap — a generic “in transit”, an
          estimated date, a status that advances because a day went by rather
          than because anything happened.
        </p>
        <p>
          That is a small lie with a real cost. A customer who reads “out for
          delivery” on a page that generated it, then waits in all afternoon
          for nothing, does not blame the software. They blame you, and they
          email your support inbox.
        </p>
      </Section>

      <Section title="The rule">
        <p>
          An order only ever moves forward on a real event. There are exactly
          three sources, and each one is stored against the event so it stays
          answerable months later:
        </p>
        <ul>
          <li>
            <strong>A Shopify webhook</strong> — a new order arrives and is
            placed in your first stage.
          </li>
          <li>
            <strong>Your delivery agency</strong> — a signed-in person recorded
            an update from their phone.
          </li>
          <li>
            <strong>You</strong> — a manual override from the backoffice, logged
            under your name.
          </li>
        </ul>
        <p>
          There is no timer, no scheduler and no background job anywhere in the
          application that advances a delivery. Day-based delays exist, but they
          only ever schedule an <em>email</em> — they never touch a delivery
          status. If your team has not updated an order in three days, the
          dashboard tells you that instead of quietly moving it along.
        </p>
      </Section>

      <Section title="Fulfillment waits for a real handover">
        <p>
          The same discipline applies at the end of the journey. Shopify is only
          told an order is fulfilled once your agency has confirmed the
          delivery — after the customer signed the paper note at the door, as
          they always have.
        </p>
        <p>
          There is no signature pad in this app. Your driver carries the same
          paperwork they carry today; the agency records that the delivery
          happened, optionally with a photo of the signed note, and that record
          is what releases the fulfillment.
        </p>
      </Section>

      <Section title="Who does what">
        <p>
          <strong>You, the store owner.</strong> Define your own tracking
          stages, style the customer tracking page with a live preview, write
          the emails and decide when each one goes out, set the fulfillment
          rules, and invite your agency. All of it without a developer.
        </p>
        <p>
          <strong>Your delivery agency.</strong> A dispatch screen built for a
          phone browser: the active deliveries, an address they can tap to
          navigate or call, a driver to assign, a status to update, and one
          button to confirm a delivery once the note is signed.
        </p>
        <p>
          <strong>Your drivers.</strong> Nothing. They have no account, no login
          and no app. They deliver and get a signature, exactly as now. In
          Tracky a driver is a name attached to an order so dispatch knows who
          has what.
        </p>
        <p>
          <strong>Your customer.</strong> One page, on your own domain, showing
          where their order actually is — reached from your emails, or by their
          order number and email address.
        </p>
      </Section>

      <Section title="What it deliberately does not do">
        <ul>
          <li>
            <strong>It does not estimate delivery dates.</strong> Nothing in the
            system knows when a parcel will arrive, so nothing claims to.
          </li>
          <li>
            <strong>It does not capture digital signatures.</strong> The paper
            note is the record; the agency&rsquo;s confirmation is the proof.
          </li>
          <li>
            <strong>It does not replace your carrier integrations.</strong> It is
            for the orders your own team delivers.
          </li>
          <li>
            <strong>It does not import your back catalogue automatically.</strong>{" "}
            Orders arrive from the moment you install. A manual sync can pull in
            up to 60 days if you need it.
          </li>
        </ul>
      </Section>

      <Section title="Where your data lives">
        <p>
          Each store is isolated at the database level — every record is bound
          to its store, and the data layer adds that constraint to every query
          rather than trusting each screen to remember. Shopify access tokens
          are encrypted at rest, and destroyed the moment the app is
          uninstalled.
        </p>
        <p>
          Photos of signed delivery notes are only ever shown inside your
          authenticated backoffice. They are never linked from the customer
          tracking page.
        </p>
      </Section>

      <div className="mt-12 rounded-xl border border-ink-200 bg-ink-50 p-6">
        <h2 className="text-base font-semibold text-ink-900">
          Still have questions?
        </h2>
        <p className="mt-1.5 text-sm text-ink-600">
          The FAQ covers setup, Shopify permissions, email and what happens when
          things go wrong.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/faq"
            className="inline-flex h-10 items-center rounded-lg bg-ink-900 px-5 text-sm font-semibold text-white hover:bg-ink-800"
          >
            Read the FAQ
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center rounded-lg border border-ink-300 bg-white px-5 text-sm font-semibold text-ink-800 hover:bg-white"
          >
            Contact us
          </Link>
        </div>
      </div>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold tracking-tight text-ink-900">{title}</h2>
      <div className="mt-3 space-y-4 text-base leading-relaxed text-ink-600 [&_li]:mt-2 [&_strong]:text-ink-900 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
