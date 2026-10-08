import Link from "next/link";

import { Alert } from "@/components/ui";
import { AdminShell } from "@/components/admin/admin-shell";
import { buildAdminNav } from "@/components/admin/nav-config";
import { getPlatformSession } from "@/lib/auth/platform";
import { requireOwner } from "@/lib/auth/session";
import { countEmailSendsByStatus } from "@/lib/email/log";
import {
  getAttentionItems,
  getDashboardMetrics,
  getOrderedStages,
} from "@/lib/orders/dashboard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Owner-only. An agency-only user is redirected to their own area by the guard.
  const session = await requireOwner();

  // The sidebar carries live counts, so a problem is visible from any screen
  // rather than only on the dashboard.
  const allStages = await getOrderedStages(session.tdb);
  const [metrics, attention, emailCounts] = await Promise.all([
    getDashboardMetrics(session.tdb, allStages),
    getAttentionItems(session.tdb, allStages),
    countEmailSendsByStatus(session.tdb),
  ]);

  const nav = buildAdminNav({
    attention: attention.length,
    activeOrders: metrics.activeOrders,
    stores: session.memberships.length,
    failedEmails: emailCounts.failed,
  });

  // Only a platform operator ever sees the link; everyone else gets a 404 at
  // /platform anyway, but there is no reason to advertise it.
  const platform = await getPlatformSession();

  return (
    <AdminShell
      session={session}
      nav={nav}
      isPlatformAdmin={Boolean(platform)}
    >
      {/* On every screen, not just the Stores list. A pause silently swallows
          customer emails, and a silent cause is the expensive kind to debug. */}
      {session.store.pausedAt ? (
        <Alert tone="warning" title="This store is paused" className="mb-4">
          Orders are still arriving and nothing is disconnected, but no customer
          email is being sent and no fulfillment is reaching Shopify. Resume it
          from{" "}
          <Link href="/admin/stores" className="underline underline-offset-2">
            Stores
          </Link>
          .
        </Alert>
      ) : null}
      {children}
    </AdminShell>
  );
}
