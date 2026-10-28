import type { CSSProperties, ReactNode } from "react";

import type { LayoutProps, OrderParts } from "./layouts";

/**
 * Two skeletons modelled on the checkout pages customers already know:
 * Shopify's own order status page, and the Shop app's tracking screen.
 *
 * Like every designed layout they only arrange what `OrderParts` exposes, so
 * an unverified visitor sees exactly what the column would show them. Inline
 * styles throughout, reading the page's brand variables, so they render the
 * same embedded in a Shopify theme as on our own domain.
 */

const stack = (gap: number): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap,
});

const ACCENT = "var(--brand-accent)";
const TEXT = "var(--brand-text)";
const MUTED = "var(--brand-muted)";
const SURFACE = "var(--brand-surface)";
const tint = (weight: number) =>
  `color-mix(in srgb, var(--brand-accent) ${weight}%, var(--brand-surface))`;

/** The status as a headline; a cancelled order never reads as moving. */
function statusOf(order: OrderParts): string {
  if (order.cancelled) return "Order cancelled";
  return order.stageName ?? "Order received";
}

function Check({ size = 22 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size * 0.5}
      height={size * 0.5}
      viewBox="0 0 16 16"
      fill="none"
      style={{ display: "block" }}
    >
      <path
        d="M3 8.5l3.2 3.2L13 5"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Ticked, current (a ring around a dot) or still to come (an empty ring). */
function Disc({ state, size = 22 }: { state: "done" | "now" | "next"; size?: number }) {
  const base: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: size,
    height: size,
    borderRadius: "50%",
    boxSizing: "border-box",
    backgroundColor: SURFACE,
  };

  if (state === "done") {
    return (
      <span aria-hidden style={{ ...base, backgroundColor: ACCENT }}>
        <Check size={size} />
      </span>
    );
  }
  if (state === "now") {
    return (
      <span aria-hidden style={{ ...base, border: `2px solid ${ACCENT}` }}>
        <span
          style={{ width: size * 0.38, height: size * 0.38, borderRadius: "50%", backgroundColor: TEXT }}
        />
      </span>
    );
  }
  return <span aria-hidden style={{ ...base, border: "2px solid var(--brand-line)" }} />;
}

function Thumb({ src, alt, size, radius }: { src: string | null; alt: string; size: number; radius: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{
        display: "block",
        width: size,
        height: size,
        flexShrink: 0,
        objectFit: "cover",
        borderRadius: radius,
        border: "1px solid var(--brand-line)",
      }}
    />
  ) : (
    <span
      aria-hidden
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        backgroundColor: tint(10),
        color: ACCENT,
        fontSize: size * 0.4,
        fontWeight: 700,
      }}
    >
      {alt.trim().charAt(0).toUpperCase() || "•"}
    </span>
  );
}

