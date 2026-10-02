import { Button, Container, Img, Link, Section, Text } from "@react-email/components";

import { monogramOf } from "@/lib/utils";
import { EmailShell, SERIF, authoredBody, type EmailModel } from "./shared";

const CREAM = "#F7F3EC";
const PAPER = "#FFFDF9";
const BROWN = "#3B2A1E";
const GOLD = "#B89B5E";
const MUTED = "#8A7A68";

const smallCaps = {
  color: MUTED,
  fontFamily: SERIF,
  fontSize: 11,
  letterSpacing: "0.3em",
  textTransform: "uppercase" as const,
  margin: 0,
};

function GoldRule({ width = 40 }: { width?: number }) {
  return (
    <div
      style={{
        width,
        borderTop: `1px solid ${GOLD}`,
        margin: "0 auto",
        fontSize: 0,
        lineHeight: 0,
      }}
    >
      &nbsp;
    </div>
  );
}

/**
 * Maison: the luxury house letter. A monogram in a gold ring, a double-framed
 * card on cream, centred serif set in small capitals and a deep brown button.
 * It reads like a note from a client adviser rather than a system message.
 *
 * The double frame is two nested bordered boxes, not `outline` or
 * `border-style: double`, both of which several clients ignore.
 */
export function MaisonLayout({ model }: { model: EmailModel }) {
  const body = authoredBody(model.html, {
    text: BROWN,
    muted: MUTED,
    link: BROWN,
    size: model.size,
    headingFont: SERIF,
  });

  return (
    <EmailShell model={model} background={CREAM} font={SERIF}>
      <Section style={{ padding: "48px 14px 56px" }}>
        <Container style={{ maxWidth: 580, margin: "0 auto" }}>
          <Section style={{ textAlign: "center", padding: "0 0 32px" }}>
            {model.logoUrl ? (
              <Img
                src={model.logoUrl}
                alt={model.storeName}
                style={{ display: "inline-block", maxHeight: 36, maxWidth: 180, height: "auto" }}
              />
            ) : (
              <>
                <table
                  role="presentation"
                  align="center"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ margin: "0 auto" }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          width: 64,
                          height: 64,
                          border: `1px solid ${GOLD}`,
                          borderRadius: 32,
                          textAlign: "center",
                          verticalAlign: "middle",
                          color: BROWN,
                          fontFamily: SERIF,
                          fontSize: 22,
                          letterSpacing: "0.08em",
                        }}
                      >
                        {monogramOf(model.storeName)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <Text style={{ ...smallCaps, color: BROWN, margin: "16px 0 0", letterSpacing: "0.38em" }}>
                  {model.storeName}
                </Text>
              </>
            )}
          </Section>

          <Section style={{ border: `1px solid ${GOLD}`, padding: 6, backgroundColor: PAPER }}>
            <Section style={{ border: `1px solid ${GOLD}`, padding: "48px 36px 44px", textAlign: "center" }}>
              {model.orderNumber ? (
                <Text style={{ ...smallCaps, margin: "0 0 18px" }}>
                  Order {model.orderNumber}
                </Text>
              ) : null}
              <Text
                style={{
                  color: BROWN,
                  fontFamily: SERIF,
                  fontSize: 30,
                  fontWeight: 400,
                  letterSpacing: "0.06em",
                  lineHeight: "38px",
                  textTransform: "uppercase",
                  margin: "0 0 22px",
                }}
              >
                {model.stage || "Your order"}
              </Text>
              <GoldRule />

              <Section style={{ padding: "28px 4px 0" }}>
                <div dangerouslySetInnerHTML={{ __html: body }} />
              </Section>

              {model.trackingUrl ? (
                <Section style={{ padding: "30px 0 0" }}>
                  <Button
                    href={model.trackingUrl}
                    style={{
                      backgroundColor: BROWN,
                      borderRadius: 0,
                      color: CREAM,
                      display: "inline-block",
                      fontFamily: SERIF,
                      fontSize: 12,
                      letterSpacing: "0.28em",
                      padding: "16px 36px",
                      textDecoration: "none",
                      textTransform: "uppercase",
                    }}
                  >
                    Follow my order
                  </Button>
                </Section>
              ) : null}

              {model.address || model.orderDate ? (
                <Section style={{ padding: "36px 0 0" }}>
                  <GoldRule width={120} />
                  {model.orderDate ? (
                    <>
                      <Text style={{ ...smallCaps, margin: "24px 0 6px" }}>Ordered on</Text>
                      <Text style={{ color: BROWN, fontFamily: SERIF, fontSize: 15, margin: 0 }}>
                        {model.orderDate}
                      </Text>
                    </>
                  ) : null}
                  {model.address ? (
                    <>
                      <Text style={{ ...smallCaps, margin: "20px 0 6px" }}>Delivery address</Text>
                      <Text
                        style={{
                          color: BROWN,
                          fontFamily: SERIF,
                          fontSize: 15,
                          fontStyle: "italic",
                          lineHeight: "22px",
                          margin: 0,
                        }}
                      >
                        {model.address}
                      </Text>
                    </>
                  ) : null}
                </Section>
              ) : null}

              <Text
                style={{
                  color: BROWN,
                  fontFamily: SERIF,
                  fontSize: 15,
                  fontStyle: "italic",
                  margin: "40px 0 0",
                }}
              >
                Your client adviser is one reply away.
              </Text>
            </Section>
          </Section>

          <Section style={{ textAlign: "center", padding: "28px 16px 0" }}>
            {model.helpUrl ? (
              <Text style={{ ...smallCaps, margin: "0 0 14px" }}>
                <Link href={model.helpUrl} style={{ color: BROWN, textDecoration: "none" }}>
                  Client services
                </Link>
              </Text>
            ) : null}
            <Text style={{ color: MUTED, fontFamily: SERIF, fontSize: 11, lineHeight: "17px", margin: 0 }}>
              {model.footerText}
            </Text>
            {model.postalAddress ? (
              <Text
                style={{ color: MUTED, fontFamily: SERIF, fontSize: 11, lineHeight: "17px", margin: "4px 0 0" }}
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
