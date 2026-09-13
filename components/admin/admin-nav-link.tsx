"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconBrush,
  IconDashboard,
  IconMail,
  IconOrders,
  IconSequence,
  IconStages,
  IconStore,
  IconTruck,
  IconUsers,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import type { AdminNavItem, NavIconName } from "./nav-config";

/**
 * Icon registry, resolved on the client.
 *
 * The server sends a name; the component is looked up here. Components are
 * functions and cannot be serialised across the server/client boundary.
 */
const ICONS: Record<NavIconName, typeof IconDashboard> = {
  dashboard: IconDashboard,
  orders: IconOrders,
  stages: IconStages,
  branding: IconBrush,
  mail: IconMail,
  sequence: IconSequence,
  fulfillment: IconTruck,
  stores: IconStore,
  users: IconUsers,
};

/**
 * Sidebar / rail nav item.
 *
 * `/admin` matches exactly so the dashboard is not marked current on every
 * nested page; the others match their subtree. The active state is announced
 * with `aria-current`, not only painted.
 */
export function AdminNavLink({
  item,
  compact,
}: {
  item: AdminNavItem;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const Icon = ICONS[item.icon];

  const active =
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
        compact && "whitespace-nowrap",
        active
          ? "bg-ink-900 text-white"
          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-white" : "text-ink-400 group-hover:text-ink-600",
        )}
      />
      <span className="truncate">{item.label}</span>

      {item.badge !== undefined && item.badge > 0 ? (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            active ? "bg-white/20 text-white" : "bg-ink-200 text-ink-700",
          )}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}
