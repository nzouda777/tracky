import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Setting up Tracky, the Shopify permissions it asks for, how customer email works, what your drivers need to do, and what happens when something goes wrong.",
};

type Entry = { q: string; a: React.ReactNode };
type Group = { heading: string; entries: Entry[] };

const GROUPS: Group[] = [
  {
    heading: "Getting started",
    entries: [
      {
        q: "What do I need before I can use it?",
        a: (
          <>
            <p>
              A Shopify store, and someone who handles your deliveries — whether
              that is an in-house dispatcher or an agency you work with. Your
              drivers need nothing at all.
            </p>
            <p>
              You connect the store by pasting its address, approve the app in
              Shopify, and it arrives with a working set of tracking stages,
              emails and a branded tracking page you can then change.
            </p>
          </>
        ),
      },
      {
        q: "How long does setup take?",
        a: (
          <p>
            Connecting the store is a couple of minutes. Making it yours —
            renaming stages, styling the tracking page, rewriting the emails —
            is an afternoon at most, and none of it needs a developer. You can
            also leave the defaults and adjust later.
          </p>
        ),
      },
      {
        q: "Will my existing orders appear?",
        a: (
          <p>
            Orders arrive from the moment you install, because that is when
            Shopify starts sending them. A <strong>Sync orders</strong> button
            pulls in anything from the previous 60 days — Shopify does not
            return orders older than that without extra permissions we do not
            ask for.
          </p>
        ),
      },
      {
        q: "Can I run more than one store?",
        a: (
          <p>
            Yes. Each store gets its own stages, branding, email templates,
            sequence and fulfillment rules — nothing is shared between them.
            Switch between stores from the top bar.
          </p>
        ),
      },
    ],
  },
  {
    heading: "Shopify",
    entries: [
      {
        q: "What permissions does it ask for, and why?",
        a: (
          <>
            <p>Four, and no more than it needs:</p>
            <ul>
              <li>
                <strong>Read orders</strong> — to know an order exists and show
                it to your customer.
              </li>
              <li>
                <strong>Write orders</strong> — so a customer can correct their
                own delivery address from the tracking page, before the parcel
                leaves.
              </li>
              <li>
                <strong>Read and write fulfillments</strong> — to mark the order
                fulfilled once your agency confirms it was delivered.
              </li>
            </ul>
            <p>
              It does not ask for customer lists, products, discounts or
              analytics.
            </p>
          </>
        ),
      },
      {
        q: "Does my customer leave my store to track an order?",
        a: (
          <p>
            No. The tracking page is served on your own domain at{" "}
            <code>yourstore.com/apps/track-order</code> through the Shopify App
            Proxy. Shopify signs every request, and we verify that signature
            before reading a single order.
          </p>
        ),
      },
      {
        q: "What happens if I uninstall it?",
        a: (
          <p>
            Shopify tells us immediately. The access token is destroyed on the
            spot and the store stops syncing. Your orders and history are kept,
            so reinstalling picks up where you left off.
          </p>
        ),
      },
    ],
  },
  {
    heading: "Deliveries and drivers",
    entries: [
      {
        q: "Do my drivers need an app or a login?",
        a: (
          <p>
            No — and this is deliberate. Drivers deliver and get a signature on
            the paper note, exactly as they do today. In Tracky a driver is
            simply a name attached to an order so dispatch knows who has what.
            Every status update comes from your agency, never from a driver.
          </p>
        ),
      },
      {
        q: "How does proof of delivery work without a signature pad?",
        a: (
          <>
            <p>
              The customer signs the paper delivery note at the door. Your
              agency then records the delivery in Tracky — who signed, when, and
              optionally a photo of the signed note.
            </p>
            <p>
              That record is the proof, and it is what releases the fulfillment
              in Shopify. Photos are only ever visible inside your backoffice,
              never on the customer&rsquo;s page.
            </p>
          </>
        ),
      },
      {
        q: "Why does the tracking page sometimes show nothing new for a while?",
        a: (
          <p>
            Because nothing new has happened. The page shows recorded events
            only — it will not manufacture an update to look busy. If an order
            sits untouched for more than three days, your dashboard flags it so
            you can chase it.
          </p>
        ),
      },
      {
        q: "Can I correct a status my agency got wrong?",
        a: (
          <p>
            Yes. An owner can move an order to any stage from the backoffice.
            It is recorded as a manual override under your name, so the history
            stays honest about who changed what.
          </p>
        ),
      },
    ],
  },
  {
    heading: "Customer email",
    entries: [
      {
        q: "When do customers get emailed?",
        a: (
          <p>
            Whenever you decide. Attach a template to a stage — so it sends the
            moment an order reaches it — or to a delay in days after the order
            was placed. You can also send any template by hand, to one order or
            to a whole filtered selection.
          </p>
        ),
      },
      {
        q: "Can a delay move an order along by itself?",
        a: (
          <p>
            No. A delay only ever schedules an email. Nothing in the system can
            change a delivery status because time passed.
          </p>
        ),
      },
      {
        q: "What address do the emails come from?",
        a: (
          <p>
            A shared sending address we operate, with your store name as the
            sender. Your branding — colours, logo, footer — is applied to the
            email itself. A per-store sending domain is not available yet.
          </p>
        ),
      },
      {
        q: "How do I know an email actually arrived?",
        a: (
          <p>
            Every send is logged against its order: scheduled, sent, failed or
            skipped, with the provider&rsquo;s reason when it fails and a button
            to try again. Failures are also counted on your dashboard.
          </p>
        ),
      },
    ],
  },
  {
    heading: "When things go wrong",
    entries: [
      {
        q: "An order is missing. What now?",
        a: (
          <p>
            Press <strong>Sync orders</strong> on the Orders screen. It pulls
            recent orders straight from Shopify and covers the three cases a
            webhook cannot: orders placed before you installed, a webhook missed
            during an outage, and a store reconnected after being uninstalled.
          </p>
        ),
      },
      {
        q: "An order says fulfillment failed.",
        a: (
          <p>
            Open it — the reason Shopify gave is shown on the order, with a
            retry button. The usual causes are a delivery that has not been
            confirmed yet, or no stage marked as the one that triggers
            fulfillment.
          </p>
        ),
      },
      {
        q: "A customer cannot find their order.",
        a: (
          <p>
            They need their order number <em>and</em> the email address used at
            checkout — both, deliberately, so an order number alone cannot be
            used to browse other people&rsquo;s orders. The personal link in
            their email always works.
          </p>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          Frequently asked questions
        </h1>
        <p className="mt-4 text-lg text-ink-600">
          Setup, Shopify permissions, how deliveries are recorded, and what to
          do when something looks wrong.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section key={group.heading} className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-ink-900">
            {group.heading}
          </h2>

          <div className="mt-4 divide-y divide-ink-200 border-y border-ink-200">
            {group.entries.map((entry) => (
              <details key={entry.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left">
                  <span className="text-base font-semibold text-ink-900">
                    {entry.q}
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 text-ink-400 transition-transform group-open:rotate-45"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <div className="mt-3 space-y-3 text-base leading-relaxed text-ink-600 [&_code]:rounded [&_code]:bg-ink-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_li]:mt-1.5 [&_strong]:text-ink-900 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
                  {entry.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-12 rounded-xl border border-ink-200 bg-ink-50 p-6">
        <h2 className="text-base font-semibold text-ink-900">
          Something not covered here?
        </h2>
        <p className="mt-1.5 text-sm text-ink-600">
          Send us the details of how your deliveries run and we will answer
          properly.
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-ink-900 px-5 text-sm font-semibold text-white hover:bg-ink-800"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
