import type { ReactNode } from "react";

import type { TimelineEntry } from "@/lib/orders/stages";
import type { PageLayout } from "@/lib/tracking/page-designs";
import { monogramOf } from "@/lib/utils";

/**
 * The tracking page's alternative skeletons.
 *
 * `TrackingPage` builds every piece once — the lookup form, the route, the
 * event history, the manifest, the address form — and these layouts only
 * decide where each piece goes and what frames it. They never reach into the
 * order themselves beyond the facts `OrderParts` already exposes, so the
 * privacy rules for an unverified visitor hold in every design.
 *
 * Markup here carries `data-part` hooks and inline styles only, no utility
 * classes beyond the type scale: the page is also served inside a Shopify
 * theme, where only the classes `embed-styles.ts` defines exist. Responsive
 * behaviour lives in the design's CSS layer (`lib/tracking/page-designs`).
 */

export type OrderParts = {
  orderNumber: string;
  customer: string;
  stageName: string | null;
  placed: string;
  city: string | null;
  timeline: TimelineEntry[];
  /** Index of the current step in `timeline`, or -1. */
  currentIndex: number;
  delivered: boolean;
  cancelled: boolean;

  pill: ReactNode;
  cancelledNotice: ReactNode;
  route: ReactNode;
  waiting: ReactNode;
  events: ReactNode;
  manifest: ReactNode;
  editAddress: ReactNode;
};

type LayoutProps = {
  storeName: string;
  /**
   * Whether the store's name or logo may appear. Off by default: embedded in
   * a theme, the merchant's own header is right above the page. Layouts that
   * draw their own brand mark (a wordmark, a bar, a monogram) honour it too.
   */
  brand: { show: boolean; logoUrl: string | null };
  masthead: ReactNode;
  title: string;
  subtitle: ReactNode;
  lookup: ReactNode | null;
  order: OrderParts | null;
  extras: ReactNode;
  footer: ReactNode;
};

/**
 * One component per skeleton. A `Record` rather than a chain of `if`s, so a
 * layout added to a design without a component here fails to compile instead
 * of quietly rendering as some other design.
 */
const LAYOUTS: Record<Exclude<PageLayout, "column">, (props: LayoutProps) => ReactNode> = {
  split: SplitLayout,
  ticket: TicketLayout,
  journey: JourneyLayout,
  atelier: AtelierLayout,
  beaute: BeauteLayout,
  maison: MaisonLayout,
};

export function DesignedLayout({
  layout,
  ...props
}: LayoutProps & { layout: Exclude<PageLayout, "column"> }) {
  const Layout = LAYOUTS[layout];
  return <Layout {...props} />;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const stack = (gap: number) => ({
  display: "flex",
  flexDirection: "column" as const,
  gap,
});

const eyebrow = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "var(--brand-muted)",
};

/** "Step 2 of 5" — a count of recorded stages, never a prediction. */
function stepLabel(order: OrderParts): string | null {
  if (order.cancelled) return "Cancelled";
  if (order.delivered) return "Delivered";
  if (order.currentIndex < 0) return null;
  return `Step ${order.currentIndex + 1} of ${order.timeline.length}`;
}

/**
 * The status as a headline. A cancelled order keeps the stage it was at when
 * it was cancelled, and setting that stage large would say the order is still
 * moving — the cancellation notice further down would then contradict it.
 */
function headlineOf(order: OrderParts): string {
  if (order.cancelled) return "Order cancelled";
  return order.stageName ?? "Order received";
}

/** The store's logo, sized by the layout that places it. */
function Logo({
  src,
  alt,
  height,
}: {
  src: string;
  alt: string;
  height: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={{ display: "inline-block", height, width: "auto", objectFit: "contain" }}
    />
  );
}

/** One segment per stage, filled up to and including the current one. */
function Progress({ order }: { order: OrderParts }) {
  // A cancelled order is going nowhere; a part-filled bar would say otherwise.
  if (order.cancelled) return null;
  if (order.currentIndex < 0 || order.timeline.length === 0) return null;
  return (
    <div data-part="progress" aria-hidden>
      {order.timeline.map((entry, index) => (
        <span
          key={entry.stage.id}
          {...(index <= order.currentIndex ? { "data-on": "" } : {})}
        />
      ))}
    </div>
  );
}

