import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui";
import { contactAddress, contactIsConfigured } from "./actions";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Tell us how your delivery operation works and we will tell you honestly whether Tracky fits it.",
};

export default async function ContactPage() {
  const [configured, address] = await Promise.all([
    contactIsConfigured(),
    contactAddress(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          Get in touch
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-600">
          Tell us how your deliveries actually run — how many orders, who takes
          them out, what your customers ask you. We will tell you honestly
          whether Tracky fits, including when it does not.
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div>
          {configured ? null : (
            <Alert tone="warning" title="The form is not connected yet" className="mb-6">
              This deployment has no contact address configured, so the form
              cannot deliver. {address ? `Email ${address} instead.` : "Please use the address on your invoice or order confirmation."}
            </Alert>
          )}

          <ContactForm fallbackAddress={address} />
        </div>

        <aside className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-ink-900">
              Already a customer?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Sign in and the answer is often already there: every order carries
              its full event history and its email log, with the reason when
              something failed.
            </p>
            <Link
              href="/login"
              className="mt-3 inline-flex text-sm font-semibold text-ink-900 underline underline-offset-2"
            >
              Sign in
            </Link>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink-900">
              Tracking an order?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              We are the software behind the tracking page, not the shop you
              bought from and not the courier. For anything about your own
              parcel, reply to your order confirmation — the merchant can see
              far more than we can, and can actually do something about it.
            </p>
          </section>

          {address ? (
            <section>
              <h2 className="text-sm font-semibold text-ink-900">Email</h2>
              <p className="mt-2 text-sm text-ink-600">
                <a
                  href={`mailto:${address}`}
                  className="font-medium text-ink-900 underline underline-offset-2"
                >
                  {address}
                </a>
              </p>
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold text-ink-900">
              What happens next
            </h2>
            <ol className="mt-2 space-y-2 text-sm leading-relaxed text-ink-600">
              <li>1. We read it — a person, not an autoresponder.</li>
              <li>
                2. We reply with whether it fits, and what setting it up would
                involve for your team.
              </li>
              <li>3. If it does fit, we walk you through connecting a store.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
