import {
  Button,
  Column,
  Container,
  Img,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components";

import type { EmailOrderFacts } from "../order-facts";
import { EmailShell, authoredBody, type EmailModel } from "./shared";

// The palette of Shopify's own order status page, fixed rather than taken
// from the store's branding: that recognisable teal is the point of the design.
const WHITE = "#FFFFFF";
const INK = "#13212E";
const MUTED = "#5C6B7A";
const FAINT = "#8593A1";
const LINE = "#DCE7EE";
const TEAL = "#0E7FA8";
const TINT = "#F2F8FB";
const TINT_LINE = "#D3E6F0";
const PANEL = "#F7FBFD";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

type Step = EmailOrderFacts["progress"][number];

function Rule({ color = LINE }: { color?: string }) {
  return (
    <div style={{ borderTop: `1px solid ${color}`, fontSize: 0, lineHeight: 0 }}>
      &nbsp;
    </div>
  );
}

/** A 22px status disc: ticked, current (ring and dot) or still to come. */
function Disc({ state, accent }: { state: Step["state"]; accent: string }) {
  const size = 22;
  const base = {
    width: size,
    height: size,
    borderRadius: 999,
    boxSizing: "border-box" as const,
    textAlign: "center" as const,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: `${size - (state === "done" ? 0 : 4)}px`,
    margin: "0 auto",
  };

  if (state === "done") {
    return (
      <div style={{ ...base, backgroundColor: accent, color: WHITE }}>✓</div>
    );
  }
  if (state === "now") {
    return (
      <div style={{ ...base, border: `2px solid ${accent}`, backgroundColor: WHITE }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: INK,
            display: "inline-block",
            verticalAlign: "middle",
          }}
        />
      </div>
    );
  }
  return <div style={{ ...base, border: `2px solid ${LINE}`, backgroundColor: WHITE }} />;
}

function Card({
  children,
  background = WHITE,
  border = TINT_LINE,
  padding = "24px 20px",
}: {
  children: React.ReactNode;
  background?: string;
  border?: string;
  padding?: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: background,
        border: `1px solid ${border}`,
        borderRadius: 6,
        padding,
        margin: "0 0 16px",
      }}
    >
      {children}
    </Section>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: INK, fontSize: 19, fontWeight: 600, lineHeight: "26px", margin: "0 0 16px" }}>
      {children}
    </Text>
  );
}

/**
 * Shopify: the look of Shopify's own order pages and notifications. Shop name
 * and order number on a thin top bar, "Track your order", then a pale status
 * card with a ticked progress line, the tracking history, the order summary
 * and the addresses — each in its own hairline-bordered card, the brand colour
 * used only for status and links.
 */
