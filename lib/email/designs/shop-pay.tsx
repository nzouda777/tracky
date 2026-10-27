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

import { checkpoints, isOffRoute } from "./journey";
import { EmailShell, authoredBody, mix, type EmailModel } from "./shared";

const PAGE = "#F4F4F5";
const WHITE = "#FFFFFF";
const INK = "#0B0B0F";
const MUTED = "#6B6B76";
const LINE = "#E6E6EA";
/** Shop Pay's purple — the one colour this design is recognised by. */
const PURPLE = "#5A31F4";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function Card({
  children,
  padding = "24px",
}: {
  children: React.ReactNode;
  padding?: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: WHITE,
        borderRadius: 20,
        padding,
        margin: "0 0 12px",
      }}
    >
      {children}
    </Section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: MUTED,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "18px",
        margin: "0 0 4px",
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Shop Pay: the look of the Shop app's order updates. Rounded white cards on
 * a pale grey page, a bold status, a purple progress line with dots, a full
 * width purple pill to track the order, then the items and the delivery
 * address as cards of their own. The purple is fixed — it is what makes the
 * design read as Shop Pay — while the masthead stays the store's own logo.
 */
export function ShopPayLayout({ model }: { model: EmailModel }) {
  const steps = checkpoints(model.stage);
  const offRoute = isOffRoute(model.stage);
  const track = mix(PURPLE, WHITE, 0.16);
  const body = authoredBody(model.html, {
    text: INK,
    muted: MUTED,
    link: PURPLE,
    size: model.size - 1,
  });

  const items = model.order?.items ?? [];
  const addressLines = model.order?.addressLines.length
    ? model.order.addressLines
    : model.address
      ? [model.address]
      : [];

  return (
    <EmailShell model={model} background={PAGE} font={SANS}>
      <Container style={{ maxWidth: 480, margin: "0 auto", padding: "32px 12px 40px" }}>
        <Section style={{ padding: "0 8px 20px", textAlign: "center" }}>
          {model.logoUrl ? (
            <Img
              src={model.logoUrl}
              alt={model.storeName}
              style={{ display: "inline-block", maxHeight: 36, maxWidth: 160, height: "auto" }}
            />
          ) : (
            <Text style={{ color: INK, fontSize: 18, fontWeight: 700, margin: 0 }}>
              {model.storeName}
            </Text>
          )}
        </Section>

        <Card padding="28px 24px">
          {model.orderNumber ? (
            <Label>
              Order {model.orderNumber}
              {model.orderDate ? ` · ${model.orderDate}` : ""}
            </Label>
          ) : null}
          <Text
            style={{
              color: INK,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: "34px",
              margin: 0,
            }}
          >
            {model.stage || "Order confirmed"}
          </Text>

          {offRoute ? null : (
            <Section style={{ padding: "24px 0 0" }}>
              <Row>
                {steps.map((step, index) => {
                  const reached = step.state !== "next";
                  return (
                    <Column
                      key={index}
                      style={{ width: "33.33%", verticalAlign: "top" }}
                    >
                      <Row>
                        <Column style={{ width: 14, verticalAlign: "middle" }}>
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 999,
                              backgroundColor: reached ? PURPLE : track,
                              fontSize: 0,
                              lineHeight: "14px",
                            }}
                          >
                            &nbsp;
                          </div>
                        </Column>
                        {index < steps.length - 1 ? (
                          <Column style={{ verticalAlign: "middle", padding: "0 4px" }}>
                            <div
                              style={{
                                height: 4,
                                borderRadius: 999,
                                backgroundColor:
                                  steps[index + 1].state !== "next" ? PURPLE : track,
                                fontSize: 0,
                                lineHeight: "4px",
                              }}
                            >
                              &nbsp;
                            </div>
                          </Column>
                        ) : null}
                      </Row>
                      <Text
                        style={{
                          color: reached ? INK : MUTED,
                          fontSize: 12,
                          fontWeight: step.state === "now" ? 700 : 500,
                          lineHeight: "16px",
                          margin: "8px 4px 0 0",
                        }}
                      >
                        {step.name}
                      </Text>
                    </Column>
                  );
                })}
              </Row>
            </Section>
          )}

          <Section style={{ padding: "24px 0 0" }}>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {model.trackingUrl ? (
            <Section style={{ padding: "24px 0 0" }}>
              <Button
                href={model.trackingUrl}
                style={{
                  backgroundColor: PURPLE,
                  borderRadius: 999,
                  color: WHITE,
                  display: "block",
                  fontSize: 16,
                  fontWeight: 600,
                  padding: "15px 24px",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                Track order
              </Button>
            </Section>
          ) : null}
        </Card>

        {items.length > 0 ? (
          <Card>
            <Label>Items</Label>
            {items.map((item, index) => (
              <Row
                key={index}
                style={{
                  borderBottom:
                    index === items.length - 1 ? undefined : `1px solid ${LINE}`,
                }}
              >
                <Column style={{ padding: "12px 0", verticalAlign: "top" }}>
                  <Text style={{ color: INK, fontSize: 15, fontWeight: 600, lineHeight: "20px", margin: 0 }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 13, lineHeight: "18px", margin: "2px 0 0" }}>
                    {[item.variant, `Qty ${item.quantity}`].filter(Boolean).join(" · ")}
                  </Text>
                </Column>
                <Column align="right" style={{ padding: "12px 0", verticalAlign: "top", width: "32%" }}>
                  <Text style={{ color: INK, fontSize: 15, fontWeight: 600, margin: 0, textAlign: "right" }}>
                    {item.price}
                  </Text>
                </Column>
              </Row>
            ))}
            {model.order?.total ? (
              <Row style={{ borderTop: `1px solid ${LINE}` }}>
                <Column style={{ padding: "14px 0 0" }}>
                  <Text style={{ color: INK, fontSize: 15, fontWeight: 700, margin: 0 }}>Total</Text>
                </Column>
                <Column align="right" style={{ padding: "14px 0 0" }}>
                  <Text style={{ color: INK, fontSize: 15, fontWeight: 700, margin: 0, textAlign: "right" }}>
                    {model.order.total}
                  </Text>
                </Column>
              </Row>
            ) : null}
          </Card>
        ) : null}

        {addressLines.length > 0 ? (
          <Card>
            <Label>Delivering to</Label>
            {addressLines.map((line, index) => (
              <Text
                key={index}
                style={{
                  color: INK,
                  fontSize: 15,
                  fontWeight: index === 0 ? 600 : 400,
                  lineHeight: "22px",
                  margin: 0,
                }}
              >
                {line}
              </Text>
            ))}
          </Card>
        ) : null}

        <Section style={{ padding: "16px 12px 0", textAlign: "center" }}>
          <Text style={{ color: MUTED, fontSize: 13, lineHeight: "20px", margin: 0 }}>
            Questions about your order? Reply to this email
            {model.helpUrl ? (
              <>
                {" or "}
                <Link href={model.helpUrl} style={{ color: PURPLE, fontWeight: 600 }}>
                  get help
                </Link>
              </>
            ) : null}
            .
          </Text>
          <Text style={{ color: MUTED, fontSize: 11, lineHeight: "17px", margin: "16px 0 0" }}>
            {model.footerText}
          </Text>
          {model.postalAddress ? (
            <Text style={{ color: MUTED, fontSize: 11, lineHeight: "17px", margin: "4px 0 0" }}>
              {model.postalAddress}
            </Text>
          ) : null}
        </Section>
      </Container>
    </EmailShell>
  );
}
