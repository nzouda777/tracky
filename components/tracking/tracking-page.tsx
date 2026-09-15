import type { Order, Store } from "@/lib/db";
import type { LookupAccess, PublicOrderView } from "@/lib/tracking/lookup";
import {
  formatAddressLines,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/utils";
import { BrandingStyle, type Branding } from "./branding";
import { EditAddressForm } from "./edit-address-form";
import { EventHistory } from "./event-history";
import { LookupForm, type LookupMode, type LookupStep } from "./lookup-form";
import { StageTimeline } from "./stage-timeline";

const SCOPE_ID = "tracky-tracking";

/**
 * The customer-facing tracking page.
 *
 * Rendered on the server behind the Shopify App Proxy, so it is served from
 * the merchant's own domain. Everything on it is either a field mirrored from
 * Shopify or a recorded event — there are no predicted dates, no synthesised
 * "in transit" rows, and no promised update cadence, because none of those
 * would be true.
 *
 * The same component also serves the hosted page on Tracky's own domain, where
 * an order number alone opens an order. `access` says which of those happened,
 * and the page renders to that rather than to "a row was found".
 */
export function TrackingPage({
  branding,
  store,
  view,
  proxyPath,
  lookupStep,
  lookupMode = "two-factor",
  access = "verified",
  lookupError,
  addressMessage,
  addressError,
}: {
  branding: Branding;
  store: Pick<Store, "name" | "shopDomain">;
  view: PublicOrderView | null;
  /** Storefront path this page is served from; the form action. */
  proxyPath: string;
  /** Which half of the lookup the visitor is being asked for. */
  lookupStep: LookupStep;
  /** How many details this surface asks for. */
  lookupMode?: LookupMode;
  /** What the visitor proved before the order was opened. */
  access?: LookupAccess;
  lookupError?: string | null;
  addressMessage?: string | null;
  addressError?: string | null;
}) {
  const storeName = store.name ?? store.shopDomain;

  return (
    <div id={SCOPE_ID} className="tracking-root min-h-dvh">
      <BrandingStyle branding={branding} scopeId={SCOPE_ID} />

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={storeName}
              className="h-9 w-auto object-contain"
            />
          ) : (
            <p
              className="text-base font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              {storeName}
            </p>
          )}
        </header>

        <main className="mt-8 space-y-8">
          {view ? (
            <OrderView
              view={view}
              branding={branding}
              proxyPath={proxyPath}
              access={access}
              addressMessage={addressMessage}
              addressError={addressError}
            />
          ) : (
            <>
              <div className="space-y-1.5">
                <h1
                  className="font-bold leading-tight"
                  style={{ fontSize: "var(--brand-heading-size)" }}
                >
                  {branding.pageTitle}
                </h1>
                {branding.pageSubtitle ? (
                  <p className="text-sm" style={{ color: "var(--brand-muted)" }}>
                    {branding.pageSubtitle}
                  </p>
                ) : null}
              </div>
              <LookupForm
                proxyPath={proxyPath}
                state={lookupStep}
                mode={lookupMode}
                error={lookupError}
              />
            </>
          )}

          {branding.faq.length > 0 ? <Faq items={branding.faq} /> : null}

          {branding.helpBannerText ? (
            <aside
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "var(--brand-surface)",
                border: "1px solid var(--brand-border)",
              }}
            >
              {branding.helpBannerUrl ? (
                <a
                  href={branding.helpBannerUrl}
                  className="font-medium underline"
                  style={{ color: "var(--brand-accent)" }}
                >
                  {branding.helpBannerText}
                </a>
              ) : (
                <span>{branding.helpBannerText}</span>
              )}
            </aside>
          ) : null}
        </main>

        <footer
          className="mt-10 border-t pt-5 text-xs"
          style={{
            borderColor: "var(--brand-border)",
            color: "var(--brand-muted)",
          }}
        >
          {branding.footerText || `${storeName} · Order tracking`}
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function OrderView({
  view,
  branding,
  proxyPath,
  access,
  addressMessage,
  addressError,
}: {
  view: PublicOrderView;
  branding: Branding;
  proxyPath: string;
  access: LookupAccess;
  addressMessage?: string | null;
  addressError?: string | null;
}) {
  const { order, timeline, events, proof, canEditAddress } = view;

  /**
   * Opened with a guessable order number and nothing else.
   *
   * Delivery progress is still shown in full — that is what the visitor came
   * for, and it is the same information the shop puts in its emails. What is
   * held back is everything that would make walking `#1001`, `#1002`, `#1003`
   * worth someone's time: the full name, the street address, and the
   * address-change form, which carries the order's token in a hidden field and
   * would therefore hand over write access along with it.
   */
  const unverified = access === "order-number";
  const verifyHref = `${proxyPath}?verify=1&q=${encodeURIComponent(order.orderNumber)}`;

  const reachedEnd = timeline.some(
    (entry) => entry.state === "current" && entry.stage.isTerminal,
  );
  const settled = Boolean(proof) || reachedEnd || Boolean(order.cancelledAt);

  return (
    <div className="space-y-8">
      {/* Two columns of identity: who, and which order. */}
      <section className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--brand-muted)" }}
          >
            Customer
          </p>
          <p className="mt-0.5 text-xl font-bold leading-tight">
            {unverified
              ? shortenName(order.customerName)
              : (order.customerName ?? "—")}
          </p>
        </div>

        <div className="text-right">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--brand-muted)" }}
          >
            Order
          </p>
          <p className="mt-0.5 text-xl font-bold leading-tight">
            {order.orderNumber}
          </p>
        </div>
      </section>

      {order.cancelledAt ? (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
        >
          <p className="font-semibold">This order was cancelled.</p>
          <p className="mt-0.5">
            Cancelled on {formatDate(order.cancelledAt)}. If you were expecting
            it, reply to your order confirmation and we will look into it.
          </p>
        </div>
      ) : null}

      <StageTimeline timeline={timeline} />

      {!settled ? <WaitingIndicator /> : null}

      <EventHistory
        events={events}
        deliveredNote={
          proof
            ? `Delivered ${formatDateTime(proof.deliveredAt)}${
                proof.recipientName ? `, signed for by ${proof.recipientName}` : ""
              }.`
            : null
        }
      />

      {branding.showOrderSummary ? <OrderRecap order={order} /> : null}

      {unverified ? (
        <ShippingAddressBlock order={order} verifyHref={verifyHref} />
      ) : canEditAddress ? (
        <EditAddressForm
          proxyPath={proxyPath}
          order={order}
          message={addressMessage}
          error={addressError}
        />
      ) : (
        <ShippingAddressBlock order={order} locked />
      )}
    </div>
  );
}

