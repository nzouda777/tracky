import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  TableWrap,
  Th,
} from "@/components/ui";
import { IconExternal } from "@/components/icons";
import { AuditTable } from "@/components/platform/audit-table";
import { HealthBadge } from "@/components/platform/health-badge";
import { PlatformActionForm } from "@/components/platform/action-form";
import { StoreNoteForm } from "./store-note-form";
import { MembershipRow } from "./membership-row";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import {
  disconnectStoreAction,
  resumeStoreAction,
  suspendStoreAction,
} from "@/lib/actions/platform";
import { listPlatformAudit } from "@/lib/platform/audit";
import { getPlatformStoreDetail } from "@/lib/platform/detail";
import { shopifyAdminUrl, storefrontUrl } from "@/lib/shopify/parse-shop";
import { buildTrackingLookupLink } from "@/lib/tracking/links";
import { formatDate, formatDateTime, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Store" };

export default async function PlatformStoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  await requirePlatformAdmin();
  const { storeId } = await params;

  const detail = await getPlatformStoreDetail(storeId);
  if (!detail) notFound();

  const { store, metrics, members, health, healthReason } = detail;
  const audit = await listPlatformAudit({ storeId, limit: 25 });
  const name = store.name ?? store.shopDomain;

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={store.shopDomain}
        action={
          <Link
            href="/platform/stores"
            className="text-sm font-medium text-ink-600 underline underline-offset-2"
          >
            ← All stores
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <HealthBadge health={health} reason={healthReason} />
        {store.suspendedAt ? (
          <Badge tone="warning">Suspended</Badge>
        ) : store.status === "active" ? (
          <Badge tone="success">Connected</Badge>
        ) : (
          <Badge tone="danger">Disconnected</Badge>
        )}
        {store.accessToken ? null : <Badge tone="neutral">No access token</Badge>}
      </div>

      {store.suspendedAt ? (
        <Alert tone="warning" title="This store is suspended">
          <p>
            {/* The reason is free text an operator typed, so it may or may not
                already end in punctuation — don't add a second full stop. */}
            Suspended {formatDateTime(store.suspendedAt)}
            {store.suspendedReason ? ` — ${store.suspendedReason}` : "."}
          </p>
          <p className="mt-1">
            Nobody can open its backoffice or dispatch screens. Its webhooks are
            still accepted, so orders placed during the hold still arrive and
            nothing needs back-filling when you resume it.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Orders" value={metrics.orders} hint={`${metrics.ordersLast7} in the last 7 days`} />
        <Metric label="Open orders" value={metrics.activeOrders} hint="Not cancelled" />
        <Metric label="Deliveries confirmed" value={metrics.delivered} hint="With proof of delivery" />
        <Metric
          label="Problems"
          value={metrics.failedFulfillments + metrics.failedEmails}
          hint={`${metrics.failedFulfillments} fulfillment · ${metrics.failedEmails} email`}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Connection" />
          <CardBody>
            <dl className="space-y-2.5 text-sm">
              <Row label="Shop domain" value={store.shopDomain} />
              <Row label="Customer domain" value={store.primaryDomain ?? "—"} />
              <Row label="Currency" value={store.currency} />
              <Row
                label="Connected"
                value={store.installedAt ? formatDate(store.installedAt) : "—"}
              />
              <Row
                label="Last order"
                value={
                  detail.lastOrderAt ? formatRelative(detail.lastOrderAt) : "None"
                }
              />
              <Row
                label="Last event"
                value={
                  detail.lastEventAt ? formatRelative(detail.lastEventAt) : "None"
                }
              />
              <Row label="Scopes" value={store.scope ?? "—"} />
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3">
              <External href={storefrontUrl(store.shopDomain)} label="Storefront" />
              <External href={shopifyAdminUrl(store.shopDomain)} label="Shopify admin" />
              <External href={buildTrackingLookupLink(store)} label="Tracking page" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Configuration" description="How the merchant has set it up." />
          <CardBody>
            <dl className="space-y-2.5 text-sm">
              <Row label="Tracking stages" value={String(metrics.stages)} />
              <Row label="Email templates" value={String(metrics.templates)} />
              <Row label="Emails queued" value={String(metrics.scheduledEmails)} />
              <Row label="Emails failed" value={String(metrics.failedEmails)} />
            </dl>
            <p className="mt-3 text-xs text-ink-500">
              To change any of this, sign in with an account that has access to
              the store. This panel deliberately cannot edit another
              merchant&rsquo;s configuration.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="People with access"
          description="Roles and membership can be changed from here."
        />
        {members.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">
              Nobody has access to this store — it was never claimed after
              installation.
            </p>
          </CardBody>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <MembershipRow key={member.membershipId} member={member} />
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="Internal note" description="Only operators ever see this." />
        <CardBody>
          <StoreNoteForm storeId={store.id} note={store.internalNote} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Operator actions"
          description="Each one is recorded in the audit log with your name and reason."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {store.suspendedAt ? (
              <PlatformActionForm
                action={resumeStoreAction}
                label="Resume store"
                title="Resume this store?"
                description="Its owner and agency users regain access immediately."
                hidden={{ storeId: store.id }}
                variant="primary"
              />
            ) : (
              <PlatformActionForm
                action={suspendStoreAction}
                label="Suspend store"
                title={`Suspend ${name}?`}
                description="Nobody will be able to open its backoffice or dispatch screens. Webhooks keep arriving, so no orders are lost."
                hidden={{ storeId: store.id }}
                variant="secondary"
                requireReason
              />
            )}

            <PlatformActionForm
              action={disconnectStoreAction}
              label="Disconnect from Shopify"
              title={`Disconnect ${store.shopDomain}?`}
              description="Destroys the Shopify access token. Orders, stages, branding and history are all kept — the merchant recovers by reinstalling the app."
              hidden={{ storeId: store.id }}
              variant="danger"
              requireReason
              confirmPhrase={store.shopDomain}
              disabled={store.status !== "active"}
            />
          </div>

          <p className="text-xs text-ink-500">
            There is no delete. A store&rsquo;s orders are a merchant&rsquo;s
            records and its history is what their customers were shown; removing
            them is a database operation, done deliberately and outside this
            panel.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Operator history for this store" />
        <AuditTable
          entries={audit}
          emptyHint="No operator has acted on this store."
        />
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-ink-400">{hint}</p> : null}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="break-all text-right font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function External({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900"
    >
      {label}
      <IconExternal className="size-3" />
    </a>
  );
}
