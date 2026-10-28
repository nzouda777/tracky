import Link from "next/link";

import { LEGAL_PAGES, LEGAL_UPDATED, legalDetails } from "@/lib/legal";

/** The frame every legal page shares: title, date, body and sibling links. */
export function LegalPage({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro: React.ReactNode;
  /** This page's path, so it is left out of "See also". */
  current: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <header>
        <p className="text-sm font-medium text-ink-500">Last updated {LEGAL_UPDATED}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          {title}
        </h1>
        <div className="mt-4 text-lg leading-relaxed text-ink-600">{intro}</div>
      </header>

      {children}

      <nav aria-label="Legal" className="mt-14 border-t border-ink-200 pt-6 text-sm text-ink-600">
        See also:{" "}
        {LEGAL_PAGES.filter((page) => page.href !== current).map((page, index) => (
          <span key={page.href}>
            {index > 0 ? " · " : ""}
            <Link href={page.href} className="font-medium text-ink-900 underline underline-offset-2">
              {page.label}
            </Link>
          </span>
        ))}
      </nav>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold tracking-tight text-ink-900">{title}</h2>
      <div className="mt-3 space-y-4 text-base leading-relaxed text-ink-600 [&_a]:font-medium [&_a]:text-ink-900 [&_a]:underline [&_a]:underline-offset-2 [&_li]:mt-2 [&_strong]:text-ink-900 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/** "email us at x" when an address is configured, the contact page otherwise. */
export function ContactLine() {
  const { email, address } = legalDetails();
  return (
    <>
      <p>
        {email ? (
          <>
            Email us at <a href={`mailto:${email}`}>{email}</a>, or use the{" "}
            <Link href="/contact">contact page</Link>.
          </>
        ) : (
          <>
            Use the <Link href="/contact">contact page</Link>.
          </>
        )}
      </p>
      {address ? <p>Post: {address}</p> : null}
    </>
  );
}
