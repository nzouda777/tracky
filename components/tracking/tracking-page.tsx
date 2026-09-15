import type { Order, Store } from "@/lib/db";
import type { LookupAccess, PublicOrderView } from "@/lib/tracking/lookup";
import { formatAddressLines, formatDate, formatMoney } from "@/lib/utils";
import { BrandingStyle, type Branding } from "./branding";
import { EditAddressForm } from "./edit-address-form";
import { EventHistory } from "./event-history";
import { LookupForm, type LookupMode, type LookupStep } from "./lookup-form";
import { RouteLine } from "./route-line";

const SCOPE_ID = "tracky-tracking";

/**
 * The customer-facing tracking page.
 *
 * Rendered on the server behind the Shopify App Proxy, so it is served from
 * the merchant's own domain. Everything on it is either a field mirrored from
 * Shopify or a recorded event — there are no predicted dates, no synthesised
 * "in transit" rows, and no promised update cadence, because none of those
 * would be true. The visual tone follows: a run sheet read down a contained
 * column, not a reassurance panel.
 *
 * The same component serves the hosted page on Tracky's own domain, where an
 * order number alone opens an order. `access` says which of those happened,
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

      <div className="mx-auto w-full max-w-[40rem] px-5 py-9 sm:py-12">
        <header>
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={storeName}
              className="h-9 w-auto object-contain"
            />
          ) : (
            <p
              className="type-display text-h2"
              style={{ color: "var(--brand-accent)" }}
            >
              {storeName}
            </p>
          )}
        </header>

        <main className="mt-9 space-y-9">
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
                  className="type-display"
                  style={{ fontSize: "var(--brand-heading-size)" }}
                >
                  {branding.pageTitle}
                </h1>
                {branding.pageSubtitle ? (
                  <p
                    className="text-body"
                    style={{ color: "var(--brand-muted)" }}
                  >
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
              className="rounded-panel px-4 py-3 text-small"
              style={{
                backgroundColor: "var(--brand-panel)",
                border: "1px solid var(--brand-line)",
              }}
            >
              {branding.helpBannerUrl ? (
                <a
                  href={branding.helpBannerUrl}
                  className="font-medium underline underline-offset-2"
                  style={{ color: "var(--brand-link)" }}
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
          className="mt-12 border-t pt-5 text-caption"
          style={{
            borderColor: "var(--brand-line)",
            color: "var(--brand-muted)",
          }}
        >
          {branding.footerText || `${storeName} — order tracking`}
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
  const { order, stage, timeline, events, proof, canEditAddress } = view;

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
    <div className="space-y-9">
      <section className="space-y-3">
        <h1 className="type-display text-h1">
          Order <span className="type-code">{order.orderNumber}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {stage ? <StatusPill stage={stage} /> : null}
          <p className="text-small" style={{ color: "var(--brand-muted)" }}>
            {unverified
              ? shortenName(order.customerName)
              : (order.customerName ?? "—")}
          </p>
        </div>
      </section>

      {order.cancelledAt ? (
        <div
          className="rounded-panel px-4 py-3 text-small"
          style={{
            border:
              "1px solid color-mix(in srgb, #C4462F 40%, var(--brand-surface))",
            color: "#8F2F1F",
          }}
        >
          <p className="font-semibold">This order was cancelled.</p>
          <p className="mt-0.5">
            Cancelled on {formatDate(order.cancelledAt)}. If you were expecting
            it, reply to your order confirmation and we will look into it.
          </p>
        </div>
      ) : null}

      <RouteLine timeline={timeline} />

      {!settled ? <WaitingIndicator /> : null}

      <EventHistory events={events} proof={proof} />

      <Manifest
        order={order}
        branding={branding}
        unverified={unverified}
        verifyHref={verifyHref}
      />

      {unverified || !canEditAddress ? null : (
        <EditAddressForm
          proxyPath={proxyPath}
          order={order}
          message={addressMessage}
          error={addressError}
        />
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
 * The stage badge: a dot in the stage's own colour beside its name.
 *
 * The whole badge is never filled with that colour. An admin picks stage
 * colours to tell stages apart in the backoffice, and a page of saturated
 * blocks in someone's chosen hue is how a calm page turns loud.
 */
