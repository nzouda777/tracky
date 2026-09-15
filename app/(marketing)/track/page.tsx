import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";

import { Alert } from "@/components/ui";
import { db, stores } from "@/lib/db";
import { normalizeShopDomain } from "@/lib/shopify/hmac";
import { parseShopInput } from "@/lib/shopify/parse-shop";

export const metadata: Metadata = {
  title: "Track your order",
  description:
    "Find the tracking page for the shop you ordered from, and follow your delivery.",
};

/**
 * The public way in to order tracking.
 *
 * Tracky is multi-tenant, so "track my order" cannot go straight to a
 * timeline — it has to know *which shop*. This page asks that one question and
 * forwards to that shop's tracking page.
 *
 * It deliberately does not list the connected stores. Which merchants use
 * Tracky is their business, not a public directory, so this only ever confirms
 * a shop the visitor already named — and a shop that is not here gets the same
 * answer whether it never existed or simply is not a customer.
 */
export default async function TrackEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; notfound?: string }>;
}) {
  const { shop, notfound } = await searchParams;

  if (shop?.trim()) {
    const resolved = await resolveStore(shop);
    if (resolved) redirect(`/track/${resolved}`);
    redirect(`/track?notfound=${encodeURIComponent(shop.trim().slice(0, 80))}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
        Track your order
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-600">
        Tracky powers the tracking page for a number of shops. Tell us which one
        you ordered from and we will take you there.
      </p>

      <div className="mt-8 rounded-xl border border-ink-200 bg-ink-50 p-5 sm:p-6">
        {notfound ? (
          <Alert tone="warning" title="We could not find that shop" className="mb-5">
            Nothing matched <strong>{notfound}</strong>. Check the spelling, or
            use the tracking link in your order confirmation email — it goes
            straight to your order.
          </Alert>
        ) : null}

        <form method="get" className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="shop" className="block text-sm font-medium text-ink-800">
              The shop you ordered from
            </label>
            <input
              id="shop"
              name="shop"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="northside-supply.com"
              className="h-12 w-full rounded-lg border border-ink-300 bg-white px-3.5 text-base text-ink-900 placeholder:text-ink-400"
            />
            <p className="text-xs text-ink-500">
              Its website address, or its <code>.myshopify.com</code> name —
              either works.
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-ink-900 px-6 text-base font-semibold text-white transition-colors hover:bg-ink-800"
          >
            Continue
          </button>
        </form>
      </div>

      <section className="mt-10 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            The quickest way in
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Every email the shop sends you carries a personal tracking link.
            Opening that link goes straight to your order, with nothing to type.
            Search your inbox for the order confirmation.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-ink-900">
            All you need is your order number
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            On the shop&rsquo;s tracking page, type the order number from your
            confirmation email and you will see where your delivery has got to.
            Your delivery address stays hidden until you confirm the email
            address on the order — that one extra step is also what lets you
            change the address, and it is what stops a stranger reading yours.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Something wrong with your delivery?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Reply to your order confirmation and the shop will pick it up. We
            make the software behind the tracking page — the shop can see far
            more than we can, and can actually do something about it.
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * Finds a connected store from whatever the visitor typed.
 *
 * Matches on the myshopify handle and on the customer-facing domain, because
 * a shopper knows `northside-supply.com`, not `northside-supply.myshopify.com`.
 * Returns the canonical shop domain, which is what `/track/[shop]` expects.
 */
async function resolveStore(input: string): Promise<string | null> {
  const typed = input.trim().toLowerCase();

  // Strip a scheme, a path and any www., so a pasted URL works.
  const host = typed
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .trim();

  if (!host) return null;

  const candidates = new Set<string>([host]);

  // `parseShopInput` also handles an admin URL or a bare handle.
  const parsed = parseShopInput(input);
  if (parsed.ok) candidates.add(parsed.shopDomain);

  for (const candidate of candidates) {
    const [row] = await db
      .select({ shopDomain: stores.shopDomain, status: stores.status })
      .from(stores)
      .where(
        or(
          eq(stores.shopDomain, normalizeShopDomain(candidate)),
          eq(stores.primaryDomain, candidate),
        ),
      )
      .limit(1);

    // An uninstalled store is treated as not found: its tracking page would
    // not work anyway, and saying so would leak that it was once a customer.
    if (row?.status === "active") return row.shopDomain;
  }

  return null;
}
