import type { Order, Store } from "@/lib/db";
import type { LookupAccess, PublicOrderView } from "@/lib/tracking/lookup";
import {
  formatAddressLines,
  formatCodeAmount,
  formatDate,
  formatLongDate,
} from "@/lib/utils";
import { BrandingStyle, type Branding } from "./branding";
import { EditAddressForm } from "./edit-address-form";
import { EventHistory } from "./event-history";
import { LookupForm, type LookupMode, type LookupStep } from "./lookup-form";
import { getPageDesign } from "@/lib/tracking/page-designs";
import { DesignedLayout, type OrderParts } from "./layouts";
import { RouteLine } from "./route-line";
import { buildPhaseTimeline } from "@/lib/orders/stages";

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
  const design = getPageDesign(branding.pageDesign);

  // A design with its own skeleton gets the same pieces — the form, the route,
  // the manifest — and arranges them itself. Every rule about what may be
  // shown (an unverified visitor, a locked address) lives in those pieces, so
  // no layout can show more than the column does.
  if (design.layout !== "column") {
    return (
      <div
        id={SCOPE_ID}
        className="tracking-root min-h-dvh"
        data-design={design.id}
        data-layout={design.layout}
        style={{ backgroundColor: "var(--brand-surface)" }}
      >
        <BrandingStyle branding={branding} scopeId={SCOPE_ID} />
        <DesignedLayout
          layout={design.layout}
          storeName={storeName}
          brand={{
            show: branding.showStoreName,
            logoUrl: branding.logoUrl?.trim() || null,
          }}
          masthead={<Masthead branding={branding} storeName={storeName} />}
          title={branding.pageTitle}
          subtitle={<Subtitle text={branding.pageSubtitle} />}
          lookup={
            view ? null : (
              <LookupForm
                branding={branding}
                proxyPath={proxyPath}
                state={lookupStep}
                mode={lookupMode}
                error={lookupError}
              />
            )
          }
          order={
            view
              ? orderParts({
                  view,
                  branding,
                  storeName,
                  proxyPath,
                  access,
                  addressMessage,
                  addressError,
                })
              : null
          }
          extras={<Extras branding={branding} />}
          footer={<PageFooter branding={branding} storeName={storeName} />}
        />
      </div>
    );
  }

  return (
    <div
      id={SCOPE_ID}
      className="tracking-root min-h-dvh"
      data-design={design.id}
      style={{ backgroundColor: "var(--brand-surface)" }}
    >
      <BrandingStyle branding={branding} scopeId={SCOPE_ID} />

      {/* The title block sits on the page's own ground. */}
      <Column className="pt-9 sm:pt-12">
        <Masthead branding={branding} storeName={storeName} />

        {view ? null : (
          <div className="space-y-3" data-part="intro">
            <h1
              className="type-display"
              style={{
                fontSize: "var(--brand-heading-size)",
                lineHeight: 1.12,
              }}
            >
              {branding.pageTitle}
            </h1>
            <Subtitle text={branding.pageSubtitle} />
          </div>
        )}
      </Column>

      {/* The form gets a band of its own, spanning the full width of the
          block rather than the text column — which is what makes it read as a
          second section of the shop instead of a box inside the first. It is
          a direct child of the root for exactly that reason: nested in the
          column it could only ever be as wide as the paragraph above it. */}
      {view ? null : (
        <div
          data-part="band"
          className="mt-9 py-9 sm:py-12"
          style={{ backgroundColor: "var(--brand-section)" }}
        >
          <Column>
            <LookupForm
              branding={branding}
              proxyPath={proxyPath}
              state={lookupStep}
              mode={lookupMode}
              error={lookupError}
            />
          </Column>
        </div>
      )}

      <Column className={view ? "pb-12" : "pt-9 pb-12"}>
        {view ? (
          <main className="space-y-9">
            <OrderView
              view={view}
              branding={branding}
              storeName={storeName}
              proxyPath={proxyPath}
              access={access}
              addressMessage={addressMessage}
              addressError={addressError}
            />
          </main>
        ) : null}

        <Extras branding={branding} />

        <PageFooter branding={branding} storeName={storeName} />
      </Column>
    </div>
  );
}

