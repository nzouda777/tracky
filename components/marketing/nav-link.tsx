"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Marketing nav item, marked current for styling and for screen readers. */
export function MarketingNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-ink-100 text-ink-900"
          : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
      )}
    >
      {children}
    </Link>
  );
}