function StatusPill({ stage }: { stage: { name: string; color: string } }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-control px-2.5 py-1 text-caption"
      style={{
        border: "1px solid var(--brand-line)",
        backgroundColor: "var(--brand-panel)",
      }}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: stage.color }}
      />
      {stage.name}
    </span>
  );
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
    <p className="text-small" style={{ color: "var(--brand-muted)" }}>
      This page updates as soon as our delivery team records the next step.
    </p>
  );
}

/**
 * The manifest: the facts of the order, aligned so they can be checked at a
 * glance rather than read as prose. Label left, value right, a rule between
 * each. Real codes are set in mono so the digits line up.
 */
function Manifest({
  order,
  branding,
  unverified,
  verifyHref,
}: {
  order: Order;
  branding: Branding;
  unverified: boolean;
  verifyHref: string;
}) {
  const address = order.shippingAddress;
  const shipTo = unverified
    ? // City and country only: enough to confirm it is going to the right
      // place, not enough to be someone's doorstep.
      [address?.city, address?.country]
        .map((line) => line?.trim())
        .filter((line): line is string => Boolean(line))
    : formatAddressLines(address);

  return (
    <section>
      <h2 className="text-h3 font-semibold">Manifest</h2>

      <dl className="mt-3">
        <Row label="Order no.">
          <span className="type-code">{order.orderNumber}</span>
        </Row>

        <Row label="Placed">{formatDate(order.orderDate)}</Row>

        {branding.showOrderSummary && order.lineItems.length > 0 ? (
          <Row label="Items">
            <ul className="space-y-1">
              {order.lineItems.map((item, index) => (
                <li key={`${item.id ?? item.title}-${index}`}>
                  {item.title}
                  {item.variantTitle ? (
                    <span style={{ color: "var(--brand-muted)" }}>
                      {" "}
                      {item.variantTitle}
                    </span>
                  ) : null}{" "}
                  <span className="type-code">×{item.quantity}</span>
                </li>
              ))}
            </ul>
          </Row>
        ) : null}

        {branding.showOrderSummary ? (
          <Row label="Total">
            <span className="type-code">
              {formatMoney(order.total, order.currency)}
            </span>
          </Row>
        ) : null}

        <Row label="Ship to">
          {shipTo.length > 0 ? (
            <address className="not-italic">
              {shipTo.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              {unverified ? (
                <span className="block" style={{ color: "var(--brand-muted)" }}>
                  ···
                </span>
              ) : null}
            </address>
          ) : (
            <span style={{ color: "var(--brand-muted)" }}>
              No delivery address on file
            </span>
          )}

          {unverified ? (
            <p
              className="mt-1.5 text-caption"
              style={{ color: "var(--brand-muted)" }}
            >
              <a
                href={verifyHref}
                className="font-medium underline underline-offset-2"
                style={{ color: "var(--brand-link)" }}
              >
                Confirm your email address
              </a>{" "}
              to see the full address or change it.
            </p>
          ) : null}
        </Row>
      </dl>
    </section>
  );
}

/** One manifest line: label left, value right, rule beneath. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b py-2.5 text-small last:border-b-0"
      style={{ borderColor: "var(--brand-line)" }}
    >
      <dt className="shrink-0" style={{ color: "var(--brand-muted)" }}>
        {label}
      </dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function Faq({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <section>
      <h2 className="text-h3 font-semibold">Frequently asked questions</h2>
      <div className="mt-3">
        {items.map((item) => (
          <details
            key={item.question}
            className="border-b py-2.5 last:border-b-0"
            style={{ borderColor: "var(--brand-line)" }}
          >
            <summary className="cursor-pointer text-small font-medium">
              {item.question}
            </summary>
            <p
              className="mt-1.5 text-small"
              style={{ color: "var(--brand-muted)" }}
            >
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
