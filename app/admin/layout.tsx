import { AdminShell } from "@/components/admin/admin-shell";
import { buildAdminNav } from "@/components/admin/nav-config";
import { getPlatformSession } from "@/lib/auth/platform";
import { requireOwner } from "@/lib/auth/session";
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
  const [metrics, attention] = await Promise.all([
    getDashboardMetrics(session.tdb, allStages),
    getAttentionItems(session.tdb, allStages),
  ]);

  const nav = buildAdminNav({
    attention: attention.length,
    activeOrders: metrics.activeOrders,
    stores: session.memberships.length,
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
      {children}
    </AdminShell>
  );
}
