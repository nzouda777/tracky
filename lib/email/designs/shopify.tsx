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

import { readableOn } from "@/components/tracking/branding";
import { EmailShell, authoredBody, visibleOn, type EmailModel } from "./shared";

const WHITE = "#FFFFFF";
const INK = "#333333";
const MUTED = "#777777";
const FAINT = "#999999";
const LINE = "#E5E5E5";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

function Rule() {
  return (
    <div style={{ borderTop: `1px solid ${LINE}`, fontSize: 0, lineHeight: 0 }}>
      &nbsp;
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: INK,
        fontSize: 20,
        fontWeight: 400,
        lineHeight: "26px",
        margin: "0 0 20px",
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Shopify: the look of Shopify's stock order notifications, the emails a
 * customer has already had from this store at checkout. Shop name on the
 * left, the order number on the right, a plain headline, one square-cornered
 * button in the brand colour, then an order summary and the customer
 * information, each under a thin rule. Deliberately unremarkable, so the
 * tracking emails read as part of the same thread.
 */
export function ShopifyLayout({ model }: { model: EmailModel }) {
  const accent = visibleOn(model.accent, WHITE, INK);
  const link = visibleOn(model.link, WHITE, INK);
  const body = authoredBody(model.html, {
    text: MUTED,
    muted: FAINT,
    link,
    size: model.size,
  });

  const items = model.order?.items ?? [];
  const addressLines = model.order?.addressLines.length
    ? model.order.addressLines
    : model.address
      ? [model.address]
      : [];

  return (
    <EmailShell model={model} background={WHITE} font={SANS}>
      <Container style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
        <Section style={{ padding: "40px 0 0" }}>
          <Row>
            <Column style={{ verticalAlign: "middle" }}>
              {model.logoUrl ? (
                <Img
                  src={model.logoUrl}
                  alt={model.storeName}
                  style={{ display: "block", maxHeight: 40, maxWidth: 180, height: "auto" }}
                />
              ) : (
                <Text style={{ color: INK, fontSize: 28, fontWeight: 400, margin: 0 }}>
                  {model.storeName}
                </Text>
              )}
            </Column>
            {model.orderNumber ? (
              <Column align="right" style={{ verticalAlign: "middle" }}>
                <Text
                  style={{
                    color: FAINT,
                    fontSize: 14,
                    letterSpacing: "0.04em",
                    margin: 0,
                    textAlign: "right",
                    textTransform: "uppercase",
                  }}
                >
                  Order {model.orderNumber}
                </Text>
              </Column>
            ) : null}
          </Row>
        </Section>

        <Section style={{ padding: "40px 0 0" }}>
          <Text
            style={{
              color: INK,
              fontSize: 24,
              fontWeight: 400,
              lineHeight: "30px",
              margin: "0 0 16px",
            }}
          >
            {model.stage || "Your order update"}
          </Text>
          <div dangerouslySetInnerHTML={{ __html: body }} />
        </Section>

        {model.trackingUrl ? (
          <Section style={{ padding: "32px 0 0" }}>
            <Button
              href={model.trackingUrl}
              style={{
                backgroundColor: accent,
                borderRadius: 4,
                color: readableOn(accent, INK),
                display: "inline-block",
                fontSize: 16,
                padding: "20px 25px",
                textDecoration: "none",
              }}
            >
              View your order
            </Button>
          </Section>
        ) : null}

        <Section style={{ padding: "40px 0" }}>
          <Rule />
        </Section>

        {items.length > 0 ? (
          <>
            <Section>
              <SectionTitle>Order summary</SectionTitle>
              {items.map((item, index) => (
                <Row key={index} style={{ padding: "0 0 15px" }}>
                  <Column style={{ verticalAlign: "top" }}>
                    <Text
                      style={{
                        color: "#555555",
                        fontSize: 16,
                        fontWeight: 600,
                        lineHeight: "22px",
                        margin: 0,
                      }}
                    >
                      {item.title} × {item.quantity}
                    </Text>
                    {item.variant ? (
                      <Text style={{ color: FAINT, fontSize: 14, lineHeight: "20px", margin: "2px 0 0" }}>
                        {item.variant}
                      </Text>
                    ) : null}
                  </Column>
                  <Column align="right" style={{ verticalAlign: "top", width: "35%" }}>
                    <Text
                      style={{
                        color: "#555555",
                        fontSize: 16,
                        fontWeight: 600,
                        lineHeight: "22px",
                        margin: 0,
                        textAlign: "right",
                      }}
                    >
                      {item.price}
                    </Text>
                  </Column>
                </Row>
              ))}
              {model.order?.total ? (
                <>
                  <Rule />
                  <Row style={{ padding: "15px 0 0" }}>
                    <Column>
                      <Text style={{ color: MUTED, fontSize: 16, margin: 0 }}>Total</Text>
                    </Column>
                    <Column align="right">
                      <Text
                        style={{
                          color: "#555555",
                          fontSize: 20,
                          fontWeight: 600,
                          margin: 0,
                          textAlign: "right",
                        }}
                      >
                        {model.order.total}
                      </Text>
                    </Column>
                  </Row>
                </>
              ) : null}
            </Section>
            <Section style={{ padding: "40px 0" }}>
              <Rule />
            </Section>
          </>
        ) : null}

        <Section>
          <SectionTitle>Customer information</SectionTitle>
          <Row>
            {addressLines.length > 0 ? (
              <Column style={{ verticalAlign: "top", width: "50%", paddingRight: 12 }}>
                <Text style={{ color: "#555555", fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>
                  Shipping address
                </Text>
                {addressLines.map((line, index) => (
                  <Text key={index} style={{ color: MUTED, fontSize: 14, lineHeight: "21px", margin: 0 }}>
                    {line}
                  </Text>
                ))}
              </Column>
            ) : null}
            <Column style={{ verticalAlign: "top" }}>
              <Text style={{ color: "#555555", fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>
                Order details
              </Text>
              {model.orderNumber ? (
                <Text style={{ color: MUTED, fontSize: 14, lineHeight: "21px", margin: 0 }}>
                  Order {model.orderNumber}
                </Text>
              ) : null}
              <Text style={{ color: MUTED, fontSize: 14, lineHeight: "21px", margin: 0 }}>
                {model.order?.placedAt || model.orderDate || "—"}
              </Text>
              {model.stage ? (
                <Text style={{ color: MUTED, fontSize: 14, lineHeight: "21px", margin: 0 }}>
                  {model.stage}
                </Text>
              ) : null}
            </Column>
          </Row>
        </Section>

        <Section style={{ padding: "40px 0 0" }}>
          <Rule />
        </Section>
        <Section style={{ padding: "30px 0 40px" }}>
          <Text style={{ color: FAINT, fontSize: 14, lineHeight: "21px", margin: 0 }}>
            If you have any questions, reply to this email
            {model.helpUrl ? (
              <>
                {" or "}
                <Link href={model.helpUrl} style={{ color: link, textDecoration: "none" }}>
                  contact us
                </Link>
              </>
            ) : null}
            .
          </Text>
          <Text style={{ color: FAINT, fontSize: 12, lineHeight: "18px", margin: "16px 0 0" }}>
            {model.footerText}
          </Text>
          {model.postalAddress ? (
            <Text style={{ color: FAINT, fontSize: 12, lineHeight: "18px", margin: "4px 0 0" }}>
              {model.postalAddress}
            </Text>
          ) : null}
        </Section>
      </Container>
    </EmailShell>
  );
}
