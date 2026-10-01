import {
  Button,
  Column,
  Container,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components";

import { EmailShell, authoredBody, type EmailModel } from "./shared";

const BLACK = "#000000";
const LIGHT = "#F5F5F5";
const MUTED = "#8C8C8C";
const LINE = "#262626";

const label = {
  color: MUTED,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.28em",
  textTransform: "uppercase" as const,
  margin: 0,
};

function DetailRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <Row style={{ borderBottom: `1px solid ${LINE}` }}>
      <Column style={{ width: 120, padding: "19px 0 14px", verticalAlign: "top" }}>
        <Text style={label}>{name}</Text>
      </Column>
      <Column style={{ padding: "14px 0", verticalAlign: "top" }}>
        <Text style={{ color: LIGHT, fontSize: 14, lineHeight: "21px", margin: 0 }}>
          {children}
        </Text>
      </Column>
    </Row>
  );
}

/**
 * Noir: a black canvas, light type, a wordmark tracked out to the edges.
 *
 * It always sets the store name as a wordmark instead of the uploaded logo.
 * Most logos are drawn dark for a white page and would vanish here; the
 * typography is what makes this design, so it does not need one.
 */
export function NoirLayout({ model }: { model: EmailModel }) {
  const body = authoredBody(model.html, {
    text: "#D4D4D4",
    muted: MUTED,
    link: LIGHT,
    size: model.size - 1,
  });

  return (
    <EmailShell model={model} background={BLACK} dark>
      <Section style={{ padding: "56px 16px 64px" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Section style={{ textAlign: "center", padding: "0 0 64px" }}>
            <Text
              style={{
                color: LIGHT,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.42em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {model.storeName}
            </Text>
          </Section>

          <Section style={{ textAlign: "center", padding: "0 8px" }}>
            {model.orderNumber ? (
              <Text style={{ ...label, margin: "0 0 22px" }}>
                Order {model.orderNumber}
              </Text>
            ) : null}
            <Text
              style={{
                color: LIGHT,
                fontSize: 34,
                fontWeight: 300,
                letterSpacing: "0.14em",
                lineHeight: "44px",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {model.stage || "Order update"}
            </Text>
          </Section>

          <Section style={{ padding: "44px 24px 0", textAlign: "center" }}>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {model.trackingUrl ? (
            <Section style={{ textAlign: "center", padding: "40px 0 0" }}>
              <Button
                href={model.trackingUrl}
                style={{
                  backgroundColor: LIGHT,
                  borderRadius: 0,
                  color: BLACK,
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.3em",
                  padding: "18px 40px",
                  textDecoration: "none",
                  textTransform: "uppercase",
                }}
              >
                Track order
              </Button>
            </Section>
          ) : null}

          {model.orderDate || model.address ? (
            <Section style={{ padding: "64px 8px 0" }}>
              <div style={{ borderTop: `1px solid ${LINE}`, fontSize: 0, lineHeight: 0 }}>
                &nbsp;
              </div>
              {model.orderDate ? <DetailRow name="Placed">{model.orderDate}</DetailRow> : null}
              {model.address ? <DetailRow name="Delivery">{model.address}</DetailRow> : null}
            </Section>
          ) : null}

          <Section style={{ textAlign: "center", padding: "56px 16px 0" }}>
            <Text style={{ color: MUTED, fontSize: 12, lineHeight: "19px", margin: "0 0 18px" }}>
              Questions? Reply to this email
              {model.orderNumber ? ` and quote ${model.orderNumber}` : ""}.
            </Text>
            {model.helpUrl ? (
              <Text style={{ ...label, margin: "0 0 18px" }}>
                <Link href={model.helpUrl} style={{ color: LIGHT, textDecoration: "none" }}>
                  Client services
                </Link>
              </Text>
            ) : null}
            <Text style={{ color: "#5C5C5C", fontSize: 11, lineHeight: "17px", margin: 0 }}>
              {model.footerText}
            </Text>
            {model.postalAddress ? (
              <Text
                style={{ color: "#5C5C5C", fontSize: 11, lineHeight: "17px", margin: "6px 0 0" }}
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
