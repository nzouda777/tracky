import type { Metadata } from "next";

import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import {
  ATTEMPTS_BEFORE_FALLBACK,
  parseProviderName,
  providerConfigured,
} from "@/lib/email/providers";
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
  const missing = { resend: env.resend.missing, postal: env.postal.missing };
  const fallbackMode = env.email.fallbackMode;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email delivery"
        description="Which provider sends this store's customer emails first, and which one takes over."
      />

      <Alert tone="info" title="How the fallback works">
        Every email goes to the main provider first.{" "}
        {fallbackMode === "any_error"
          ? "On this platform (EMAIL_FALLBACK_MODE=any_error) the other provider takes over at the first failure."
          : `If it fails, it is retried up to ${ATTEMPTS_BEFORE_FALLBACK} times in total, then the other provider takes over. A rate limit or quota refusal hands over at once.`}{" "}
        If the other provider fails too, the email is marked failed in the log.
      </Alert>

      {!configured[primary] ? (
        <Alert tone="warning" title="The main provider is not configured">
          {primary === "postal" ? "Postal" : "Resend"} has no credentials on this
          platform, so every email currently goes straight to the other
          provider.
        </Alert>
      ) : null}

      {(["resend", "postal"] as const)
        .filter((name) => missing[name].length > 0)
        .map((name) => (
          <Alert
            key={name}
            tone="warning"
            title={`${name === "postal" ? "Postal" : "Resend"} is not configured on this deployment`}
          >
            Missing or empty: <code className="font-mono">{missing[name].join(", ")}</code>.
            Vercel only applies environment variables to new deployments, so after
            adding them in Vercel, redeploy — and check they are enabled for the
            Production environment.
          </Alert>
        ))}

      <Card>
        <CardHeader title="Main provider" />
        <CardBody>
          <EmailProviderForm primary={primary} configured={configured} />
        </CardBody>
      </Card>
    </div>
  );
}
