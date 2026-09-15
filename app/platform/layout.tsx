import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { PlatformNavLink } from "@/components/platform/platform-nav-link";
import { requirePlatformAdmin } from "@/lib/auth/platform";

const NAV = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/stores", label: "Stores" },
  { href: "/platform/users", label: "Accounts" },
  { href: "/platform/health", label: "System health" },
  { href: "/platform/audit", label: "Audit log" },
];

/**
 * Platform operator area.
 *
 * Visually distinct from the store backoffice on purpose — a dark bar, an
 * explicit badge — so an operator is never in any doubt about whether they are
 * looking at one store or at every store at once.
 */
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 404s for anyone who is not a platform operator.
  const session = await requirePlatformAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <header className="sticky top-0 z-20 bg-ink-900 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/platform" className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-md bg-white text-[11px] font-bold text-ink-900"
            >
              T
            </span>
            <span className="text-sm font-semibold">Tracky</span>
          </Link>

          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
            Platform
          </span>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-xs text-white/60 sm:inline">
              {session.user.email} · via {session.grantedBy}
            </span>
            <Link
              href="/admin"
              className="text-xs font-medium text-white/80 underline underline-offset-2 hover:text-white"
            >
              Back to store
            </Link>
            <SignOutButton />
          </div>
        </div>

        <nav
          aria-label="Platform sections"
          className="mx-auto w-full max-w-7xl overflow-x-auto px-4"
        >
          <ul className="flex min-w-max items-center gap-1 pb-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <PlatformNavLink href={item.href}>{item.label}</PlatformNavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-ink-200 px-4 py-4 text-center text-xs text-ink-400">
        Platform view — every action you take here is recorded in the audit log.
        A store&rsquo;s own settings are changed from its backoffice, not here.
      </footer>
    </div>
  );
}