/** The street address, or the city with a way to confirm and see the rest. */
function ShipTo({ order }: { order: OrderParts }) {
  return (
    <div style={{ fontSize: 13, lineHeight: "19px", color: MUTED }}>
      {order.shipTo.length > 0 ? (
        <address style={{ fontStyle: "normal" }}>
          {order.shipTo.map((line, index) => (
            <span key={index} style={{ display: "block" }}>
              {line}
              {order.unverified && index === order.shipTo.length - 1 ? " ···" : ""}
            </span>
          ))}
        </address>
      ) : (
        <span>No delivery address on file</span>
      )}
      {order.unverified ? (
        <p style={{ margin: "6px 0 0", fontSize: 12 }}>
          <a href={order.verifyHref} style={{ color: "var(--brand-link)", fontWeight: 600 }}>
            Confirm your email address
          </a>{" "}
          to see the full address.
        </p>
      ) : order.canEditAddress ? (
        <a
          href="#edit-address"
          style={{
            display: "inline-block",
            marginTop: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--brand-link)",
            textDecoration: "none",
          }}
        >
          Edit address
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shopify — the order status page
// ---------------------------------------------------------------------------

const card: CSSProperties = {
  border: `1px solid ${tint(16)}`,
  borderRadius: "var(--brand-card-radius)",
  backgroundColor: SURFACE,
  padding: "22px 20px",
};

const cardTitle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 19,
  fontWeight: 600,
  lineHeight: "26px",
  color: TEXT,
};

/**
 * Shopify: a thin top bar with the store and order number, "Track your
 * order", then a pale status card over a ticked progress line, the tracking
 * details as a checked timeline, the order summary with product photos and
 * the address — each in a hairline card, the brand colour on status alone.
 */
export function ShopifyLayout({
  storeName,
  brand,
  title,
  subtitle,
  lookup,
  order,
  extras,
  footer,
}: LayoutProps) {
  const bar = (
    <div style={{ borderBottom: `1px solid ${tint(14)}` }}>
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <span style={{ fontSize: 20, color: TEXT, minWidth: 0 }}>
          {brand.show && brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={storeName} style={{ height: 30, width: "auto" }} />
          ) : brand.show ? (
            storeName
          ) : (
            "Order tracking"
          )}
        </span>
        {order ? (
          <span style={{ fontSize: 14, color: MUTED, whiteSpace: "nowrap" }}>
            Order <span className="type-code">{order.orderNumber}</span>
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div data-part="shopify" style={{ textAlign: "left" }}>
      {bar}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px 48px", ...stack(16) }}>
        {order ? (
          <>
            <header style={{ ...stack(6), marginBottom: 8 }}>
              <h1
                className="type-display"
                style={{ fontSize: 30, lineHeight: "36px", fontWeight: 400, letterSpacing: "-0.01em" }}
              >
                Track your order
              </h1>
              {subtitle}
            </header>

            {order.cancelledNotice}

            <section style={{ border: `1px solid ${tint(18)}`, borderRadius: "var(--brand-card-radius)", overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "18px 20px",
                  backgroundColor: tint(6),
                  borderBottom: `1px solid ${tint(18)}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: "26px", color: order.cancelled ? "#8F2F1F" : ACCENT }}>
                    {statusOf(order)}
                  </p>
                  {order.updates[0]?.detail ? (
                    <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: "19px", color: MUTED }}>
                      {order.updates[0].detail}
                    </p>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Order placed</p>
                  <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 600, color: TEXT }}>{order.placed}</p>
                </div>
              </div>

              {order.cancelled ? null : (
                <ol
                  data-part="progress-steps"
                  style={{ display: "flex", margin: 0, padding: "20px 8px 18px", listStyle: "none" }}
                >
                  {order.steps.map((step, index) => {
                    const left = index === 0 ? "transparent" : step.state === "next" ? "var(--brand-line)" : ACCENT;
                    const next = order.steps[index + 1];
                    const right = !next ? "transparent" : next.state === "next" ? "var(--brand-line)" : ACCENT;
                    return (
                      <li
                        key={step.id}
                        aria-current={step.state === "now" ? "step" : undefined}
                        style={{ flex: "1 1 0%", minWidth: 0, ...stack(8), alignItems: "center", textAlign: "center" }}
                      >
                        <span style={{ display: "flex", alignItems: "center", width: "100%" }}>
                          <span style={{ flex: 1, height: 2, backgroundColor: left }} />
                          <Disc state={step.state} />
                          <span style={{ flex: 1, height: 2, backgroundColor: right }} />
                        </span>
                        <span style={{ padding: "0 2px" }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              lineHeight: "16px",
                              fontWeight: step.state === "now" ? 600 : 400,
                              color: step.state === "next" ? MUTED : TEXT,
                            }}
                          >
                            {step.name}
                          </span>
                          {step.date ? (
                            <span style={{ display: "block", marginTop: 2, fontSize: 11, color: MUTED }}>
                              {step.date}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {order.waiting}

            <section style={card}>
              <h2 style={cardTitle}>Tracking details</h2>
              {order.updates.length > 0 ? (
                <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {order.updates.map((update, index) => {
                    const last = index === order.updates.length - 1;
                    return (
                      <li key={update.id} style={{ display: "flex", gap: 14 }}>
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <Disc state="done" size={20} />
                          {last ? null : (
                            <span style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: tint(40) }} />
                          )}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 16 }}>
                          <span style={{ display: "block", fontSize: 14, fontWeight: 500, lineHeight: "20px", color: TEXT }}>
                            {update.title}
                          </span>
                          {update.detail ? (
                            <span style={{ display: "block", marginTop: 2, fontSize: 13, lineHeight: "18px", color: MUTED }}>
                              {update.detail}
                            </span>
                          ) : null}
                        </span>
                        <span style={{ flexShrink: 0, textAlign: "right", fontSize: 12, lineHeight: "17px", color: MUTED }}>
                          {update.date}
                          <br />
                          {update.time}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: MUTED }}>No updates recorded yet.</p>
              )}
            </section>

            {order.items.length > 0 ? (
              <section style={card}>
                <h2 style={cardTitle}>Order summary</h2>
                <div style={stack(14)}>
                  {order.items.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      {item.imageUrl ? <Thumb src={item.imageUrl} alt={item.title} size={56} radius={6} /> : null}
                      <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: "20px", color: TEXT }}>
                        {item.title}
                        {item.variant ? ` - ${item.variant}` : ""}
                        <span style={{ display: "block", fontSize: 13, color: MUTED }}>× {item.quantity}</span>
                      </div>
                      {item.price ? (
                        <span style={{ flexShrink: 0, fontSize: 14, color: TEXT }}>{item.price}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
                {order.total ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 16,
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: `1px solid ${tint(14)}`,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Total</span>
                    <span style={{ fontSize: 22, fontWeight: 600, color: TEXT }}>{order.total}</span>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section
              style={{
                ...card,
                backgroundColor: tint(3),
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
              }}
            >
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <h2 style={{ ...cardTitle, fontSize: 15, margin: "0 0 6px" }}>Shipping address</h2>
                <ShipTo order={order} />
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <h2 style={{ ...cardTitle, fontSize: 15, margin: "0 0 6px" }}>Order details</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: "19px", color: MUTED }}>
                  {order.customer}
                  <br />
                  Order <span className="type-code">{order.orderNumber}</span>
                  <br />
                  Placed {order.placed}
                </p>
              </div>
            </section>

            {order.editAddress}
          </>
        ) : (
          <>
            <header style={{ ...stack(6), marginBottom: 8 }}>
              <h1
                className="type-display"
                style={{ fontSize: 30, lineHeight: "36px", fontWeight: 400, letterSpacing: "-0.01em" }}
              >
                {title}
              </h1>
              {subtitle}
            </header>
            <section style={card}>{lookup}</section>
          </>
        )}
        {extras}
        {footer}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shop — the Shop app's tracking screen, without the map
// ---------------------------------------------------------------------------

/** Updates shown before "See N more updates". */
const SHOWN = 3;

/** One update hanging off the rail: a white dot on the purple bar. */
function RailItem({ title, detail, first }: { title: string; detail: string; first: boolean }) {
  return (
    <li style={{ position: "relative", padding: "0 0 16px 26px" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 3,
          top: 7,
          width: first ? 6 : 4,
          height: first ? 6 : 4,
          marginLeft: first ? -1 : 0,
          borderRadius: "50%",
          backgroundColor: "#FFFFFF",
        }}
      />
      <span style={{ display: "block", fontSize: 15, fontWeight: 600, lineHeight: "20px", color: TEXT }}>
        {title}
      </span>
      {detail ? (
        <span style={{ display: "block", marginTop: 2, fontSize: 12, lineHeight: "17px", color: MUTED }}>
          {detail}
        </span>
      ) : null}
    </li>
  );
}

function Rail({ children, solidTop }: { children: ReactNode; solidTop: boolean }) {
  return (
    <ol style={{ position: "relative", margin: 0, padding: 0, listStyle: "none" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 2,
          bottom: 14,
          width: 10,
          borderRadius: 999,
          backgroundColor: tint(40),
        }}
      />
      {solidTop ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 2,
            width: 10,
            height: 18,
            borderRadius: 999,
            backgroundColor: ACCENT,
          }}
        />
      ) : null}
      {children}
    </ol>
  );
}

/**
 * Shop: a bold "Tracking" title over the order number, the status as a
 * pill, the latest updates on a thick rail with a white dot at every step
 * (the rest behind "See N more updates"), the order number, and the items as
 * the app's home-list rows — photo, price and store, status in colour.
 */
export function ShopLayout({
  storeName,
  brand,
  title,
  subtitle,
  lookup,
  order,
  extras,
  footer,
}: LayoutProps) {
  const sheet: CSSProperties = {
    backgroundColor: "var(--brand-section)",
    borderRadius: "var(--brand-card-radius)",
    padding: "22px 20px",
    boxShadow: "0 1px 2px rgba(17,12,46,0.05), 0 10px 30px rgba(17,12,46,0.06)",
  };

  const masthead = brand.show ? (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt={storeName} style={{ height: 28, width: "auto" }} />
      ) : (
        <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{storeName}</span>
      )}
    </div>
  ) : null;

  if (!order) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px 48px", textAlign: "left", ...stack(20) }}>
        {masthead}
        <section style={{ ...sheet, ...stack(16) }}>
          <h1 className="type-display" style={{ fontSize: 32, lineHeight: "36px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {title}
          </h1>
          {subtitle}
          {lookup}
        </section>
        {extras}
        {footer}
      </div>
    );
  }

  const statusColor = order.cancelled
    ? "#C0392B"
    : order.delivered
      ? "var(--brand-delivered)"
      : ACCENT;
  const shown = order.updates.slice(0, SHOWN);
  const hidden = order.updates.slice(SHOWN);
  const detailOf = (update: OrderParts["updates"][number]) =>
    [update.detail, `${update.date}, ${update.time}`].filter(Boolean).join(" · ");

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px 48px", textAlign: "left", ...stack(16) }}>
      {masthead}

      <section style={{ ...sheet, ...stack(18) }}>
        <h1
          className="type-display"
          style={{ fontSize: 32, lineHeight: "36px", fontWeight: 800, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}
        >
          Tracking
          <br />
          <span className="type-code" style={{ fontWeight: 800 }}>{order.orderNumber}</span>
        </h1>

        <span
          style={{
            alignSelf: "flex-start",
            padding: "5px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            color: statusColor,
            backgroundColor: `color-mix(in srgb, ${statusColor} 10%, var(--brand-section))`,
          }}
        >
          {statusOf(order)}
        </span>

        {order.cancelledNotice}

        {order.updates.length > 0 ? (
          <div>
            <Rail solidTop={!order.cancelled}>
              {shown.map((update, index) => (
                <RailItem key={update.id} title={update.title} detail={detailOf(update)} first={index === 0} />
              ))}
            </Rail>
            {hidden.length > 0 ? (
              // Plain <details>: the rest of the history opens without script.
              <details>
                <summary
                  style={{
                    listStyle: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    color: ACCENT,
                    margin: "0 0 12px",
                  }}
                >
                  See {hidden.length} more update{hidden.length === 1 ? "" : "s"}
                </summary>
                <Rail solidTop={false}>
                  {hidden.map((update) => (
                    <RailItem key={update.id} title={update.title} detail={detailOf(update)} first={false} />
                  ))}
                </Rail>
              </details>
            ) : null}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>No updates recorded yet.</p>
        )}

        {order.waiting}

        <div style={{ borderTop: "1px solid var(--brand-line)", paddingTop: 14 }}>
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Order number</p>
          <p className="type-code" style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600, color: ACCENT }}>
            {order.orderNumber}
          </p>
        </div>
      </section>

      {order.items.length > 0 ? (
        <section style={{ ...sheet, padding: "6px 20px" }}>
          {order.items.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 0",
                borderTop: index === 0 ? "none" : "1px solid var(--brand-line)",
              }}
            >
              <Thumb src={brand.logoUrl} alt={storeName} size={36} radius={999} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: "19px", color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 13, lineHeight: "18px", color: MUTED }}>
                  {[item.price, item.variant ?? storeName].filter(Boolean).join(" • ")}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 500, lineHeight: "18px", color: statusColor }}>
                  {statusOf(order)}
                </p>
              </div>
              <Thumb src={item.imageUrl} alt={item.title} size={48} radius={10} />
            </div>
          ))}
          {order.total ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "14px 0",
                borderTop: "1px solid var(--brand-line)",
                fontSize: 14,
                fontWeight: 700,
                color: TEXT,
              }}
            >
              <span>Total</span>
              <span>{order.total}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <section style={sheet}>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: MUTED }}>Delivering to</p>
        {/* The full address already opens with the name. */}
        {order.shipTo[0] === order.customer ? null : (
          <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: TEXT }}>{order.customer}</p>
        )}
        <ShipTo order={order} />
      </section>

      {order.editAddress}
      {extras}
      {footer}
    </div>
  );
}