/**
 * The text column: one measure and one alignment, shared by every block so
 * they line up down the page whatever width the store chose.
 */
function Column({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mx-auto w-full px-5 ${className ?? ""}`}
      style={{
        maxWidth: "var(--brand-width)",
        textAlign: "var(--brand-align)" as "left" | "center",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

type OrderInput = {
  view: PublicOrderView;
  branding: Branding;
  storeName: string;
  proxyPath: string;
  access: LookupAccess;
  addressMessage?: string | null;
  addressError?: string | null;
};

/**
 * The order's pieces, built once and shared by every layout.
 *
 * Opened with a guessable order number and nothing else (`unverified`),
 * delivery progress is still shown in full — that is what the visitor came
 * for, and it is the same information the shop puts in its emails. What is
 * held back is everything that would make walking `#1001`, `#1002`, `#1003`
 * worth someone's time: the full name, the street address, and the
 * address-change form, which carries the order's token in a hidden field and
 * would therefore hand over write access along with it.
 */
function orderParts({
  view,
  branding,
  storeName,
  proxyPath,
  access,
  addressMessage,
  addressError,
}: OrderInput): OrderParts {
  const { order, stage, timeline, events, proof, canEditAddress } = view;

  const unverified = access === "order-number";
  const verifyHref = `${proxyPath}?verify=1&q=${encodeURIComponent(order.orderNumber)}`;

  const reachedEnd = timeline.some(
    (entry) => entry.state === "current" && entry.stage.isTerminal,
  );
  const settled = Boolean(proof) || reachedEnd || Boolean(order.cancelledAt);

  // The bar shows the four phases, not the store's full stage list — that can
  // run to dozens of steps, which the event history lists one by one.
  const phases = buildPhaseTimeline(
    timeline.map((entry) => entry.stage),
    order.currentStageId,
  );
  const currentIndex = phases.findIndex((entry) => entry.state === "current");

  return {
    orderNumber: order.orderNumber,
    customer: unverified
      ? shortenName(order.customerName)
      : order.customerName?.trim() || "—",
    stageName: stage?.name ?? null,
    placed: formatDate(order.orderDate),
    // City only, whatever the access: the manifest shows as much to an
    // unverified visitor, so a layout quoting it reveals nothing new.
    city: order.shippingAddress?.city?.trim() || null,
    timeline: phases,
    currentIndex,
    delivered: reachedEnd,
    cancelled: Boolean(order.cancelledAt),
    pill: stage ? <StatusPill stage={stage} /> : null,
    cancelledNotice: order.cancelledAt ? (
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
    ) : null,
    route: <RouteLine timeline={phases} />,
    waiting: settled ? null : <WaitingIndicator />,
    events: <EventHistory events={events} proof={proof} />,
    manifest: (
      <Manifest
        order={order}
        branding={branding}
        storeName={storeName}
        unverified={unverified}
        verifyHref={verifyHref}
        canEditAddress={!unverified && canEditAddress}
      />
    ),
    editAddress:
      unverified || !canEditAddress ? null : (
        <EditAddressForm
          proxyPath={proxyPath}
          order={order}
          message={addressMessage}
          error={addressError}
        />
      ),
  };
}

function OrderView(input: OrderInput) {
  const parts = orderParts(input);

  return (
    <div className="space-y-9">
      <section
        data-part="order-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          textAlign: "left",
        }}
      >
        <MetaItem label="Customer">{parts.customer}</MetaItem>
        <MetaItem label="Order" align="right">
          <h1 style={{ font: "inherit", margin: 0 }}>
            <span className="type-code">{parts.orderNumber}</span>
          </h1>
        </MetaItem>
      </section>

      {parts.cancelledNotice}
      <div>
        {parts.route}
        {parts.waiting ? <div style={{ marginTop: 28 }}>{parts.waiting}</div> : null}
      </div>
      {parts.events}
      {parts.manifest}
      {parts.editAddress}
    </div>
  );
}

