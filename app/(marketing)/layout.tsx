import type { Metadata } from "next";

import { SiteShell } from "@/components/marketing/site-shell";

/**
 * The public marketing site.
 *
 * The root layout marks everything `noindex` because the whole application is
 * private — backoffice, dispatch, and the customer tracking pages, which are
 * reached from an email rather than a search result. These four pages are the
 * exception, so indexing is turned back on here rather than loosened globally.
 */
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}