export function ShopifyLayout({ model }: { model: EmailModel }) {
  const accent = TEAL;
  const tint = TINT;
  const tintLine = TINT_LINE;
  const body = authoredBody(model.html, {
    text: MUTED,
    muted: FAINT,
    link: accent,
    size: model.size - 1,
  });

  const order = model.order;
  const items = order?.items ?? [];
  const events = order?.events ?? [];
  const progress = order?.progress ?? [];
  const addressLines = order?.addressLines.length
    ? order.addressLines
    : model.address
      ? [model.address]
      : [];

  return (
    <EmailShell model={model} background={WHITE} font={SANS}>
      {/* Top bar, full width under its hairline. */}
      <Section style={{ borderBottom: `1px solid ${LINE}` }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "22px 16px" }}>
          <Row>
            <Column style={{ verticalAlign: "middle" }}>
              {model.logoUrl ? (
                <Img
                  src={model.logoUrl}
                  alt={model.storeName}
                  style={{ display: "block", maxHeight: 32, maxWidth: 160, height: "auto" }}
                />
              ) : (
                <Text style={{ color: INK, fontSize: 22, fontWeight: 400, margin: 0 }}>
                  {model.storeName}
                </Text>
              )}
            </Column>
            {model.orderNumber ? (
              <Column align="right" style={{ verticalAlign: "middle" }}>
                <Text style={{ color: MUTED, fontSize: 14, margin: 0, textAlign: "right" }}>
                  Order {model.orderNumber}
                </Text>
              </Column>
            ) : null}
          </Row>
        </Container>
      </Section>

      <Container style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
        <Section style={{ padding: "28px 0 24px" }}>
          <Text style={{ color: INK, fontSize: 30, fontWeight: 400, lineHeight: "36px", margin: "0 0 10px" }}>
            Track your order
          </Text>
          <div dangerouslySetInnerHTML={{ __html: body }} />
        </Section>

        {/* Status and progress, one card: the pale band, then the steps. */}
        <Section
          style={{ border: `1px solid ${tintLine}`, borderRadius: 6, margin: "0 0 16px" }}
        >
          <Section style={{ backgroundColor: tint, borderBottom: `1px solid ${tintLine}`, padding: "18px 20px" }}>
            <Row>
              <Column style={{ verticalAlign: "top" }}>
                <Text style={{ color: accent, fontSize: 19, fontWeight: 600, lineHeight: "24px", margin: 0 }}>
                  {model.stage || "Order received"}
                </Text>
                <Text style={{ color: MUTED, fontSize: 13, lineHeight: "19px", margin: "4px 0 0" }}>
                  {events[0]?.detail || "We'll email you again as soon as it moves."}
                </Text>
              </Column>
              {model.orderDate ? (
                <Column align="right" style={{ verticalAlign: "top", width: "36%" }}>
                  <Text style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: 0, textAlign: "right" }}>
                    Order placed
                  </Text>
                  <Text style={{ color: INK, fontSize: 15, fontWeight: 600, lineHeight: "22px", margin: "2px 0 0", textAlign: "right" }}>
                    {model.orderDate}
                  </Text>
                </Column>
              ) : null}
            </Row>
          </Section>

          {progress.length > 0 ? (
            <Section style={{ padding: "20px 8px 18px" }}>
              <Row>
                {progress.map((step, index) => {
                  const left = index === 0 ? "transparent" : step.state === "next" ? LINE : accent;
                  const right =
                    index === progress.length - 1
                      ? "transparent"
                      : progress[index + 1].state === "next"
                        ? LINE
                        : accent;
                  return (
                    <Column
                      key={index}
                      style={{ width: `${100 / progress.length}%`, verticalAlign: "top" }}
                    >
                      <Row>
                        <Column style={{ verticalAlign: "middle" }}>
                          <div style={{ borderTop: `2px solid ${left}`, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
                        </Column>
                        <Column style={{ width: 22, verticalAlign: "middle" }}>
                          <Disc state={step.state} accent={accent} />
                        </Column>
                        <Column style={{ verticalAlign: "middle" }}>
                          <div style={{ borderTop: `2px solid ${right}`, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
                        </Column>
                      </Row>
                      <Text
                        style={{
                          color: step.state === "next" ? FAINT : INK,
                          fontSize: 12,
                          fontWeight: step.state === "now" ? 600 : 400,
                          lineHeight: "16px",
                          margin: "8px 2px 0",
                          textAlign: "center",
                        }}
                      >
                        {step.name}
                      </Text>
                      {step.date ? (
                        <Text style={{ color: FAINT, fontSize: 11, lineHeight: "15px", margin: "2px 2px 0", textAlign: "center" }}>
                          {step.date}
                        </Text>
                      ) : null}
                    </Column>
                  );
                })}
              </Row>
            </Section>
          ) : null}
        </Section>

        {events.length > 0 || model.trackingUrl ? (
          <Card>
            <CardTitle>Tracking details</CardTitle>
            {events.map((event, index) => {
              const last = index === events.length - 1;
              return (
                <Row key={index}>
                  {/* The rail: a disc, then the line down to the next one. */}
                  <Column style={{ width: 34, verticalAlign: "top" }}>
                    <Disc state="done" accent={accent} />
                    {last ? null : (
                      <div
                        style={{
                          width: 2,
                          height: 34,
                          margin: "0 auto",
                          backgroundColor: accent,
                          fontSize: 0,
                          lineHeight: 0,
                        }}
                      >
                        &nbsp;
                      </div>
                    )}
                  </Column>
                  <Column style={{ verticalAlign: "top", padding: "1px 0 0 6px" }}>
                    <Text style={{ color: INK, fontSize: 14, fontWeight: 500, lineHeight: "20px", margin: 0 }}>
                      {event.title}
                    </Text>
                    {event.detail ? (
                      <Text style={{ color: MUTED, fontSize: 13, lineHeight: "18px", margin: "2px 0 0" }}>
                        {event.detail}
                      </Text>
                    ) : null}
                  </Column>
                  <Column align="right" style={{ verticalAlign: "top", width: "30%" }}>
                    <Text style={{ color: MUTED, fontSize: 12, lineHeight: "17px", margin: "1px 0 0", textAlign: "right" }}>
                      {event.date}
                      <br />
                      {event.time}
                    </Text>
                  </Column>
                </Row>
              );
            })}

            {model.trackingUrl ? (
              <Section style={{ padding: events.length ? "18px 0 0" : 0 }}>
                <Button
                  href={model.trackingUrl}
                  style={{
                    border: `1px solid ${tintLine}`,
                    borderRadius: 4,
                    color: accent,
                    display: "block",
                    fontSize: 14,
                    padding: "13px 16px",
                    textDecoration: "none",
                  }}
                >
                  View full tracking &nbsp;›
                </Button>
              </Section>
            ) : null}
          </Card>
        ) : null}

        {items.length > 0 ? (
          <Card>
            <CardTitle>Order summary</CardTitle>
            {items.map((item, index) => (
              <Row key={index} style={{ padding: "0 0 14px" }}>
                {item.imageUrl ? (
                  <Column style={{ width: 70, verticalAlign: "top" }}>
                    <Img
                      src={item.imageUrl}
                      alt={item.title}
                      width={56}
                      height={56}
                      style={{ borderRadius: 6, border: `1px solid ${LINE}`, objectFit: "cover" }}
                    />
                  </Column>
                ) : null}
                <Column style={{ verticalAlign: "top" }}>
                  <Text style={{ color: INK, fontSize: 14, lineHeight: "20px", margin: 0 }}>
                    {item.title}
                    {item.variant ? ` - ${item.variant}` : ""}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 13, lineHeight: "19px", margin: "2px 0 0" }}>
                    × {item.quantity}
                  </Text>
                </Column>
                <Column align="right" style={{ verticalAlign: "top", width: "28%" }}>
                  <Text style={{ color: INK, fontSize: 14, margin: 0, textAlign: "right" }}>
                    {item.price}
                  </Text>
                </Column>
              </Row>
            ))}
            {order?.total ? (
              <>
                <Rule />
                <Row style={{ padding: "16px 0 0" }}>
                  <Column>
                    <Text style={{ color: INK, fontSize: 14, fontWeight: 600, margin: 0 }}>Total</Text>
                  </Column>
                  <Column align="right">
                    <Text style={{ color: INK, fontSize: 22, fontWeight: 600, margin: 0, textAlign: "right" }}>
                      {order.total}
                    </Text>
                  </Column>
                </Row>
              </>
            ) : null}
          </Card>
        ) : null}

        <Card background={PANEL} border={TINT_LINE}>
          <Row>
            {addressLines.length > 0 ? (
              <Column style={{ verticalAlign: "top", width: "50%", paddingRight: 16 }}>
                <Text style={{ color: INK, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
                  Shipping address
                </Text>
                {addressLines.map((line, index) => (
                  <Text key={index} style={{ color: MUTED, fontSize: 13, lineHeight: "19px", margin: 0 }}>
                    {line}
                  </Text>
                ))}
              </Column>
            ) : null}
            <Column
              style={{
                verticalAlign: "top",
                borderLeft: addressLines.length ? `1px solid ${LINE}` : undefined,
                paddingLeft: addressLines.length ? 16 : 0,
              }}
            >
              <Text style={{ color: INK, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
                Order details
              </Text>
              {model.orderNumber ? (
                <Text style={{ color: MUTED, fontSize: 13, lineHeight: "19px", margin: 0 }}>
                  Order {model.orderNumber}
                </Text>
              ) : null}
              <Text style={{ color: MUTED, fontSize: 13, lineHeight: "19px", margin: 0 }}>
                Placed {order?.placedAt || model.orderDate || "—"}
              </Text>
            </Column>
          </Row>
        </Card>

        <Section style={{ padding: "12px 0 40px" }}>
          <Rule />
          <Text style={{ color: FAINT, fontSize: 12, lineHeight: "18px", margin: "20px 0 0", textAlign: "center" }}>
            If you have any questions, reply to this email
            {model.helpUrl ? (
              <>
                {" or "}
                <Link href={model.helpUrl} style={{ color: accent, textDecoration: "none" }}>
                  contact us
                </Link>
              </>
            ) : null}
            .
          </Text>
          <Text style={{ color: FAINT, fontSize: 11, lineHeight: "17px", margin: "10px 0 0", textAlign: "center" }}>
            {model.footerText}
          </Text>
          {model.postalAddress ? (
            <Text style={{ color: FAINT, fontSize: 11, lineHeight: "17px", margin: "4px 0 0", textAlign: "center" }}>
              {model.postalAddress}
            </Text>
          ) : null}
        </Section>
      </Container>
    </EmailShell>
  );
}
