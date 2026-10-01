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
import { EmailShell, authoredBody, type EmailModel } from "./shared";

const WHITE = "#FFFFFF";
const INK = "#1D1D1F";
const MUTED = "#6E6E73";
const PANEL = "#F5F5F7";
const LINE = "#E3E3E8";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function ReceiptRow({
  name,
  value,
  last = false,
}: {
  name: string;
  value: string;
  last?: boolean;
}) {
  return (
    <Row style={last ? undefined : { borderBottom: `1px solid ${LINE}` }}>
      <Column style={{ padding: "12px 0", verticalAlign: "top", width: "38%" }}>
        <Text style={{ color: MUTED, fontSize: 13, lineHeight: "19px", margin: 0 }}>
          {name}
        </Text>
      </Column>
      <Column align="right" style={{ padding: "12px 0", verticalAlign: "top" }}>
        <Text
          style={{
            color: INK,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: "19px",
            margin: 0,
            textAlign: "right",
          }}
        >
          {value}
        </Text>
      </Column>
    </Row>
  );
}

/**
 * Minimal: precise and quiet. A centred mark, a tight headline, one pill
 * button in the brand colour and the order facts as a soft grey receipt.
 */
export function MinimalLayout({ model }: { model: EmailModel }) {
  const body = authoredBody(model.html, {
    text: INK,
    muted: MUTED,
    link: model.link,
    size: model.size - 1,
  });

  const rows = [
    model.orderNumber && { name: "Order number", value: model.orderNumber },
    model.orderDate && { name: "Order date", value: model.orderDate },
    model.stage && { name: "Status", value: model.stage },
    model.address && { name: "Delivering to", value: model.address },
  ].filter(Boolean) as { name: string; value: string }[];

  return (
    <EmailShell model={model} background={WHITE} font={SANS}>
      <Section style={{ padding: "48px 16px 56px" }}>
        <Container style={{ maxWidth: 520, margin: "0 auto" }}>
          <Section style={{ textAlign: "center", padding: "0 0 44px" }}>
            {model.logoUrl ? (
              <Img
                src={model.logoUrl}
                alt={model.storeName}
                style={{
                  display: "inline-block",
                  maxHeight: 32,
                  maxWidth: 160,
                  height: "auto",
                }}
              />
            ) : (
              <Text
                style={{
                  color: INK,
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {model.storeName}
              </Text>
            )}
          </Section>

          <Section style={{ textAlign: "center", padding: "0 8px" }}>
            <Text
              style={{
                color: INK,
                fontSize: 34,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: "40px",
                margin: 0,
              }}
            >
              {model.stage || "Your order update"}
            </Text>
            {model.orderNumber ? (
              <Text style={{ color: MUTED, fontSize: 15, lineHeight: "22px", margin: "10px 0 0" }}>
                Order {model.orderNumber}
              </Text>
            ) : null}
          </Section>

          {model.trackingUrl ? (
            <Section style={{ textAlign: "center", padding: "28px 0 0" }}>
              <Button
                href={model.trackingUrl}
                style={{
                  backgroundColor: model.accent,
                  borderRadius: 999,
                  color: readableOn(model.accent, INK),
                  display: "inline-block",
                  fontSize: 15,
                  fontWeight: 500,
                  padding: "12px 28px",
                  textDecoration: "none",
                }}
              >
                Track your order
              </Button>
            </Section>
          ) : null}

          <Section style={{ padding: "44px 4px 0" }}>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {rows.length > 0 ? (
            <Section style={{ padding: "32px 0 0" }}>
              <Section
                style={{ backgroundColor: PANEL, borderRadius: 14, padding: "8px 20px" }}
              >
                {rows.map((row, index) => (
                  <ReceiptRow
                    key={row.name}
                    name={row.name}
                    value={row.value}
                    last={index === rows.length - 1}
                  />
                ))}
              </Section>
            </Section>
          ) : null}

          <Section style={{ padding: "40px 4px 0", textAlign: "center" }}>
            <Text style={{ color: MUTED, fontSize: 13, lineHeight: "20px", margin: "0 0 20px" }}>
              Need anything? Just reply to this email.
              {model.helpUrl ? (
                <>
                  {" "}
                  <Link href={model.helpUrl} style={{ color: model.link }}>
                    Get support
                  </Link>
                </>
              ) : null}
            </Text>
            <div style={{ borderTop: `1px solid ${LINE}`, fontSize: 0, lineHeight: 0 }}>
              &nbsp;
            </div>
            <Text style={{ color: "#86868B", fontSize: 11, lineHeight: "17px", margin: "20px 0 0" }}>
              {model.footerText}
            </Text>
            {model.postalAddress ? (
              <Text style={{ color: "#86868B", fontSize: 11, lineHeight: "17px", margin: "4px 0 0" }}>
                {model.postalAddress}
              </Text>
            ) : null}
          </Section>
        </Container>
      </Section>
    </EmailShell>
  );
}
