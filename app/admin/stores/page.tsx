import type { Metadata } from "next";
import Link from "next/link";

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
} from "@/components/ui";
import { IconExternal, IconStore } from "@/components/icons";
import { requireOwner } from "@/lib/auth/session";
import {
  listDisconnectedStores,
  listMyStores,
} from "@/lib/actions/stores";
import { env } from "@/lib/env";
import { shopifyAdminUrl, storefrontUrl } from "@/lib/shopify/parse-shop";
import { buildTrackingLookupLink } from "@/lib/tracking/links";
import { formatDate, formatRelative } from "@/lib/utils";
import { maskSecret } from "@/lib/shopify/credentials";
import { ConnectStoreForm } from "./connect-store-form";
import { ReconnectButton } from "./reconnect-button";
import { StoreCredentialsForm } from "./store-credentials-form";
import { SwitchToStoreButton } from "./switch-to-store-button";

export const metadata: Metadata = { title: "Stores" };

export default async function StoresPage() {
  const session = await requireOwner();

  const [rows, disconnected] = await Promise.all([
    listMyStores(session.store.id),
    listDisconnectedStores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stores"
        description="Connect a Shopify store and switch between the ones you manage."
      />

      {/* The primary action on this page, so it leads rather than trails. */}
      <Card>
        <CardHeader
          title="Connect a store"
          description="Paste the store's myshopify.com link, its admin link, or just the handle."
        />
        <CardBody>
          <ConnectStoreForm
            callbackUrl={`${env.appUrl}/api/shopify/callback`}
            platformAppConfigured={env.shopify.fallbackConfigured}
          />
        </CardBody>
      </Card>

      {disconnected.length > 0 ? (
        <Alert tone="warning" title="Some stores are disconnected">
          <p>
            Tracky was uninstalled from{" "}
            {disconnected.map((s) => s.shopDomain).join(", ")}. Their orders and
            settings are kept, but nothing will sync until they are reconnected.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {disconnected.map((store) => (
              <ReconnectButton
                key={store.id}
                storeId={store.id}
                shopDomain={store.shopDomain}
              />
            ))}
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Connected stores"
          description={`${rows.length} store${rows.length === 1 ? "" : "s"} on your account.`}
        />

        {rows.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">
              No stores yet. Connect your first one above.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((row) => (
              <li key={row.store.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500"
                    >
                      <IconStore className="size-4.5" />
                    </span>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {row.store.name ?? row.store.shopDomain}
                        </p>
                        {row.isActiveStore ? (
                          <Badge tone="info">Currently open</Badge>
                        ) : null}
                        {row.store.status === "active" ? (
                          <Badge tone="success">Connected</Badge>
                        ) : (
                          <Badge tone="danger">Disconnected</Badge>
                        )}
                        <Badge tone="neutral">
                          {row.role === "owner" ? "Owner" : "Agency"}
                        </Badge>
                      </div>

                      <p className="truncate text-xs text-ink-500">
                        {row.store.shopDomain}
                        {row.store.primaryDomain &&
                        row.store.primaryDomain !== row.store.shopDomain
                          ? `, ${row.store.primaryDomain}`
                          : ""}
                      </p>

                      {/* Which Shopify app this store runs on. Only the key is
                          shown, masked — the secret never leaves the server. */}
                      <p className="truncate text-xs text-ink-500">
                        {row.store.apiKey
                          ? `${row.store.authMode === "custom" ? "Custom app" : "Partner app"} ${maskSecret(row.store.apiKey)}`
                          : "Running on this deployment's default app"}
                      </p>

                      <p className="text-xs text-ink-500">
                        {row.totalOrders} order
                        {row.totalOrders === 1 ? "" : "s"} synced
                        {row.lastOrderAt
                          ? `, last one ${formatRelative(row.lastOrderAt)}`
                          : ", none yet"}
                        {row.store.installedAt
                          ? `, connected ${formatDate(row.store.installedAt)}`
                          : ""}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-0.5">
                        <ExternalLink
                          href={storefrontUrl(row.store.shopDomain)}
                          label="Storefront"
                        />
                        <ExternalLink
                          href={shopifyAdminUrl(row.store.shopDomain)}
                          label="Shopify admin"
                        />
                        <ExternalLink
                          href={buildTrackingLookupLink(row.store)}
                          label="Tracking page"
                        />
                        <Link
                          href={`/track/${row.store.shopDomain}`}
                          className="text-xs font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900"
                        >
                          Hosted tracking
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {row.isActiveStore ? (
                      <Link
                        href="/admin"
                        className="text-sm font-medium text-ink-700 underline underline-offset-2"
                      >
                        Open dashboard
                      </Link>
                    ) : (
                      <SwitchToStoreButton storeId={row.store.id} />
                    )}
                    {row.role === "owner" && row.store.status === "active" ? (
                      <ReconnectButton
                        storeId={row.store.id}
                        shopDomain={row.store.shopDomain}
                        subtle
                      />
                    ) : null}
                  </div>
                </div>

                {row.role === "owner" ? (
                  <details className="mt-3 sm:pl-12">
                    <summary className="cursor-pointer text-xs font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900">
                      Shopify app keys
                    </summary>
                    <div className="mt-3 rounded-card border border-ink-200 bg-ink-50/60 p-4">
                      <StoreCredentialsForm
                        storeId={row.store.id}
                        shopDomain={row.store.shopDomain}
                        currentMode={row.store.authMode}
                      />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="What happens when you connect a store" />
        <CardBody className="space-y-2 text-sm text-ink-600">
          <p>
            Each store is connected through <strong>its own Shopify app</strong>,
            whose keys you enter above. One app reaching its install ceiling
            therefore never blocks the next store, and adding an app needs no
            redeploy — only the one redirect URL shown above, added once to each
            app in the Partner dashboard.
          </p>
          <p>
            With a Partner app you are sent to Shopify to approve it. Approving
            requires admin rights on that store, which is what proves the store
            is yours. With a custom app there is no approval step: the Admin API
            token you paste is issued inside that store&rsquo;s own admin, which
            proves the same thing.
          </p>
          <p>
            The store then starts with <strong>its own</strong> tracking stages,
            branding, email templates, sequence and fulfillment rules — nothing
            is shared with your other stores, and nothing needs redeploying.
          </p>
          <p>
            Its order webhooks are registered automatically, so orders begin
            arriving straight away. Orders placed before the install are not
            imported.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
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
