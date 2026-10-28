import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { legalDetails } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What personal information Tracky handles for Shopify merchants and their customers, why, who it is shared with, and how to have it corrected or deleted.",
};

export default function PrivacyPage() {
  const { entity } = legalDetails();

  return (
    <LegalPage
      title="Privacy policy"
      current="/privacy"
      intro={
        <p>
          This policy explains what personal information {entity} (“Tracky”,
          “we”) handles when a Shopify merchant uses the app, when their
          delivery team uses it, and when their customers track an order or
          receive an email from it.
        </p>
      }
    >
      <LegalSection title="Our role">
        <p>
          For the information in a merchant’s orders, the{" "}
          <strong>merchant is the controller</strong> and Tracky is a{" "}
          <strong>processor</strong>: we handle it only to provide the service
          the merchant set up, on their instructions. If you bought from a store
          that uses Tracky, that store’s own privacy policy governs your data,
          and they are the first people to ask about it.
        </p>
        <p>
          For the accounts of merchants and their delivery staff, and for
          messages sent to us through this website, Tracky is the controller.
        </p>
      </LegalSection>

      <LegalSection title="What we handle">
        <ul>
          <li>
            <strong>Order information from Shopify</strong> — order number and
            date, the customer’s name, email address, phone number and shipping
            address, the items ordered and the order total. It arrives through
            Shopify’s webhooks and API once a merchant installs the app.
          </li>
          <li>
            <strong>Delivery records</strong> — each status update, when it
            happened, who recorded it, any note added, the name of the driver
            assigned and, when the agency uploads one, a photo of the signed
            delivery note.
          </li>
          <li>
            <strong>Email records</strong> — which tracking emails were sent to
            which address, when, and whether they were delivered.
          </li>
          <li>
            <strong>Accounts</strong> — the name, email address, password (stored
            only as a one-way hash) and role of each merchant and agency user.
          </li>
          <li>
            <strong>Store settings</strong> — the merchant’s branding, email
            templates and the Shopify access token, which is stored encrypted
            and deleted when the app is uninstalled.
          </li>
          <li>
            <strong>Contact form messages</strong> — whatever you choose to
            send us, with the name and email address you give.
          </li>
          <li>
            <strong>Technical data</strong> — standard server logs (IP address,
            browser, pages requested) kept by our hosting provider for security
            and troubleshooting.
          </li>
        </ul>
        <p>
          We do not sell personal information, use it for advertising, or
          build profiles of shoppers. Tracky adds no analytics or advertising
          trackers to the tracking page or the emails it sends.
        </p>
      </LegalSection>

      <LegalSection title="Why we use it">
        <ul>
          <li>
            To show customers where their order is and send the tracking emails
            the merchant configured — performing the merchant’s contract with
            their customer, on the merchant’s behalf.
          </li>
          <li>
            To let the delivery team record updates and confirm deliveries, and
            to tell Shopify when an order is fulfilled.
          </li>
          <li>
            To run accounts, keep the service secure and fix problems — our
            legitimate interest in operating a reliable service.
          </li>
          <li>To answer messages sent to us.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          Only the service providers needed to run Tracky, each bound to use
          the data solely for that purpose:
        </p>
        <ul>
          <li>
            <strong>Shopify</strong> — the source of order data, and where
            fulfillments are reported back.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting and storage of
            uploaded delivery photos.
          </li>
          <li>
            <strong>Neon</strong> — the database.
          </li>
          <li>
            <strong>Resend</strong> and our own <strong>Postal</strong> mail
            server — sending tracking emails.
          </li>
          <li>
            <strong>Upstash</strong> — scheduling the emails a merchant sets to
            go out after a delay.
          </li>
        </ul>
        <p>
          These providers may process data outside your country, including in
          the United States. Where the law requires it, transfers rely on
          safeguards such as the European Commission’s standard contractual
          clauses. We also disclose information when the law requires us to.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Order, delivery and email records are kept while the merchant uses
          Tracky, so the history of each order stays answerable. When a merchant
          uninstalls the app, their Shopify access token is deleted straight
          away; the rest of their store’s data is deleted on request, or when
          Shopify asks us to on the merchant’s behalf. Contact messages are kept
          as long as needed to answer them.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Data is sent over encrypted connections, access tokens are encrypted
          at rest, and each store’s data is kept separate from every other
          store’s. A customer’s full address on the tracking page is shown only
          to someone who opened it from their own email link or confirmed the
          email address on the order.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          Depending on where you live, you can ask to see the information held
          about you, have it corrected or deleted, object to or restrict how it
          is used, or receive a copy. You can also complain to your local data
          protection authority.
        </p>
        <p>
          If you are a store’s customer, please contact that store first — they
          control your order data and can action most requests directly. If you
          contact us instead, we will pass your request to them and help them
          answer it.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Tracky uses only the cookies needed to keep you signed in and remember
          which store you are working in. See the{" "}
          <Link href="/cookies">cookie policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          When this policy changes, the date at the top changes with it. If a
          change materially affects how merchants’ data is handled, we will tell
          them before it takes effect.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <ContactLine />
      </LegalSection>
    </LegalPage>
  );
}
