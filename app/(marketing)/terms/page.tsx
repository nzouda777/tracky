import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { legalDetails } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms on which Shopify merchants and their delivery teams use Tracky.",
};

export default function TermsPage() {
  const { entity, jurisdiction } = legalDetails();

  return (
    <LegalPage
      title="Terms of service"
      current="/terms"
      intro={
        <p>
          These terms apply to merchants who install Tracky in their Shopify
          store and to everyone they invite to use it. By installing or using
          Tracky you agree to them. The service is provided by {entity}{" "}
          (“Tracky”, “we”).
        </p>
      }
    >
      <LegalSection title="The service">
        <p>
          Tracky provides order tracking pages, tracking emails and a delivery
          workflow for merchants who deliver with their own drivers or a
          delivery agency. Tracky reports what has been recorded — by Shopify,
          by your team or by your agency — and never invents tracking events or
          delivery dates. Tracky is an independent application and is not
          affiliated with or endorsed by Shopify.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>
            You must be authorised to install apps in the Shopify store you
            connect, and to invite the people you add.
          </li>
          <li>
            You are responsible for what happens under your accounts, including
            your agency’s, and for keeping sign-in details private.
          </li>
          <li>
            You are responsible for the accuracy of the delivery updates your
            team records and the content of the emails and pages you configure.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your customers’ data">
        <p>
          You remain the controller of your customers’ personal information. You
          confirm you have a lawful basis to share it with Tracky and to send
          your customers the tracking emails you set up, and that your own
          privacy policy tells them about it. We process that data only to
          provide the service, as described in our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You must not use Tracky to:</p>
        <ul>
          <li>send spam or emails unrelated to a customer’s order;</li>
          <li>publish false delivery information to mislead customers;</li>
          <li>
            break the law, infringe anyone’s rights, or breach Shopify’s terms;
          </li>
          <li>
            probe, overload or try to get around the security of the service,
            or access another store’s data.
          </li>
        </ul>
        <p>We may suspend an account that does, after notice where we can give it.</p>
      </LegalSection>

      <LegalSection title="Fees">
        <p>
          Any fees are those shown when you install or upgrade, billed through
          Shopify unless agreed otherwise in writing. Shopify’s billing terms
          apply to those charges.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          We work to keep Tracky available and reliable, but it is provided “as
          is” and we do not promise it will be uninterrupted or error-free.
          Email delivery depends on recipients’ mail providers, which we do not
          control. We may change or improve features; if a change removes
          something you rely on, we will give reasonable notice.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          To the extent the law allows, Tracky is not liable for indirect or
          consequential loss, lost profits or lost data, and our total liability
          for any claim is limited to the fees you paid us in the twelve months
          before it arose. Nothing in these terms limits liability that cannot
          be limited by law, or rights you have as a consumer.
        </p>
      </LegalSection>

      <LegalSection title="Ending the service">
        <p>
          You can stop at any time by uninstalling the app; Tracky’s access to
          your store ends immediately. You can ask us to delete your store’s
          data. We may end the service with reasonable notice, or immediately
          for a serious breach of these terms.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms; the date at the top shows the latest
          version. For material changes we will notify merchants in advance.
          Continuing to use Tracky after a change means you accept it.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the laws of{" "}
          {jurisdiction ?? "the place where Tracky is established"}, and its
          courts have jurisdiction over any dispute, without affecting any
          mandatory consumer protections where you live.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <ContactLine />
      </LegalSection>
    </LegalPage>
  );
}
