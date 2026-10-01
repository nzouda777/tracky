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

import {
  EmailShell,
  GROTESK,
  authoredBody,
  visibleOn,
  type EmailModel,
} from "./shared";

const INK = "#111111";
const PAPER = "#F5F5F5";
const WHITE = "#FFFFFF";
const MUTED = "#707072";
const HAIRLINE = "#E5E5E5";

const label = {
  color: MUTED,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "0 0 6px",
};

const value = {
  color: INK,
  fontSize: 15,
  fontWeight: 500,
  lineHeight: "22px",
  margin: 0,
};

/**
 * Athletic: monochrome and loud. A black hero carries the stage as a huge
 * uppercase headline; everything else is a strict black-on-white grid.
 *
 * The brand colour is held back to one mark — the bar above the headline — so
 * the layout stays recognisably itself whatever palette the store uses.
 */
export function AthleticLayout({ model }: { model: EmailModel }) {
  const mark = visibleOn(model.accent, INK, WHITE);
  const body = authoredBody(model.html, {
    text: INK,
    muted: MUTED,
    link: INK,
    size: model.size,
    headingFont: GROTESK,
  });

  return (
    <EmailShell model={model} background={PAPER} font={GROTESK}>
      <Section style={{ padding: "24px 0 40px" }}>
        <Container
          style={{ backgroundColor: WHITE, maxWidth: 600, margin: "0 auto" }}
        >
          <Section style={{ padding: "22px 40px" }}>
            <Row>
              <Column style={{ verticalAlign: "middle" }}>
                {model.logoUrl ? (
                  <Img
                    src={model.logoUrl}
                    alt={model.storeName}
                    style={{ display: "block", maxHeight: 28, maxWidth: 160, height: "auto" }}
                  />
                ) : (
                  <Text
                    style={{
                      color: INK,
                      fontSize: 18,
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                      textTransform: "uppercase",
                      margin: 0,
                    }}
                  >
                    {model.storeName}
                  </Text>
                )}
              </Column>
              {model.orderNumber ? (
                <Column align="right" style={{ verticalAlign: "middle" }}>
                  <Text style={{ ...label, margin: 0, color: INK }}>
                    Order {model.orderNumber}
                  </Text>
                </Column>
              ) : null}
            </Row>
          </Section>

          <Section style={{ backgroundColor: INK, padding: "56px 40px 52px" }}>
            <div
              style={{
                width: 48,
                height: 6,
                backgroundColor: mark,
                fontSize: 0,
                lineHeight: "6px",
                marginBottom: 28,
              }}
            >
              &nbsp;
            </div>
            {model.orderDate ? (
              <Text style={{ ...label, color: "#A7A7A9", margin: "0 0 12px" }}>
                {model.orderDate}
              </Text>
            ) : null}
            <Text
              style={{
                color: WHITE,
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: "50px",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {model.stage || "Order update"}
            </Text>
          </Section>

          <Section style={{ padding: "40px 40px 0" }}>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {model.trackingUrl ? (
            <Section style={{ padding: "32px 40px 0" }}>
              <Button
                href={model.trackingUrl}
                style={{
                  backgroundColor: INK,
                  borderRadius: 999,
                  color: WHITE,
                  display: "inline-block",
                  fontSize: 16,
                  fontWeight: 600,
                  padding: "16px 34px",
                  textDecoration: "none",
                }}
              >
                Track order
              </Button>
            </Section>
          ) : null}

          {model.orderNumber || model.orderDate || model.address ? (
            <Section style={{ padding: "44px 40px 0" }}>
              <div style={{ borderTop: `2px solid ${INK}`, fontSize: 0, lineHeight: 0 }}>
                &nbsp;
              </div>
              <Row style={{ marginTop: 20 }}>
                {model.orderNumber ? (
                  <Column style={{ width: "50%", verticalAlign: "top" }}>
                    <Text style={label}>Order</Text>
                    <Text style={value}>{model.orderNumber}</Text>
                  </Column>
                ) : null}
                {model.orderDate ? (
                  <Column style={{ width: "50%", verticalAlign: "top" }}>
                    <Text style={label}>Placed</Text>
                    <Text style={value}>{model.orderDate}</Text>
                  </Column>
                ) : null}
              </Row>
              {model.address ? (
                <>
                  <div
                    style={{
                      borderTop: `1px solid ${HAIRLINE}`,
                      margin: "20px 0",
                      fontSize: 0,
                      lineHeight: 0,
                    }}
                  >
                    &nbsp;
                  </div>
                  <Text style={label}>Shipping to</Text>
                  <Text style={value}>{model.address}</Text>
                </>
              ) : null}
            </Section>
          ) : null}

          <Section style={{ padding: "44px 40px 48px" }}>
            <Text
              style={{
                color: INK,
                fontSize: 15,
                fontWeight: 700,
                margin: "0 0 4px",
              }}
            >
              Questions?
            </Text>
            <Text style={{ color: MUTED, fontSize: 14, lineHeight: "21px", margin: 0 }}>
              Reply to this email
              {model.orderNumber ? ` and quote ${model.orderNumber}` : ""} — a
              real person will get back to you.
            </Text>
          </Section>

          <Section style={{ backgroundColor: PAPER, padding: "32px 40px 36px" }}>
            <Text
              style={{
                color: INK,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              {model.storeName}
            </Text>
            {model.helpUrl ? (
              <Text style={{ fontSize: 12, margin: "0 0 10px" }}>
                <Link
                  href={model.helpUrl}
                  style={{ color: INK, fontWeight: 600, textDecoration: "underline" }}
                >
                  Get help
                </Link>
              </Text>
            ) : null}
            <Text style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: 0 }}>
              {model.footerText}
            </Text>
            {model.postalAddress ? (
              <Text
                style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: "6px 0 0" }}
              >
                {model.postalAddress}
              </Text>
            ) : null}
          </Section>
        </Container>
      </Section>
    </EmailShell>
  );
}
