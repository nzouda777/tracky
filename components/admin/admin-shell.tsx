import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { StoreSwitcher } from "@/components/store-switcher";
import { AdminNavLink } from "./admin-nav-link";
import type { AdminNavGroup } from "./nav-config";
import type { StoreSession } from "@/lib/auth/session";

/**
 * Backoffice chrome.
 *
 * A persistent left sidebar on desktop — the pattern an operator expects from
 * an admin tool, and the only way nine sections stay reachable in one click —
 * collapsing to a horizontally scrollable icon rail on narrow screens.
 *
 * The agency UI deliberately keeps its own `AppShell`: dispatch works
 * one-handed on a phone, where a sidebar would be the wrong shape.
 */
export function AdminShell({
  session,
  nav,
  isPlatformAdmin,
  children,
}: {
  session: StoreSession;
  nav: AdminNavGroup[];
  /** Shows the link into the cross-store panel. Never shown to anyone else. */
  isPlatformAdmin?: boolean;
  children: React.ReactNode;
}) {
  const flat = nav.flatMap((group) => group.items);

  return (
    <div className="min-h-dvh lg:flex">
      {/* ---------------- Desktop sidebar ---------------- */}
      {/* Sticky and full-height: the nav must stay put while a long dashboard
          scrolls, which is half the point of having a sidebar at all. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-ink-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-ink-200 px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white"
              style={{ backgroundColor: "var(--viz-series-1)" }}
            >
              T
            </span>
            <span className="text-sm font-semibold text-ink-900">Tracky</span>
          </Link>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Admin
          </span>
        </div>

        <nav aria-label="Backoffice sections" className="flex-1 overflow-y-auto px-3 py-4">
          {nav.map((group) => (
            <div key={group.heading} className="mb-5 last:mb-0">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <AdminNavLink item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-200 px-3 py-3">
          <p className="truncate px-2 text-xs font-medium text-ink-700">
            {session.store.name ?? session.store.shopDomain}
          </p>
          <p className="truncate px-2 text-[11px] text-ink-400">
            {session.user.email}
          </p>
          <div className="mt-2 px-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------------- Top bar ---------------- */}
        <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4">
            <Link href="/admin" className="flex items-center gap-2 lg:hidden">
              <span
                aria-hidden
                className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white"
                style={{ backgroundColor: "var(--viz-series-1)" }}
              >
                T
              </span>
              <span className="text-sm font-semibold text-ink-900">Tracky</span>
            </Link>

            <div className="ml-auto flex items-center gap-3">
              <StoreSwitcher
                memberships={session.memberships}
                activeStoreId={session.store.id}
              />
              {isPlatformAdmin ? (
                <Link
                  href="/platform"
                  className="hidden rounded-full bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white lg:inline-block"
                >
                  Platform
                </Link>
              ) : null}
              <span className="hidden lg:inline">
                <Link
                  href="/agency"
                  className="text-xs font-medium text-ink-500 underline underline-offset-2 hover:text-ink-800"
                >
                  Dispatch view
                </Link>
              </span>
              <span className="lg:hidden">
                <SignOutButton />
              </span>
            </div>
          </div>

          {/* Mobile / tablet rail: every section, scrollable, one thumb. */}
          <nav
            aria-label="Backoffice sections"
            className="overflow-x-auto border-t border-ink-100 px-2 lg:hidden"
          >
            <ul className="flex min-w-max items-center gap-1 py-2">
              {flat.map((item) => (
                <li key={item.href}>
                  <AdminNavLink item={item} compact />
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main className="flex-1 bg-ink-50 px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
