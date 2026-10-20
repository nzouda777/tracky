import type { Metadata } from "next";

import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { parseProviderName, providerConfigured } from "@/lib/email/providers";
import { env } from "@/lib/env";
import { EmailProviderForm } from "./email-provider-form";

export const metadata: Metadata = { title: "Email delivery" };

export default async function EmailDeliverySettingsPage() {
  const { store } = await requireOwner();

  const primary = parseProviderName(store.emailPrimaryProvider);
  const configured = {
    resend: providerConfigured("resend"),
    postal: providerConfigured("postal"),
  };
  const fallbackMode = env.email.fallbackMode;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email delivery"
        description="Which provider sends this store's customer emails first, and which one takes over."
      />

      <Alert tone="info" title="How the fallback works">
        Every email goes to the main provider first. The other one only takes
        over when the main provider refuses it for a rate limit or a quota
        {fallbackMode === "any_error"
          ? " — or, as configured on this platform (EMAIL_FALLBACK_MODE=any_error), for any error at all."
          : "; any other error is recorded in the email log and retried."}{" "}
        Postal has no sending quota, so with Postal first, Resend rarely takes
        over unless the platform runs in &ldquo;any error&rdquo; mode.
      </Alert>

      {!configured[primary] ? (
        <Alert tone="warning" title="The main provider is not configured">
          {primary === "postal" ? "Postal" : "Resend"} has no credentials on this
          platform, so every email currently goes straight to the other
          provider.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Main provider" />
        <CardBody>
          <EmailProviderForm primary={primary} configured={configured} />
        </CardBody>
      </Card>
    </div>
  );
}
