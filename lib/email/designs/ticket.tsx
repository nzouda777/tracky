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

import { EmailShell, MONO, authoredBody, mix, visibleOn, type EmailModel } from "./shared";

const GROUND = "#EEF1F5";
const WHITE = "#FFFFFF";
const INK = "#14213D";
const MUTED = "#6B7486";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const label = {
  color: MUTED,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.16em",
  lineHeight: "14px",
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

const value = {
  color: INK,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: "-0.01em",
  lineHeight: "23px",
  margin: 0,
};

/**
 * A barcode drawn from the order number, as table cells. Each character sets
 * a bar's width, so the same order always gets the same code — decorative,
 * but stable, and it survives clients that strip background images.
 */
function Barcode({ seed }: { seed: string }) {
  const source = (seed || "TRACKING").repeat(4).slice(0, 28);
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        <tr>
          {source.split("").flatMap((char, index) => {
            const code = char.charCodeAt(0);
            return [
              <td
                key={`b${index}`}
                style={{
                  width: (code % 3) + 1,
                  height: 42,
                  backgroundColor: INK,
                  fontSize: 0,
                  lineHeight: "42px",
                }}
              >
                &nbsp;
              </td>,
              <td
                key={`s${index}`}
                style={{ width: (code % 2) + 2, height: 42, fontSize: 0, lineHeight: "42px" }}
              >
                &nbsp;
              </td>,
            ];
          })}
        </tr>
      </tbody>
    </table>
  );
}

/**
 * The perforation between ticket and stub: a dashed rule with a half-circle
 * bitten out of each edge. The bites are cells in the page's own ground with
 * rounded inner corners — clients that drop the radius show a square notch,
 * which still reads as a tear line.
 */
function Tear() {
  const bite = { width: 14, height: 28, backgroundColor: GROUND, fontSize: 0, lineHeight: "28px" };
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td style={{ ...bite, borderRadius: "0 14px 14px 0" }}>&nbsp;</td>
          <td style={{ padding: "0 10px" }}>
            <div style={{ borderTop: `2px dashed ${mix(INK, WHITE, 0.18)}`, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
          </td>
          <td style={{ ...bite, borderRadius: "14px 0 0 14px" }}>&nbsp;</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Boarding pass: the order drawn as a ticket. A header strip in the brand
 * colour, the route from order date to destination, the status set large,
 * then a perforation and a barcode stub. The owner's message sits above the
 * ticket and the button below it, like a check-in email.
 */
export function TicketLayout({ model }: { model: EmailModel }) {
  const accent = model.accent;
  const onAccent = visibleOn(WHITE, accent, INK);
  const link = visibleOn(model.link, WHITE, INK);
  const body = authoredBody(model.html, {
    text: INK,
    muted: MUTED,
    link,
    size: model.size,
  });

  return (
    <EmailShell model={model} background={GROUND} font={SANS}>
      <Section style={{ padding: "36px 12px 48px" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Section style={{ padding: "0 8px 24px" }}>
            {model.logoUrl ? (
              <Img
                src={model.logoUrl}
                alt={model.storeName}
                style={{ display: "block", maxHeight: 32, maxWidth: 170, height: "auto" }}
              />
            ) : (
              <Text style={{ color: INK, fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>
                {model.storeName}
              </Text>
            )}
          </Section>

          <Section style={{ padding: "0 8px 28px" }}>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {/* The ticket */}
          <Section style={{ backgroundColor: WHITE, borderRadius: 18 }}>
            <Section style={{ backgroundColor: accent, borderRadius: "18px 18px 0 0", padding: "14px 24px" }}>
              <Row>
                <Column>
                  <Text style={{ ...label, color: onAccent, margin: 0 }}>{model.storeName}</Text>
                </Column>
                <Column style={{ textAlign: "right" }}>
                  <Text style={{ ...label, color: onAccent, margin: 0 }}>Boarding pass</Text>
                </Column>
              </Row>
            </Section>

            <Section style={{ padding: "24px 24px 0" }}>
              <Row>
                <Column style={{ width: "42%", verticalAlign: "top" }}>
                  <Text style={label}>Ordered</Text>
                  <Text style={value}>{model.orderDate || "—"}</Text>
                </Column>
                <Column style={{ width: "16%", verticalAlign: "middle", textAlign: "center" }}>
                  <Text style={{ color: accent, fontSize: 22, lineHeight: "22px", margin: 0 }}>&#9992;</Text>
                </Column>
                <Column style={{ width: "42%", verticalAlign: "top", textAlign: "right" }}>
                  <Text style={label}>Flight</Text>
                  <Text style={{ ...value, fontFamily: MONO }}>{model.orderNumber || "—"}</Text>
                </Column>
              </Row>
            </Section>

            <Section style={{ padding: "20px 24px 0" }}>
              <Section
                style={{
                  borderTop: `1px solid ${mix(INK, WHITE, 0.1)}`,
                  borderBottom: `1px solid ${mix(INK, WHITE, 0.1)}`,
                  padding: "16px 0",
                }}
              >
                <Text style={label}>Status</Text>
                <Text
                  style={{
                    color: INK,
                    fontSize: 32,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    lineHeight: "36px",
                    margin: 0,
                  }}
                >
                  {model.stage || "Order received"}
                </Text>
              </Section>
            </Section>

            {/* The whole address, as Shopify formatted it. Picking a city out
                of that one line would guess wrong whenever a part is missing
                or a company name has a comma in it. */}
            {model.address ? (
              <Section style={{ padding: "16px 24px 0" }}>
                <Text style={label}>Destination</Text>
                <Text style={{ color: INK, fontSize: 14, fontWeight: 600, lineHeight: "20px", margin: 0 }}>
                  {model.address}
                </Text>
              </Section>
            ) : null}
            <Section style={{ padding: "20px 0 0" }} />

            <Tear />

            <Section style={{ padding: "18px 24px 24px" }}>
              <Row>
                <Column style={{ verticalAlign: "middle" }}>
                  <Barcode seed={model.orderNumber} />
                </Column>
                <Column style={{ verticalAlign: "middle", textAlign: "right" }}>
                  <Text style={{ color: INK, fontFamily: MONO, fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {model.orderNumber}
                  </Text>
                </Column>
              </Row>
            </Section>
          </Section>

          {model.trackingUrl ? (
            <Section style={{ padding: "24px 0 0", textAlign: "center" }}>
              <Button
                href={model.trackingUrl}
                style={{
                  backgroundColor: INK,
                  borderRadius: 12,
                  color: WHITE,
                  display: "block",
                  fontSize: 15,
                  fontWeight: 700,
                  padding: "16px 24px",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                View live status
              </Button>
            </Section>
          ) : null}

          <Section style={{ padding: "28px 8px 0", textAlign: "center" }}>
            <Text style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: 0 }}>
              Questions about your order? Reply to this email.
              {model.helpUrl ? (
                <>
                  {" "}
                  <Link href={model.helpUrl} style={{ color: INK, fontWeight: 700, textDecoration: "underline" }}>
                    Help centre
                  </Link>
                </>
              ) : null}
            </Text>
            <Text style={{ color: MUTED, fontSize: 11, lineHeight: "17px", margin: "12px 0 0" }}>
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
