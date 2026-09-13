/**
 * Admin navigation structure.
 *
 * Icons are referenced **by name**, not by component. The sidebar is built in a
 * Server Component but rendered by a Client one, and a React component is a
 * function — it cannot cross that boundary. The client-side link resolves the
 * name against its own registry.
 */
export type NavIconName =
  | "dashboard"
  | "orders"
  | "stages"
  | "branding"
  | "mail"
  | "sequence"
  | "fulfillment"
  | "stores"
  | "users";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  /** Count shown as a pill, e.g. orders needing attention. */
  badge?: number;
};

export type AdminNavGroup = { heading: string; items: AdminNavItem[] };

export function buildAdminNav(counts: {
  attention: number;
  activeOrders: number;
  stores: number;
}): AdminNavGroup[] {
  return [
    {
      heading: "Operations",
      items: [
        {
          href: "/admin",
          label: "Dashboard",
          icon: "dashboard",
          badge: counts.attention,
        },
        {
          href: "/admin/orders",
          label: "Orders",
          icon: "orders",
          badge: counts.activeOrders,
        },
      ],
    },
    {
      heading: "Customer experience",
      items: [
        { href: "/admin/stages", label: "Tracking stages", icon: "stages" },
        { href: "/admin/branding", label: "Branding", icon: "branding" },
        { href: "/admin/emails/templates", label: "Email templates", icon: "mail" },
        { href: "/admin/emails/sequence", label: "Email sequence", icon: "sequence" },
      ],
    },
    {
      heading: "Settings",
      items: [
        {
          href: "/admin/settings/fulfillment",
          label: "Fulfillment",
          icon: "fulfillment",
        },
        {
          href: "/admin/stores",
          label: "Stores",
          icon: "stores",
          badge: counts.stores,
        },
        { href: "/admin/settings/users", label: "Users", icon: "users" },
      ],
    },
  ];
}
