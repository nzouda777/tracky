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

import { EmailShell, authoredBody, visibleOn, type EmailModel } from "./shared";

const BLACK = "#000000";
const WHITE = "#FFFFFF";
const PANEL = "#F6F6F6";
const MUTED = "#666666";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * The black-and-white stripe band, as table cells rather than a gradient:
 * `linear-gradient` backgrounds are dropped by Outlook and most of Gmail, and
 * a band that silently disappears would take the design's signature with it.
 */
function Stripes() {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
    >
      <tbody>
        <tr>
          {Array.from({ length: 24 }, (_, index) => (
            <td
              key={index}
              style={{
                backgroundColor: index % 2 === 0 ? BLACK : WHITE,
                height: 14,
                fontSize: 0,
                lineHeight: "14px",
              }}
            >
              &nbsp;
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function Stat({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: string;
}) {
  return (
    <Column style={{ width, padding: "0 6px", verticalAlign: "top", textAlign: "center" }}>
      <Text
        style={{
          color: MUTED,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          margin: "0 0 4px",
        }}
      >
        {label}
      </Text>
      <Text style={{ color: BLACK, fontSize: 14, fontWeight: 700, lineHeight: "19px", margin: 0 }}>
        {value}
      </Text>
    </Column>
  );
}

/**
 * Beauté: beauty-retail energy. A black masthead over a black-and-white stripe
 * band, a bold headline with the brand colour as its one accent, a stat strip
 * and a solid black button. Graphic, upbeat, unmistakable in an inbox.
 */
export function BeauteLayout({ model }: { model: EmailModel }) {
  const accent = visibleOn(model.accent, WHITE, BLACK);
  const body = authoredBody(model.html, {
    text: BLACK,
    muted: MUTED,
    link: BLACK,
    size: model.size - 1,
  });

  const stats = [
    model.orderNumber && { label: "Order", value: model.orderNumber },
    model.orderDate && { label: "Placed", value: model.orderDate },
    model.stage && { label: "Status", value: model.stage },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <EmailShell model={model} background={PANEL} font={SANS}>
      <Section style={{ padding: "24px 0 40px" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", backgroundColor: WHITE }}>
          {/* A logo is drawn for a light ground; only the wordmark sits on black. */}
          <Section
            style={{
              backgroundColor: model.logoUrl ? WHITE : BLACK,
              padding: "26px 32px",
              textAlign: "center",
            }}
          >
            {model.logoUrl ? (
              <Img
                src={model.logoUrl}
                alt={model.storeName}
                style={{ display: "inline-block", maxHeight: 30, maxWidth: 180, height: "auto" }}
              />
            ) : (
              <Text
                style={{
                  color: WHITE,
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {model.storeName}
              </Text>
            )}
          </Section>
          <Stripes />

          <Section style={{ padding: "44px 36px 0", textAlign: "center" }}>
            <Text
              style={{
                color: accent,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              Order update
            </Text>
            <Text
              style={{
                color: BLACK,
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: "38px",
                margin: 0,
              }}
            >
              {/* No exclamation mark: the stage may be "Delayed" or "Cancelled". */}
              {model.stage || "Order update"}
            </Text>
          </Section>

          <Section style={{ padding: "24px 44px 0", textAlign: "center" }}>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {model.trackingUrl ? (
            <Section style={{ padding: "32px 36px 0", textAlign: "center" }}>
              <Button
                href={model.trackingUrl}
                style={{
                  backgroundColor: BLACK,
                  borderRadius: 0,
                  color: WHITE,
                  display: "inline-block",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  padding: "17px 48px",
                  textDecoration: "none",
                  textTransform: "uppercase",
                }}
              >
                Track my order
              </Button>
            </Section>
          ) : null}

          {stats.length > 0 ? (
            <Section style={{ padding: "40px 30px 0" }}>
              <Section style={{ backgroundColor: PANEL, padding: "20px 8px" }}>
                <Row>
                  {stats.map((stat) => (
                    <Stat
                      key={stat.label}
                      label={stat.label}
                      value={stat.value}
                      width={`${Math.floor(100 / stats.length)}%`}
                    />
                  ))}
                </Row>
              </Section>
            </Section>
          ) : null}

          {model.address ? (
            <Section style={{ padding: "16px 36px 0", textAlign: "center" }}>
              <Text style={{ color: MUTED, fontSize: 13, lineHeight: "19px", margin: 0 }}>
                <strong style={{ color: BLACK }}>Shipping to:</strong> {model.address}
              </Text>
            </Section>
          ) : null}

          <Section style={{ padding: "40px 36px 36px", textAlign: "center" }}>
            <Text style={{ color: BLACK, fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>
              Need a hand?
            </Text>
            <Text style={{ color: MUTED, fontSize: 13, lineHeight: "19px", margin: 0 }}>
              Just reply to this email
              {model.orderNumber ? ` with ${model.orderNumber}` : ""}.
              {model.helpUrl ? (
                <>
                  {" "}
                  <Link href={model.helpUrl} style={{ color: BLACK, fontWeight: 700 }}>
                    Visit our help centre
                  </Link>
                </>
              ) : null}
            </Text>
          </Section>
          <Stripes />
        </Container>

        <Container style={{ maxWidth: 600, margin: "0 auto" }}>
          <Section style={{ padding: "20px 32px 0", textAlign: "center" }}>
            <Text style={{ color: MUTED, fontSize: 11, lineHeight: "17px", margin: 0 }}>
              {model.footerText}
            </Text>
            {model.postalAddress ? (
              <Text style={{ color: MUTED, fontSize: 11, lineHeight: "17px", margin: "4px 0 0" }}>
                {model.postalAddress}
              </Text>
            ) : null}
          </Section>
        </Container>
      </Section>
    </EmailShell>
  );
}
