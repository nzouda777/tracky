import Link from "next/link";

import { getCurrentUser, getMemberships } from "@/lib/auth/session";
import { MarketingNavLink } from "./nav-link";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  // Shoppers arrive looking for this, not for the product pitch.
  { href: "/track", label: "Track my order" },
];

/**
 * Chrome for the public marketing site.
 *
 * A signed-in visitor is deliberately **not** redirected away from these
 * pages — they may well have come to read the FAQ. Instead the call to action
 * becomes "Open dashboard", pointing at wherever that account actually
 * belongs.
 */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const memberships = user ? await getMemberships(user.id) : [];

  const appHref =
    memberships.length === 0
      ? null
      : memberships.some((entry) => entry.membership.role === "owner")
        ? "/admin"
        : "/agency";

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: "var(--viz-series-1)" }}
            >
              T
            </span>
            <span className="text-base font-semibold tracking-tight text-ink-900">
              Tracky
            </span>
          </Link>

          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <MarketingNavLink href={item.href}>
                    {item.label}
                  </MarketingNavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {appHref ? (
              <Link
                href={appHref}
                className="inline-flex h-9 items-center rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden text-sm font-medium text-ink-600 hover:text-ink-900 sm:inline"
                >
                  Sign in
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-9 items-center rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
                >
                  Get in touch
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Narrow screens: the same links as a scrolling row. */}
        <nav
          aria-label="Main"
          className="overflow-x-auto border-t border-ink-100 px-4 md:hidden"
        >
          <ul className="flex min-w-max items-center gap-1 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <MarketingNavLink href={item.href}>{item.label}</MarketingNavLink>
              </li>
            ))}
            {appHref ? null : (
              <li>
                <MarketingNavLink href="/login">Sign in</MarketingNavLink>
              </li>
            )}
          </ul>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-sm space-y-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white"
                  style={{ backgroundColor: "var(--viz-series-1)" }}
                >
                  T
                </span>
                <span className="text-sm font-semibold text-ink-900">Tracky</span>
              </div>
              <p className="text-sm text-ink-600">
                Post-purchase tracking and last-mile delivery for Shopify
                merchants who run their own drivers.
              </p>
            </div>

            <nav aria-label="Footer">
              <ul className="space-y-2 text-sm">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-ink-600 hover:text-ink-900"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/login" className="text-ink-600 hover:text-ink-900">
                    Sign in
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <p className="mt-8 border-t border-ink-200 pt-6 text-xs text-ink-500">
            © {new Date().getFullYear()} Tracky. Tracky is an independent
            application and is not affiliated with or endorsed by Shopify.
          </p>
        </div>
      </footer>
    </div>
  );
}
