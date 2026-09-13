"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Nav item for the dark platform bar. */
export function PlatformNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    href === "/platform"
      ? pathname === "/platform"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-white text-ink-900"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
