import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { HealthBadge } from "@/components/platform/health-badge";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { getPlatformStores } from "@/lib/platform/queries";
import { formatDate, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform stores" };

export default async function PlatformStoresPage() {
  await requirePlatformAdmin();
  const rows = await getPlatformStores();

  const suspended = rows.filter((row) => row.store.suspendedAt).length;
  const disconnected = rows.filter((row) => row.store.status !== "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stores"
        description={`${rows.length} store${rows.length === 1 ? "" : "s"}${suspended > 0 ? ` · ${suspended} suspended` : ""}${disconnected > 0 ? ` · ${disconnected} disconnected` : ""}.`}
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="No stores yet"
            description="Stores appear here as soon as a merchant installs the app."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Store</Th>
                <Th>Health</Th>
                <Th>Orders</Th>
                <Th>7 days</Th>
                <Th>Open</Th>
                <Th>Stages</Th>
                <Th>Users</Th>
                <Th>Last order</Th>
                <Th>Connected</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.store.id} className="hover:bg-ink-50">
                  <Td>
                    <div className="min-w-0 space-y-0.5">
                      <Link
                        href={`/platform/stores/${row.store.id}`}
                        className="block truncate font-medium text-ink-900 underline-offset-2 hover:underline"
                      >
                        {row.store.name ?? row.store.shopDomain}
                      </Link>
                      <p className="truncate text-xs text-ink-500">
                        {row.store.shopDomain}
                      </p>
                      {row.store.internalNote ? (
                        <p className="truncate text-xs italic text-ink-400">
                          {row.store.internalNote}
                        </p>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <HealthBadge health={row.health} reason={row.healthReason} />
                      {row.store.suspendedAt ? (
                        <Badge tone="warning">Suspended</Badge>
                      ) : row.store.status !== "active" ? (
                        <Badge tone="danger">Disconnected</Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="tabular-nums text-ink-900">{row.orders}</Td>
                  <Td className="tabular-nums text-ink-700">{row.ordersLast7}</Td>
                  <Td className="tabular-nums text-ink-700">{row.activeOrders}</Td>
                  <Td className="tabular-nums text-ink-700">{row.stages}</Td>
                  <Td className="tabular-nums text-ink-700">{row.members}</Td>
                  <Td className="whitespace-nowrap text-ink-600">
                    {row.lastOrderAt ? formatRelative(row.lastOrderAt) : "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-600">
                    {row.store.installedAt ? formatDate(row.store.installedAt) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <p className="text-xs text-ink-500">
        Open a store to see its connection, configuration, the people with
        access, and the operator actions available. This panel shows counts and
        health — never a store&rsquo;s customer data.
      </p>
    </div>
  );
}
