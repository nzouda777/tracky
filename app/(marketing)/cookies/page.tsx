import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, LegalPage, LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Cookie policy",
  description:
    "Tracky sets only the cookies needed to keep you signed in. No analytics, no advertising.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      current="/cookies"
      intro={
        <p>
          Tracky sets only the cookies it needs to work. There are no analytics,
          advertising or third-party tracking cookies, so there is nothing to
          opt in to.
        </p>
      }
    >
      <LegalSection title="Cookies we set">
        <ul>
          <li>
            <strong>Sign-in</strong> — the session cookie that keeps merchants
            and delivery staff signed in to the backoffice and dispatch
            screens, with the companion cookies that protect the sign-in form
            against forgery and return you to the page you came from. Removed
            when you sign out or the session expires.
          </li>
          <li>
            <strong>Active store</strong> — remembers which store you are
            working in when your account has more than one.
          </li>
          <li>
            <strong>Install</strong> — short-lived cookies that secure the
            Shopify connection while the app is being installed and link the
            new store to the account finishing it.
          </li>
        </ul>
        <p>
          All of them are strictly necessary and first-party, which is why no
          consent banner is shown for them.
        </p>
      </LegalSection>

      <LegalSection title="Tracking pages and emails">
        <p>
          The customer tracking page sets no cookies of its own. When it is
          shown inside a merchant’s Shopify store, that store and Shopify may
          set their own cookies, which their policies cover. Tracky does not
          add open-tracking pixels to the emails it sends.
        </p>
      </LegalSection>

      <LegalSection title="Managing cookies">
        <p>
          You can block or delete cookies in your browser settings. Blocking
          these ones will stop you staying signed in, but will not affect the
          public tracking page. More on how we handle data is in the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <ContactLine />
      </LegalSection>
    </LegalPage>
  );
}
