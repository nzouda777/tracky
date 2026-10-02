import { Column, Container, Img, Link, Row, Section, Text } from "@react-email/components";

import { EmailShell, authoredBody, type EmailModel } from "./shared";

const WHITE = "#FFFFFF";
const BLACK = "#000000";
const GREY = "#6B6B6B";
const DIDONE = "Didot, 'Bodoni 72', 'Bodoni MT', 'Playfair Display', Georgia, serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const small = {
  color: BLACK,
  fontFamily: SANS,
  fontSize: 11,
  letterSpacing: "0.08em",
  lineHeight: "16px",
  textTransform: "uppercase" as const,
  margin: 0,
};

/**
 * Atelier: fashion-house restraint. An oversized Didone wordmark, then
 * everything else set small, uppercase and left-aligned on pure white — the
 * contrast between the two is the whole design. No colour, no button fill:
 * the call to action is an underlined line of type.
 */
export function AtelierLayout({ model }: { model: EmailModel }) {
  const body = authoredBody(model.html, {
    text: BLACK,
    muted: GREY,
    link: BLACK,
    size: 13,
  });

  const facts = [
    model.orderNumber && ["Order", model.orderNumber],
    model.orderDate && ["Date", model.orderDate],
    model.address && ["Delivery", model.address],
  ].filter(Boolean) as [string, string][];

  return (
    <EmailShell model={model} background={WHITE} font={SANS}>
      <Container style={{ maxWidth: 600, margin: "0 auto", backgroundColor: WHITE }}>
        <Section style={{ padding: "56px 32px 0", textAlign: "center" }}>
          {model.logoUrl ? (
            <Img
              src={model.logoUrl}
              alt={model.storeName}
              style={{ display: "inline-block", maxHeight: 44, maxWidth: 240, height: "auto" }}
            />
          ) : (
            <Text
              style={{
                color: BLACK,
                fontFamily: DIDONE,
                fontSize: 52,
                fontWeight: 400,
                letterSpacing: "0.04em",
                lineHeight: "52px",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {model.storeName}
            </Text>
          )}
        </Section>

        <Section style={{ padding: "72px 32px 0" }}>
          <Text style={{ ...small, color: GREY, margin: "0 0 10px" }}>
            {model.orderNumber ? `Order ${model.orderNumber}` : "Order update"}
          </Text>
          <Text
            style={{
              ...small,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.1em",
              lineHeight: "20px",
            }}
          >
            {model.stage || "Your order"}
          </Text>
        </Section>

        <Section style={{ padding: "28px 32px 0", fontFamily: SANS }}>
          <div dangerouslySetInnerHTML={{ __html: body }} />
        </Section>

        {model.trackingUrl ? (
          <Section style={{ padding: "32px 32px 0" }}>
            <Link
              href={model.trackingUrl}
              style={{
                ...small,
                fontWeight: 600,
                letterSpacing: "0.14em",
                borderBottom: `1px solid ${BLACK}`,
                paddingBottom: 3,
                textDecoration: "none",
              }}
            >
              Track order
            </Link>
          </Section>
        ) : null}

        {facts.length > 0 ? (
          <Section style={{ padding: "64px 32px 0" }}>
            {facts.map(([name, value], index) => (
              <Row
                key={name}
                style={{
                  borderTop: `1px solid ${BLACK}`,
                  borderBottom: index === facts.length - 1 ? `1px solid ${BLACK}` : undefined,
                }}
              >
                <Column style={{ width: 120, padding: "12px 0", verticalAlign: "top" }}>
                  <Text style={{ ...small, color: GREY }}>{name}</Text>
                </Column>
                <Column style={{ padding: "12px 0", verticalAlign: "top" }}>
                  <Text style={{ ...small, letterSpacing: "0.04em" }}>{value}</Text>
                </Column>
              </Row>
            ))}
          </Section>
        ) : null}

        <Section style={{ padding: "64px 32px 56px" }}>
          <Text style={{ ...small, margin: "0 0 14px" }}>
            Questions? Reply to this email.
            {model.helpUrl ? (
              <>
                {"  "}
                <Link href={model.helpUrl} style={{ color: BLACK, textDecoration: "underline" }}>
                  Help
                </Link>
              </>
            ) : null}
          </Text>
          <Text style={{ ...small, color: GREY, fontSize: 10, textTransform: "none", letterSpacing: "0.02em" }}>
            {model.footerText}
          </Text>
          {model.postalAddress ? (
            <Text
              style={{
                ...small,
                color: GREY,
                fontSize: 10,
                textTransform: "none",
                letterSpacing: "0.02em",
                margin: "4px 0 0",
              }}
            >
              {model.postalAddress}
            </Text>
          ) : null}
        </Section>
      </Container>
    </EmailShell>
  );
}