/** A small uppercase label over a bold value, as on a carrier waybill. */
function MetaItem({
  label,
  align = "left",
  children,
}: {
  label: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 0, textAlign: align }}>
      <p
        style={{
          margin: "0 0 2px",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--brand-muted)",
        }}
      >
        {label}
      </p>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{children}</div>
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
      data-part="pill"
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
    <div
      data-part="waiting"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        textAlign: "center",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <svg
          aria-hidden
          className="waypoint-pulse"
          width="12"
          height="12"
          viewBox="0 0 14 14"
          fill="none"
        >
          <circle cx="7" cy="7" r="5.5" stroke="var(--brand-line)" strokeWidth="1.8" />
          <path
            d="M7 1.5A5.5 5.5 0 0 1 12.5 7"
            stroke="var(--brand-text)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          Waiting for new updates
        </span>
      </span>
      <p style={{ margin: 0, fontSize: 12, color: "var(--brand-muted)" }}>
        This page updates as soon as our delivery team records the next step.
      </p>
    </div>
  );
}

/**
 * The order summary: an "ORDER" heading with the address action beside it,
 * then label-left, value-right rows on hairlines, ending on the total paid.
 *
 * Styled inline throughout: inside a merchant's theme the embed reset zeroes
 * every margin and padding, and only inline styles are sure to survive it.
 */
function Manifest({
  order,
  branding,
  storeName,
  unverified,
  verifyHref,
  canEditAddress,
}: {
  order: Order;
  branding: Branding;
  storeName: string;
  unverified: boolean;
  verifyHref: string;
  canEditAddress: boolean;
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
    <section data-part="manifest">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          paddingBottom: 14,
          borderBottom: "1.5px solid var(--brand-line)",
        }}
      >
        <h2
          data-part="section-title"
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.14em",
            lineHeight: "20px",
            textTransform: "uppercase",
            color: "var(--brand-muted)",
          }}
        >
          Order
        </h2>
        {canEditAddress ? (
          <a
            href="#edit-address"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 16,
              fontWeight: 600,
              lineHeight: "20px",
              color: "var(--brand-link)",
              textDecoration: "none",
            }}
          >
            <svg
              aria-hidden
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            Edit address
          </a>
        ) : null}
      </div>

      <dl style={{ margin: "8px 0 0", textAlign: "left" }}>
        <Row label="Ship to">
          {shipTo.length > 0 ? (
            <address style={{ fontStyle: "normal" }}>
              {shipTo.join(", ")}
              {unverified ? " ···" : ""}
            </address>
          ) : (
            <span style={{ color: "var(--brand-muted)", fontWeight: 400 }}>
              No delivery address on file
            </span>
          )}

          {unverified ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                fontWeight: 400,
                lineHeight: "18px",
                color: "var(--brand-muted)",
              }}
            >
              <a
                href={verifyHref}
                style={{
                  color: "var(--brand-link)",
                  fontWeight: 600,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                Confirm your email address
              </a>{" "}
              to see the full address or change it.
            </p>
          ) : null}
        </Row>

        <Row label="Order number">{order.orderNumber}</Row>
        <Row label="Order date">{formatLongDate(order.orderDate)}</Row>
        <Row label="Store">{storeName}</Row>

        {branding.showOrderSummary && order.lineItems.length > 0 ? (
          <Row label="Items">
            {order.lineItems.map((item, index) => (
              <span
                key={`${item.id ?? item.title}-${index}`}
                style={{ display: "block" }}
              >
                {item.title}
                {item.variantTitle ? (
                  <span style={{ color: "var(--brand-muted)", fontWeight: 400 }}>
                    {" "}
                    {item.variantTitle}
                  </span>
                ) : null}{" "}
                ×{item.quantity}
              </span>
            ))}
          </Row>
        ) : null}

        {branding.showOrderSummary ? (
          <Row label="Total paid" emphasis>
            {formatCodeAmount(order.total, order.currency) || "—"}
          </Row>
        ) : null}
      </dl>
    </section>
  );
}

/**
 * One summary line: the label at the left edge, the value at the right, a
 * hairline beneath. The label keeps a narrow measure so a long value (the
 * address) takes the room and the label wraps instead.
 */
