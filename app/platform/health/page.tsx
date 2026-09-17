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
import {
  VERCEL_DAILY_CRON,
  getSweepScheduleStatus,
  type SweepScheduleStatus,
} from "@/lib/queue/qstash";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "System health" };

export default async function PlatformHealthPage() {
  await requirePlatformAdmin();

  const [totals, webhooks, sweepSchedule] = await Promise.all([
    getPlatformTotals(),
    getWebhookHealth(7),
    // Never throws: a failed health check must not take the health page down.
    getSweepScheduleStatus(),
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
      name: "Shopify fallback app",
      configured: isConfigured("SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"),
      // Each store now carries the keys of the app it was connected through,
      // so this is no longer required — it only catches stores that predate
      // per-store credentials and were never reconnected.
      optional: true,
      note: "Only used by stores that carry no app keys of their own. Every store added since carries them.",
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

  const missing = integrations.filter(
    (entry) => !entry.configured && !("optional" in entry && entry.optional),
  );

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
                        : "optional" in entry && entry.optional
                          ? "var(--viz-deemphasis)"
                          : "var(--viz-warning)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      {entry.name}{" "}
                      <span className="text-xs font-normal text-ink-500">
                        —{" "}
                        {entry.configured
                          ? "configured"
                          : "optional" in entry && entry.optional
                            ? "not set, and not needed"
                            : "not configured"}
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
              A send that stays queued past its time is picked up by the sweep.
              Failures keep the provider&rsquo;s reason on the order&rsquo;s
              email log.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="The sweep"
          description="What re-sends scheduled email that QStash never delivered."
        />
        <CardBody>
          <SweepSchedule status={sweepSchedule} />
        </CardBody>
      </Card>

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

/**
 * The sweep runs on two schedulers, and the reason is worth stating on the
 * page: Vercel's Hobby plan permits one cron run per day and nothing more, so
 * the frequent run has to live somewhere else.
 */
function SweepSchedule({ status }: { status: SweepScheduleStatus }) {
  const qstash =
    status.state === "active"
      ? {
          tone: status.paused ? "var(--viz-warning)" : "var(--viz-good)",
          label: status.paused
            ? `Paused — ${status.cron}`
            : `Every run of ${status.cron}`,
        }
      : status.state === "missing"
        ? {
            tone: "var(--viz-warning)",
            label: "No schedule registered — run npm run qstash:setup",
          }
        : status.state === "not-configured"
          ? { tone: "var(--viz-warning)", label: "QSTASH_TOKEN is not set" }
          : { tone: "var(--viz-warning)", label: `Unreachable — ${status.error}` };

  return (
    <>
      <ul className="divide-y divide-ink-100 -my-2.5">
        <li className="flex gap-3 py-2.5">
          <span
            aria-hidden
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--viz-good)" }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-900">
              Vercel Cron{" "}
              <span className="text-xs font-normal text-ink-500">
                — {VERCEL_DAILY_CRON}, once a day
              </span>
            </p>
            <p className="text-xs text-ink-500">
              Declared in <code>vercel.json</code>. The Hobby plan allows one
              run per day, which is why it is not the main sweep.
            </p>
          </div>
        </li>

        <li className="flex gap-3 py-2.5">
          <span
            aria-hidden
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: qstash.tone }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-900">
              QStash schedule{" "}
              <span className="text-xs font-normal text-ink-500">
                — {qstash.label}
              </span>
            </p>
            <p className="text-xs text-ink-500">
              {status.state === "active"
                ? status.destination
                : "Registered with npm run qstash:setup. This is the frequent sweep."}
            </p>
          </div>
        </li>
      </ul>

      <p className="mt-3 text-xs text-ink-500">
        Both call the same endpoint, and the sweep skips anything already sent,
        so an overlap is harmless. Delayed email itself does not depend on
        either: each send is queued with QStash at the moment it is scheduled.
      </p>
    </>
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