/**
 * "Sarah Jenkins" -> "Sarah J."
 *
 * Enough for the customer to recognise their own order at a glance, not enough
 * to be worth harvesting.
 */
function shortenName(name: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Shown while an order is still moving.
 *
 * Deliberately promises no cadence. A carrier page can say "updated every 12
 * to 48 hours" because a scan pipeline runs on a schedule; here the next line
 * appears when the delivery team records it, which might be in ten minutes or
 * tomorrow. Saying otherwise would be inventing a commitment on their behalf.
 */
function WaitingIndicator() {
  return (
    <div className="flex flex-col items-center gap-1 py-1 text-center">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "var(--brand-muted)", opacity: 0.7 }}
        />
        <span className="text-sm font-medium">Waiting for the next update</span>
      </span>
      <p className="text-xs" style={{ color: "var(--brand-muted)" }}>
        This page updates as soon as our delivery team reports progress.
      </p>
    </div>
  );
}

function OrderRecap({ order }: { order: Order }) {
  return (
    <section
      className="rounded-xl p-5"
      style={{ border: "1px solid var(--brand-border)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Order summary</h2>
        <span className="text-xs" style={{ color: "var(--brand-muted)" }}>
          Placed {formatDate(order.orderDate)}
        </span>
      </div>

      <ul className="mt-3 space-y-2.5">
        {order.lineItems.length === 0 ? (
          <li className="text-sm" style={{ color: "var(--brand-muted)" }}>
            No items recorded for this order.
          </li>
        ) : (
          order.lineItems.map((item, index) => (
            <li
              key={`${item.id ?? item.title}-${index}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                {item.variantTitle ? (
                  <p style={{ color: "var(--brand-muted)" }}>
                    {item.variantTitle}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p>× {item.quantity}</p>
                {item.price ? (
                  <p style={{ color: "var(--brand-muted)" }}>
                    {formatMoney(item.price, order.currency)}
                  </p>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      <div
        className="mt-4 flex items-center justify-between border-t pt-3 text-sm font-semibold"
        style={{ borderColor: "var(--brand-border)" }}
      >
        <span>Total</span>
        <span>{formatMoney(order.total, order.currency)}</span>
      </div>
    </section>
  );
}

function ShippingAddressBlock({
  order,
  locked,
  verifyHref,
}: {
  order: Order;
  locked?: boolean;
  /**
   * Set when the order was opened with its number alone. The street address is
   * hidden and this links to the form that asks for the email on the order.
   */
  verifyHref?: string;
}) {
  const address = order.shippingAddress;
  const lines = verifyHref
    ? // City and country only: enough to confirm it is going to the right
      // place, not enough to be someone's doorstep.
      [address?.city, address?.country]
        .map((line) => line?.trim())
        .filter((line): line is string => Boolean(line))
    : formatAddressLines(address);

  return (
    <section
      className="rounded-xl p-5"
      style={{ border: "1px solid var(--brand-border)" }}
    >
      <h2 className="text-sm font-semibold">Delivery address</h2>
      {lines.length > 0 ? (
        <address className="mt-2 text-sm not-italic leading-relaxed">
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          {verifyHref ? (
            <span className="block" style={{ color: "var(--brand-muted)" }}>
              ···
            </span>
          ) : null}
        </address>
      ) : (
        <p className="mt-2 text-sm" style={{ color: "var(--brand-muted)" }}>
          No delivery address on file.
        </p>
      )}

      {verifyHref ? (
        <p className="mt-3 text-xs" style={{ color: "var(--brand-muted)" }}>
          <a
            href={verifyHref}
            className="font-medium underline"
            style={{ color: "var(--brand-accent)" }}
          >
            Confirm your email address
          </a>{" "}
          to see the full address or change it.
        </p>
      ) : null}

      {locked ? (
        <p className="mt-3 text-xs" style={{ color: "var(--brand-muted)" }}>
          This address can no longer be changed because your order is already on
          its way. Contact us if something is wrong.
        </p>
      ) : null}
    </section>
  );
}

function Faq({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <section
      className="rounded-xl p-5"
      style={{ border: "1px solid var(--brand-border)" }}
    >
      <h2 className="text-sm font-semibold">Frequently asked questions</h2>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <details
            key={item.question}
            className="rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--brand-surface)" }}
          >
            <summary className="cursor-pointer text-sm font-medium">
              {item.question}
            </summary>
            <p className="mt-1.5 text-sm" style={{ color: "var(--brand-muted)" }}>
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
