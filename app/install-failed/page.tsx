import type { Metadata } from "next";
import Link from "next/link";

import { Alert, Card, CardBody } from "@/components/ui";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Installation failed" };

/**
 * Where a failed install lands.
 *
 * It names the two settings that have to match, and prints this deployment's
 * side of them, because a mismatch between the app's redirect URL and the one
 * allowlisted in Shopify is what nearly every first failed install turns out
 * to be — and a merchant cannot guess a URL they have never seen.
 */
export default async function InstallFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const appUrl = env.appUrl.replace(/\/$/, "");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-4">
        <Card>
          <CardBody className="space-y-5">
            <h1 className="text-h2 font-semibold text-ink-900">
              We could not complete the installation
            </h1>

            <Alert tone="danger">
              {message ?? "Something went wrong while connecting your store."}
            </Alert>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-900">
                Check these match your Shopify app
              </h2>
              <p className="text-sm text-ink-600">
                In the Shopify Partner dashboard, under your app&rsquo;s
                configuration, these have to be present exactly as written:
              </p>
              <dl className="divide-y divide-ink-100 border-y border-line">
                <Row label="App URL" value={appUrl} />
                <Row
                  label="Allowed redirection URL"
                  value={`${appUrl}/api/shopify/callback`}
                />
              </dl>
              <p className="text-sm text-ink-600">
                An app created inside a store&rsquo;s admin under{" "}
                <em>Develop apps</em> has no redirect URLs and cannot be
                installed this way. It needs to be a Partner dashboard app.
              </p>
            </div>

            <p className="text-sm text-ink-500">
              Once they match, open the app again from your Shopify admin to
              retry. Running <code className="type-code">npm run shopify:check</code>{" "}
              on the deployment reports the same values and what else is missing.
            </p>

            <Link
              href="/login"
              className="inline-block text-sm font-medium text-ink-700 underline underline-offset-2"
            >
              Sign in instead
            </Link>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="type-code min-w-0 break-all text-sm text-ink-900">
        {value}
      </dd>
    </div>
  );
}
