import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { StoreSwitcher } from "@/components/store-switcher";
import { NavLink } from "@/components/nav-link";
import type { StoreSession } from "@/lib/auth/session";

export type NavItem = { href: string; label: string };

/**
 * Shared chrome for the backoffice and the agency UI: a sticky top bar with
 * the store switcher, a horizontally scrollable nav, and the page content.
 * Mobile-first — the nav collapses to a scrolling row rather than a drawer so
 * dispatch staff can reach every screen with one thumb.
 */
export function AppShell({
  session,
  nav,
  areaLabel,
  children,
}: {
  session: StoreSession;
  nav: NavItem[];
  areaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="text-sm font-semibold text-ink-900">
              Tracky
            </Link>
            <span className="hidden text-xs text-ink-500 sm:inline">
              {areaLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <StoreSwitcher
              memberships={session.memberships}
              activeStoreId={session.store.id}
            />
            <SignOutButton />
          </div>
        </div>
        <nav
          aria-label={`${areaLabel} sections`}
          className="mx-auto w-full max-w-6xl overflow-x-auto px-4"
        >
          <ul className="flex min-w-max items-center gap-1 pb-2">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-ink-200 px-4 py-4 text-center text-xs text-ink-400">
        {session.store.name ?? session.store.shopDomain} ·{" "}
        {session.role === "owner" ? "Owner" : "Agency"} access
      </footer>
    </div>
  );
}