function Contained({
  width = 720,
  children,
}: {
  width?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        maxWidth: width,
        margin: "0 auto",
        padding: "40px 20px 48px",
        ...stack(36),
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Showroom — a brand panel beside the details
// ---------------------------------------------------------------------------

function SplitLayout({
  masthead,
  title,
  subtitle,
  lookup,
  order,
  extras,
  footer,
}: LayoutProps) {
  return (
    <div data-part="split" style={{ textAlign: "left" }}>
      <aside data-part="split-panel">
        <div data-part="split-inner" style={stack(18)}>
          {masthead}
          {order ? (
            <>
              <p style={eyebrow}>
                Order <span className="type-code">{order.orderNumber}</span>
              </p>
              <h1 className="type-display" data-part="split-title">
                {headlineOf(order)}
              </h1>
              <p className="text-body" style={{ color: "var(--brand-muted)" }}>
                {order.customer}
              </p>
              <div>
                {stepLabel(order) ? (
                  <p className="text-caption">{stepLabel(order)}</p>
                ) : null}
                <Progress order={order} />
              </div>
            </>
          ) : (
            <>
              <p style={eyebrow}>Order tracking</p>
              <h1 className="type-display" data-part="split-title">
                {title}
              </h1>
              {subtitle}
            </>
          )}
        </div>
      </aside>

      <main data-part="split-main" style={stack(36)}>
        {order ? (
          <>
            {order.cancelledNotice}
            {order.route}
            {order.waiting}
            {order.events}
            {order.manifest}
            {order.editAddress}
          </>
        ) : (
          lookup
        )}
        {extras}
        {footer}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boarding pass — the order as a ticket
// ---------------------------------------------------------------------------

function Notches() {
  return (
    <>
      <span data-part="ticket-notch" style={{ left: -14 }} />
      <span data-part="ticket-notch" style={{ right: -14 }} />
    </>
  );
}

function Plane() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="var(--brand-accent)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d="M3 12h15" />
      <path d="m14 7 5 5-5 5" />
      <circle cx="3" cy="12" r="1.5" fill="var(--brand-accent)" />
    </svg>
  );
}

function TicketLayout({
  storeName,
  brand,
  masthead,
  title,
  subtitle,
  lookup,
  order,
  extras,
  footer,
}: LayoutProps) {
  if (!order) {
    return (
      <Contained width={600}>
        <div style={{ ...stack(12), textAlign: "center" }}>
          {masthead}
          <h1
            className="type-display"
            style={{ fontSize: "var(--brand-heading-size)", lineHeight: 1.08 }}
          >
            {title}
          </h1>
          {subtitle}
        </div>
        <div data-part="ticket">
          <div data-part="ticket-head">
            <span>{brand.show ? storeName : "Boarding pass"}</span>
            <span>Order tracking</span>
          </div>
          {lookup}
        </div>
        <div style={{ textAlign: "left", ...stack(36) }}>
          {extras}
          {footer}
        </div>
      </Contained>
    );
  }

  return (
    <Contained width={680}>
      {masthead}
      <section data-part="ticket" aria-label={`Order ${order.orderNumber}`}>
        <div data-part="ticket-head">
          <span>{brand.show ? storeName : `Order ${order.orderNumber}`}</span>
          <span>Boarding pass</span>
        </div>

        <div data-part="ticket-body">
          <div data-part="ticket-route">
            <div>
              <span data-part="ticket-label">Ordered</span>
              <span data-part="ticket-value">{order.placed}</span>
            </div>
            <Plane />
            <div>
              <span data-part="ticket-label">Destination</span>
              <span data-part="ticket-value">{order.city ?? "—"}</span>
            </div>
          </div>

          <div data-part="ticket-status">
            <span data-part="ticket-label">Status</span>
            <h1
              className="type-display"
              style={{ fontSize: "var(--brand-heading-size)", lineHeight: 1.05 }}
            >
              {headlineOf(order)}
            </h1>
            {stepLabel(order) ? (
              <p className="text-caption" style={{ color: "var(--brand-muted)", marginTop: 6 }}>
                {stepLabel(order)}
              </p>
            ) : null}
          </div>

          <div data-part="ticket-route">
            <div>
              <span data-part="ticket-label">Passenger</span>
              <span className="text-body font-semibold">{order.customer}</span>
            </div>
            <div>
              <span data-part="ticket-label">Order</span>
              <span className="type-code text-body">{order.orderNumber}</span>
            </div>
          </div>
        </div>

        <div data-part="ticket-tear">
          <Notches />
        </div>

        <div data-part="ticket-stub">
          <div data-part="barcode" aria-hidden />
          <span className="type-code text-h3">{order.orderNumber}</span>
        </div>
      </section>

      <div style={{ textAlign: "left", ...stack(36) }}>
        {order.cancelledNotice}
        {order.route}
        {order.waiting}
        {order.events}
        {order.manifest}
        {order.editAddress}
        {extras}
        {footer}
      </div>
    </Contained>
  );
}

// ---------------------------------------------------------------------------
// Journey — progress first
// ---------------------------------------------------------------------------

function stepState(entry: TimelineEntry, order: OrderParts): string {
  if (entry.state === "complete") return "Done";
  if (entry.state === "upcoming") return "Up next";
  if (order.cancelled) return "Cancelled";
  return order.delivered ? "Completed" : "Now";
}

function JourneyLayout({
  masthead,
  title,
  subtitle,
  lookup,
  order,
  extras,
  footer,
}: LayoutProps) {
  if (!order) {
    return (
      <Contained width={1040}>
        {masthead}
        {/* No inline display here: the design's CSS turns this into two
            columns on a wide screen, and an inline style would win. */}
        <div data-part="journey-hero" style={{ textAlign: "left" }}>
          <div style={stack(14)}>
            <p style={eyebrow}>Order tracking</p>
            <h1 className="type-display" data-part="journey-title">
              {title}
            </h1>
            {subtitle}
          </div>
          {lookup}
        </div>
        <div style={{ textAlign: "left", ...stack(36) }}>
          {extras}
          {footer}
        </div>
      </Contained>
    );
  }

  return (
    <Contained width={1040}>
      <div style={{ textAlign: "left", ...stack(36) }}>
        {masthead}
        <header style={stack(10)}>
          {/* No status pill: the headline already is the status. */}
          <p style={eyebrow}>
            Order <span className="type-code">{order.orderNumber}</span>
          </p>
          <h1 className="type-display" data-part="journey-title">
            {headlineOf(order)}
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 6,
            }}
          >
            <p className="text-small" style={{ color: "var(--brand-muted)" }}>
              {order.customer}
            </p>
            {stepLabel(order) ? (
              <p className="text-small font-semibold">{stepLabel(order)}</p>
            ) : null}
          </div>
          <Progress order={order} />
        </header>

        {order.cancelledNotice}

        {order.timeline.length > 0 ? (
          <ol data-part="steps" aria-label="Delivery steps">
            {order.timeline.map((entry, index) => (
              <li
                key={entry.stage.id}
                data-part="step"
                data-state={entry.state}
                aria-current={entry.state === "current" ? "step" : undefined}
              >
                <span data-part="step-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-body font-semibold">{entry.stage.name}</span>
                <span data-part="step-state">{stepState(entry, order)}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {order.waiting}

        <div data-part="journey-split">
          {order.events}
          {order.manifest}
        </div>

        {order.editAddress}
        {extras}
        {footer}
      </div>
    </Contained>
  );
}

// ---------------------------------------------------------------------------
// Atelier — a fashion-house index
// ---------------------------------------------------------------------------

/**
 * Pure type on white: an oversized Didone wordmark, everything else small and
 * uppercase. The delivery stages are an index — numbered lines between
 * hairlines — instead of a drawn route, and on a desktop the status holds a
 * narrow column beside the details.
 */
function AtelierLayout({
  storeName,
  brand,
  title,
  subtitle,
  lookup,
  order,
  extras,
  footer,
}: LayoutProps) {
  // Without the store's name the page opens on the hairline alone.
  const wordmark = !brand.show ? (
    <div data-part="atelier-wordmark" aria-hidden />
  ) : brand.logoUrl ? (
    <div data-part="atelier-wordmark">
      <Logo src={brand.logoUrl} alt={storeName} height={56} />
    </div>
  ) : (
    <p className="type-display" data-part="atelier-wordmark">
      {storeName}
    </p>
  );

  if (!order) {
    return (
      <div data-part="atelier" style={{ textAlign: "left" }}>
        {wordmark}
        <div data-part="atelier-grid">
          <div style={stack(14)}>
            <p data-part="atelier-small">Order tracking</p>
            <h1 className="type-display" data-part="atelier-title">
              {title}
            </h1>
            {subtitle}
          </div>
          <div style={stack(48)}>
            {lookup}
            {extras}
          </div>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div data-part="atelier" style={{ textAlign: "left" }}>
      {wordmark}
      <div data-part="atelier-grid">
        <header data-part="atelier-aside" style={stack(14)}>
          <p data-part="atelier-small">
            Order <span className="type-code">{order.orderNumber}</span> —{" "}
            {order.placed}
          </p>
          <h1 className="type-display" data-part="atelier-title">
            {headlineOf(order)}
          </h1>
          <p data-part="atelier-small" style={{ color: "var(--brand-muted)" }}>
            {order.customer}
          </p>
        </header>

        <div style={stack(48)}>
          {order.cancelledNotice}
          {order.timeline.length > 0 ? (
            <ol data-part="index" aria-label="Delivery steps">
              {order.timeline.map((entry, index) => (
                <li
                  key={entry.stage.id}
                  data-part="index-row"
                  data-state={entry.state}
                  aria-current={entry.state === "current" ? "step" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{entry.stage.name}</span>
                  <span>
                    {entry.state === "upcoming" ? "—" : stepState(entry, order)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {order.waiting}
          {order.events}
          {order.manifest}
          {order.editAddress}
          {extras}
        </div>
      </div>
      {footer}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beauté — graphic stripes and a stat strip
// ---------------------------------------------------------------------------

function Stripes() {
  return <div data-part="stripes" aria-hidden />;
}

/**
 * Beauty-retail energy: a black bar with the store's name, a stripe band, a
 * bold centred headline and the order's key facts as a stat strip. The
 * stripes close the page again above the footer.
 */
function BeauteLayout({
  storeName,
  brand,
  title,
  subtitle,
  lookup,
  order,
  extras,
  footer,
}: LayoutProps) {
  return (
    <div data-part="beaute">
      {brand.show ? (
        // A logo is drawn for a light ground, so it gets one: `data-logo`
        // turns the black bar to the page's surface colour.
        <div data-part="beaute-bar" {...(brand.logoUrl ? { "data-logo": "" } : {})}>
          {brand.logoUrl ? (
            <Logo src={brand.logoUrl} alt={storeName} height={30} />
          ) : (
            storeName
          )}
        </div>
      ) : null}
      <Stripes />

      <Contained width={640}>
        {order ? (
          <>
            <header style={{ ...stack(12), textAlign: "center" }}>
              <p data-part="beaute-eyebrow">Order update</p>
              <h1 className="type-display" data-part="beaute-title">
                {headlineOf(order)}
              </h1>
              <p className="text-body" style={{ color: "var(--brand-muted)" }}>
                {order.customer}
              </p>
            </header>

            <dl data-part="stats">
              <div data-part="stat">
                <dt>Order</dt>
                <dd className="type-code">{order.orderNumber}</dd>
              </div>
              <div data-part="stat">
                <dt>Placed</dt>
                <dd>{order.placed}</dd>
              </div>
              <div data-part="stat">
                <dt>Progress</dt>
                <dd>{stepLabel(order) ?? "—"}</dd>
              </div>
            </dl>

            <div style={{ textAlign: "left", ...stack(36) }}>
              {order.cancelledNotice}
              {order.route}
              {order.waiting}
              {order.events}
              {order.manifest}
              {order.editAddress}
            </div>
          </>
        ) : (
          <>
            <header style={{ ...stack(12), textAlign: "center" }}>
              <p data-part="beaute-eyebrow">Where is my order?</p>
              <h1 className="type-display" data-part="beaute-title">
                {title}
              </h1>
              {subtitle}
            </header>
            {lookup}
          </>
        )}
        <div style={{ textAlign: "left" }}>{extras}</div>
      </Contained>

      <Stripes />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px 40px" }}>
        {footer}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Maison — a letter from a luxury house
// ---------------------------------------------------------------------------

/**
 * Cream paper, a monogram in a ring and one double-framed card holding
 * everything, set in serif small capitals. The order opens like a letter —
 * addressed to the customer, dated — before the route and the details.
 */
function MaisonLayout({
  storeName,
  brand,
  title,
  subtitle,
  lookup,
  order,
  extras,
  footer,
}: LayoutProps) {
  return (
    <Contained width={680}>
      {brand.show ? (
        <div style={{ ...stack(14), alignItems: "center", textAlign: "center" }}>
          {brand.logoUrl ? (
            <Logo src={brand.logoUrl} alt={storeName} height={40} />
          ) : (
            <>
              <span data-part="monogram" aria-hidden>
                {monogramOf(storeName)}
              </span>
              <p data-part="caps" style={{ color: "var(--brand-text)" }}>
                {storeName}
              </p>
            </>
          )}
        </div>
      ) : null}

      <div data-part="frame">
        <div data-part="frame-inner">
          {order ? (
            <>
              <p data-part="caps">
                Order <span className="type-code">{order.orderNumber}</span>
              </p>
              <h1 className="type-display" data-part="maison-title">
                {headlineOf(order)}
              </h1>
              <span data-part="gold-rule" aria-hidden />
              <div data-part="letter">
                {order.customer.trim() && order.customer !== "—" ? (
                  <p>Dear {order.customer},</p>
                ) : null}
                <p>Your order was placed on {order.placed}.</p>
              </div>
              {stepLabel(order) ? (
                <p data-part="caps">{stepLabel(order)}</p>
              ) : null}

              <div data-part="frame-body" style={stack(36)}>
                {order.cancelledNotice}
                {order.route}
                {order.waiting}
                {order.events}
                {order.manifest}
                {order.editAddress}
              </div>
            </>
          ) : (
            <>
              <p data-part="caps">Order tracking</p>
              <h1 className="type-display" data-part="maison-title">
                {title}
              </h1>
              <span data-part="gold-rule" aria-hidden />
              <div data-part="letter">{subtitle}</div>
              <div data-part="frame-body">{lookup}</div>
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign: "left", ...stack(36) }}>
        {extras}
        {footer}
      </div>
    </Contained>
  );
}
