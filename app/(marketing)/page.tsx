import type { Metadata } from "next";
import Link from "next/link";

import {
  IconAlertOctagon,
  IconBrush,
  IconCheckCircle,
  IconClock,
  IconMail,
  IconStages,
  IconTruck,
  IconUsers,
} from "@/components/icons";
import { TrackingPreview } from "@/components/marketing/tracking-preview";

export const metadata: Metadata = {
  title: "Order tracking that only ever tells the truth",
  description:
    "Tracky gives Shopify merchants who run their own drivers a branded tracking page, automated customer email, and fulfillment that waits for a real, confirmed delivery.",
};

export default function LandingPage() {
  return (
    <>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="border-b border-ink-200 bg-gradient-to-b from-ink-50 to-white">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-600">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: "var(--viz-good)" }}
              />
              For Shopify merchants who deliver with their own drivers
            </p>

            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Order tracking that only ever tells your customer the truth.
            </h1>

            <p className="mt-5 text-lg leading-relaxed text-ink-600">
              Most tracking pages fill the silence with invented updates. Tracky
              shows exactly two kinds of thing: what Shopify told us, and what
              your delivery team recorded. Nothing moves on a timer, and nothing
              is marked delivered until someone says it was.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/contact"
                className="inline-flex h-11 items-center rounded-lg bg-ink-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
              >
                Talk to us
              </Link>
              <Link
                href="/about"
                className="inline-flex h-11 items-center rounded-lg border border-ink-300 bg-white px-6 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-50"
              >
                How it works
              </Link>
              <Link
                href="/track"
                className="inline-flex h-11 items-center px-2 text-sm font-semibold text-ink-700 underline underline-offset-4 hover:text-ink-900"
              >
                Track my order
              </Link>
            </div>

            <p className="mt-4 text-sm text-ink-500">
              Installs on your Shopify store. The tracking page lives on your own
              domain — your customers never leave it.
            </p>
          </div>

          <TrackingPreview />
        </div>
      </section>

      {/* --------------------------- The premise --------------------------- */}
      <section className="border-b border-ink-200">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                An order moves when something really happens. Never because time
                passed.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-600">
                It is the one rule the whole product is built around. A stage
                only changes for one of three reasons, and every change records
                which:
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  {
                    label: "Shopify sent a webhook",
                    detail: "A new order arrives and enters your first stage.",
                  },
                  {
                    label: "Your delivery agency recorded an update",
                    detail:
                      "From their phone, in the street, with their name against it.",
                  },
                  {
                    label: "You applied a manual override",
                    detail: "Logged as yours, with the message you chose to show.",
                  },
                ].map((item) => (
                  <li key={item.label} className="flex gap-3">
                    <span
                      style={{ color: "var(--viz-good)" }}
                      className="mt-0.5 shrink-0"
                    >
                      <IconCheckCircle className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-900">
                        {item.label}
                      </span>
                      <span className="block text-sm text-ink-600">
                        {item.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-ink-200 bg-ink-50 p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                What that rules out
              </p>
              <ul className="mt-4 space-y-4">
                {[
                  {
                    icon: IconClock,
                    title: "No scans that never happened",
                    body: "No “in transit” row appears because a day went by. If nobody updated it, the page says so plainly.",
                  },
                  {
                    icon: IconAlertOctagon,
                    title: "No fulfillment without a real delivery",
                    body: "Shopify is only told an order is fulfilled after your agency confirms the handover and the customer has signed the paper note.",
                  },
                  {
                    icon: IconTruck,
                    title: "No promised delivery dates",
                    body: "Nothing estimates an arrival it cannot know. Your team's last real update is what the customer sees.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title} className="flex gap-3">
                      <span className="mt-0.5 shrink-0 text-ink-400">
                        <Icon className="size-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink-900">
                          {item.title}
                        </span>
                        <span className="block text-sm text-ink-600">
                          {item.body}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- Features ---------------------------- */}
      <section className="border-b border-ink-200 bg-ink-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            Everything the post-purchase side of your store needs
          </h2>
          <p className="mt-3 max-w-2xl text-base text-ink-600">
            Set up once, change it yourself afterwards. No developer, and no
            waiting on us.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: IconStages,
                title: "Tracking stages you define",
                body: "Name them, colour them, reorder them, add your own. The customer timeline follows whatever you set up, not a fixed template.",
              },
              {
                icon: IconBrush,
                title: "A tracking page that looks like you",
                body: "Colours, logo, fonts, copy and FAQ — edited with a live preview, and served on your own domain through the Shopify App Proxy.",
              },
              {
                icon: IconMail,
                title: "Email that goes out on its own",
                body: "Attach a template to a stage or to a delay in days. Every send is logged, with the reason when one fails.",
              },
              {
                icon: IconTruck,
                title: "A dispatch screen built for a phone",
                body: "Your agency assigns a driver, updates a status and confirms a delivery one-handed, in the street. No app to install.",
              },
              {
                icon: IconCheckCircle,
                title: "Proof of delivery, on paper",
                body: "Your driver gets a signature on the paper note, as they always have. The agency records the delivery, optionally with a photo of it.",
              },
              {
                icon: IconUsers,
                title: "As many stores as you run",
                body: "Each one gets its own stages, branding, templates and rules. Connect a new store by pasting its link.",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-xl border border-ink-200 bg-white p-5"
                >
                  <span
                    aria-hidden
                    className="grid size-9 place-items-center rounded-lg bg-ink-100 text-ink-600"
                  >
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-3.5 text-sm font-semibold text-ink-900">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                    {feature.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------- How it goes --------------------------- */}
      <section className="border-b border-ink-200">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            What a delivery looks like
          </h2>

          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              {
                step: "1",
                title: "The order arrives",
                body: "Shopify sends the order the moment it is placed. It enters your first stage and the confirmation email goes out.",
              },
              {
                step: "2",
                title: "Your agency picks it up",
                body: "Dispatch assigns a driver and moves it along — packed, out for delivery — adding a message for the customer when it helps.",
              },
              {
                step: "3",
                title: "The driver delivers it",
                body: "The customer signs the paper note, as usual. Nothing digital changes hands at the door.",
              },
              {
                step: "4",
                title: "The agency confirms it",
                body: "They mark it delivered. Only then is the order fulfilled in Shopify, with the real delivery details.",
              },
            ].map((item) => (
              <li key={item.step} className="relative">
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: "var(--viz-series-1)" }}
                >
                  {item.step}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------- CTA ------------------------------- */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="rounded-2xl bg-ink-900 px-6 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Run your own deliveries? Let&rsquo;s talk.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-ink-300">
              Tell us how your delivery operation works and we will tell you
              honestly whether Tracky fits it.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex h-11 items-center rounded-lg bg-white px-6 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-100"
              >
                Get in touch
              </Link>
              <Link
                href="/faq"
                className="inline-flex h-11 items-center rounded-lg border border-white/25 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Read the FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
