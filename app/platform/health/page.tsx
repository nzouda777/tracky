import type { Metadata } from "next";

import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { getPlatformTotals, getWebhookHealth } from "@/lib/platform/queries";
import { env, isConfigured } from "@/lib/env";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "System health" };

export default async function PlatformHealthPage() {
  await requirePlatformAdmin();

  const [totals, webhooks] = await Promise.all([
    getPlatformTotals(),
    getWebhookHealth(7),
  ]);

  // Whether each integration is wired up at all. These read config, never
  // secrets — no value is rendered.
  const integrations = [
    {
      name: "Database (Neon)",
      configured: isConfigured("DATABASE_URL"),
      note: "Every screen you are looking at came from it.",
    },
    {
      name: "Shopify app",
      configured: isConfigured("SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"),
      note: "Needed for OAuth, webhook verification and the App Proxy signature.",
    },
    {
      name: "Email (Resend)",
      configured: env.resend.configured,
      note: "Without it, sends are recorded as failed and customers hear nothing.",
    },
    {
      name: "Scheduling (QStash)",
      configured: env.qstash.configured,
      note: "Delayed email falls back to the cron sweep when this is missing.",
    },
    {
      name: "File storage (Vercel Blob)",
      configured: isConfigured("BLOB_READ_WRITE_TOKEN"),
      note: "Logos and photos of signed delivery notes.",
    },
    {
      name: "Cron secret",
      configured: isConfigured("CRON_SECRET"),
      note: "Without it the email sweep endpoint refuses every request.",
    },
  ];

  const missing = integrations.filter((entry) => !entry.configured);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System health"
        description="Integrations, webhook delivery and the email queue, across every store."
      />

      {missing.length > 0 ? (
        <Alert tone="warning" title="Some integrations are not configured">
          {missing.map((entry) => entry.name).join(", ")}. The app degrades
          rather than crashing, but the affected features will not work.
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Integrations"
            description="Whether each service is wired up. Secrets are never shown."
          />
          <CardBody>
            <ul className="divide-y divide-ink-100 -my-2.5">
              {integrations.map((entry) => (
                <li key={entry.name} className="flex gap-3 py-2.5">
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: entry.configured
                        ? "var(--viz-good)"
                        : "var(--viz-warning)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      {entry.name}{" "}
                      <span className="text-xs font-normal text-ink-500">
                        — {entry.configured ? "configured" : "not configured"}
                      </span>
                    </p>
                    <p className="text-xs text-ink-500">{entry.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Email queue" description="Across every store." />
          <CardBody>
            <dl className="space-y-2.5 text-sm">
              <Row label="Waiting to send" value={totals.scheduledEmails} />
              <Row label="Failed" value={totals.failedEmails} bad />
            </dl>
            <p className="mt-3 text-xs text-ink-500">
              A send that stays queued past its time is picked up by the Vercel
              Cron sweep, which runs every 15 minutes. Failures keep the
              provider&rsquo;s reason on the order&rsquo;s email log.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Webhook delivery"
          description="What Shopify has sent in the last 7 days, and what failed to process."
        />
        {webhooks.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">
              No webhooks received in the last 7 days. On a live store that is
              itself worth investigating — check the subscriptions in the
              Shopify Partner dashboard.
            </p>
          </CardBody>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Topic</Th>
                <Th>Received</Th>
                <Th>Failed</Th>
                <Th>Last received</Th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((row) => (
                <tr key={row.topic} className="hover:bg-ink-50">
                  <Td className="font-medium text-ink-900">{row.topic}</Td>
                  <Td className="tabular-nums text-ink-700">{row.received}</Td>
                  <Td
                    className={`tabular-nums ${row.failed > 0 ? "font-semibold text-red-700" : "text-ink-700"}`}
                  >
                    {row.failed}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-600">
                    {row.lastReceivedAt
                      ? formatRelative(row.lastReceivedAt)
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="If orders are missing from a store" />
        <CardBody className="space-y-2 text-sm text-ink-600">
          <p>
            Orders arrive by webhook only. If a store is missing them, check
            the <strong>orders/create</strong> row above: no deliveries, or
            failures, points at the subscription or the endpoint.
          </p>
          <p>
            The store owner can recover the gap themselves with{" "}
            <strong>Sync orders</strong> on their Orders screen, which pulls
            from the Shopify Admin API. That also covers orders placed before
            the app was installed, which are never sent as webhooks at all.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  bad,
}: {
  label: string;
  value: number;
  bad?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd
        className={`font-semibold tabular-nums ${bad && value > 0 ? "text-red-700" : "text-ink-900"}`}
      >
        {value}
      </dd>
    </div>
  );
}