function Row({
  label,
  emphasis = false,
  children,
}: {
  label: string;
  /** The closing "Total paid" line: bold label, larger value, no rule. */
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-part="manifest-row"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        padding: "13px 0",
        borderBottom: emphasis ? "none" : "1px solid var(--brand-line)",
      }}
    >
      <dt
        style={{
          flex: "0 1 auto",
          minWidth: 0,
          maxWidth: "45%",
          fontSize: emphasis ? 17 : 16,
          fontWeight: emphasis ? 700 : 400,
          lineHeight: "25px",
          color: emphasis ? "var(--brand-text)" : "var(--brand-muted)",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          margin: 0,
          fontSize: emphasis ? 18 : 16,
          fontWeight: emphasis ? 700 : 600,
          lineHeight: "25px",
          textAlign: "right",
          overflowWrap: "anywhere",
          color: "var(--brand-text)",
        }}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * Questions as separate rounded cards, each with a chevron that turns when it
 * opens. A plain `<details>`, so it works without any JavaScript.
 */
function Faq({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <section data-part="faq" style={{ textAlign: "left" }}>
      {/* Turns the chevron of an open question. Scoped to this block. */}
      <style>{`[data-part="faq"] details[open] > summary [data-part="faq-chevron"]{transform:rotate(180deg)}[data-part="faq"] summary::-webkit-details-marker{display:none}`}</style>

      <h2
        data-part="section-title"
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: "32px",
          color: "var(--brand-text)",
        }}
      >
        Frequently Asked Questions
      </h2>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {items.map((item) => (
          <details
            key={item.question}
            style={{
              border: "1.5px solid var(--brand-line)",
              borderRadius: 16,
              backgroundColor: "var(--brand-surface)",
              textAlign: "left",
            }}
          >
            <summary
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                padding: "18px 22px",
                listStyle: "none",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 600,
                lineHeight: "26px",
                color: "var(--brand-text)",
              }}
            >
              <span style={{ minWidth: 0 }}>{item.question}</span>
              <svg
                data-part="faq-chevron"
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  display: "block",
                  flexShrink: 0,
                  color: "var(--brand-muted)",
                  transition: "transform 0.2s ease",
                }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p
              style={{
                margin: 0,
                padding: "0 22px 20px",
                fontSize: 15,
                lineHeight: "24px",
                color: "var(--brand-muted)",
              }}
            >
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared blocks — used by the column and by every designed layout
// ---------------------------------------------------------------------------

function Masthead({
  branding,
  storeName,
}: {
  branding: Branding;
  storeName: string;
}) {
  return (
    <>
      {/* Off by default. Embedded in a theme, the merchant's own header is
          directly above this, and repeating the brand is the clearest sign
          of an app bolted onto a shop rather than part of it. */}
      {branding.showStoreName ? (
        <header className="mb-9" data-part="masthead">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={storeName}
              className="h-9 w-auto object-contain"
              style={{ marginInline: "var(--brand-inline)" }}
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
      ) : null}
    </>
  );
}

function Subtitle({ text }: { text: string }) {
  return (
    <>
      {text ? (
        <div
          data-part="subtitle"
          className="mx-auto space-y-1 text-body"
          style={{
            color: "var(--brand-muted)",
            maxWidth: "736px",
            // Follows the page instead of centring itself, which put the
            // intro 180px right of the heading above it.
            marginInline: "var(--brand-inline)",
          }}
        >
          {/* Written as lines, so a store can say the three things this
              page usually has to say without them running into one
              paragraph. */}
          {text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => (
              <p key={index}>{line}</p>
            ))}
        </div>
      ) : null}
    </>
  );
}

function Extras({ branding }: { branding: Branding }) {
  return (
    <div className="space-y-9">
      {branding.faq.length > 0 ? <Faq items={branding.faq} /> : null}

      {branding.helpBannerText ? (
        <aside
          data-part="help"
          className="px-4 py-3 text-small"
          style={{
            backgroundColor: "var(--brand-panel)",
            border: "1px solid var(--brand-line)",
            borderRadius: "var(--brand-card-radius)",
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
    </div>
  );
}

function PageFooter({
  branding,
  storeName,
}: {
  branding: Branding;
  storeName: string;
}) {
  return (
    <footer
      data-part="footer"
      className="mt-12 border-t pt-5 text-caption"
      style={{
        borderColor: "var(--brand-line)",
        color: "var(--brand-muted)",
      }}
    >
      {branding.footerText || `${storeName} — order tracking`}
    </footer>
  );
}
