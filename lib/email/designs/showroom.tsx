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

const WHITE = "#FFFFFF";
const INK = "#111418";
const MUTED = "#5F6670";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const fact = {
  color: MUTED,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  lineHeight: "15px",
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

/**
 * Showroom: the email split down the middle, like the page of the same name.
 * The left column is a solid block of the brand colour carrying the store,
 * the status and the order number; the right column lists the facts. Below
 * the split, the owner's message runs full width beside a thick brand rule,
 * and the button is a square-cornered block.
 *
 * Two columns at 600px are the one place this layout gambles on width; the
 * columns are percentages, so a phone gets two narrower columns, never a
 * horizontal scroll.
 */
export function ShowroomLayout({ model }: { model: EmailModel }) {
  const accent = model.accent;
  const onAccent = visibleOn(WHITE, accent, INK);
  const soft = mix(onAccent, accent, 0.72);
  const line = mix(INK, WHITE, 0.12);
  const body = authoredBody(model.html, {
    text: INK,
    muted: MUTED,
    link: visibleOn(model.link, WHITE, INK),
    size: model.size,
  });

  const facts = [
    model.orderNumber && ["Order", model.orderNumber],
    model.orderDate && ["Placed", model.orderDate],
    model.address && ["Ship to", model.address],
  ].filter(Boolean) as [string, string][];

  return (
    <EmailShell model={model} background={WHITE} font={SANS}>
      <Container style={{ maxWidth: 640, margin: "0 auto", backgroundColor: WHITE }}>
        <Section>
          <Row>
            <Column
              style={{
                width: "46%",
                backgroundColor: accent,
                padding: "36px 26px 40px",
                verticalAlign: "top",
              }}
            >
              {model.logoUrl ? (
                <Img
                  src={model.logoUrl}
                  alt={model.storeName}
                  style={{ display: "block", maxHeight: 28, maxWidth: 140, height: "auto" }}
                />
              ) : (
                <Text style={{ color: onAccent, fontSize: 15, fontWeight: 800, margin: 0 }}>
                  {model.storeName}
                </Text>
              )}
              <Text style={{ ...fact, color: soft, margin: "64px 0 10px" }}>Order update</Text>
              <Text
                style={{
                  color: onAccent,
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: "-0.035em",
                  lineHeight: "36px",
                  margin: 0,
                }}
              >
                {model.stage || "Order received"}
              </Text>
              {model.orderNumber ? (
                <Text style={{ color: soft, fontFamily: MONO, fontSize: 14, margin: "16px 0 0" }}>
                  {model.orderNumber}
                </Text>
              ) : null}
            </Column>

            <Column style={{ width: "54%", padding: "36px 0 32px 26px", verticalAlign: "top" }}>
              {facts.map(([name, value], index) => (
                <Section
                  key={name}
                  style={{
                    borderTop: index === 0 ? undefined : `1px solid ${line}`,
                    padding: index === 0 ? "0 0 14px" : "14px 0",
                  }}
                >
                  <Text style={fact}>{name}</Text>
                  <Text style={{ color: INK, fontSize: 15, fontWeight: 600, lineHeight: "21px", margin: 0 }}>
                    {value}
                  </Text>
                </Section>
              ))}
            </Column>
          </Row>
        </Section>

        <Section style={{ padding: "44px 26px 0" }}>
          <Row>
            <Column style={{ width: 6, backgroundColor: accent, fontSize: 0, lineHeight: 0 }}>&nbsp;</Column>
            <Column style={{ paddingLeft: 22, verticalAlign: "top" }}>
              <div dangerouslySetInnerHTML={{ __html: body }} />
            </Column>
          </Row>
        </Section>

        {model.trackingUrl ? (
          <Section style={{ padding: "32px 26px 0" }}>
            <Button
              href={model.trackingUrl}
              style={{
                backgroundColor: INK,
                borderRadius: 0,
                color: WHITE,
                display: "inline-block",
                fontSize: 15,
                fontWeight: 700,
                padding: "18px 28px",
                textDecoration: "none",
              }}
            >
              Open the tracking page
            </Button>
          </Section>
        ) : null}

        <Section style={{ padding: "52px 26px 40px" }}>
          <div style={{ borderTop: `1px solid ${line}`, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
          <Row style={{ marginTop: 18 }}>
            <Column style={{ verticalAlign: "top" }}>
              <Text style={{ color: INK, fontSize: 13, fontWeight: 800, margin: 0 }}>{model.storeName}</Text>
              {model.postalAddress ? (
                <Text style={{ color: MUTED, fontSize: 11, lineHeight: "17px", margin: "4px 0 0" }}>
                  {model.postalAddress}
                </Text>
              ) : null}
            </Column>
            <Column style={{ verticalAlign: "top", textAlign: "right" }}>
              <Text style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: 0 }}>
                Reply for help
                {model.helpUrl ? (
                  <>
                    {" · "}
                    <Link href={model.helpUrl} style={{ color: INK, fontWeight: 700, textDecoration: "underline" }}>
                      Help centre
                    </Link>
                  </>
                ) : null}
              </Text>
            </Column>
          </Row>
          <Text style={{ color: MUTED, fontSize: 11, lineHeight: "17px", margin: "18px 0 0" }}>
            {model.footerText}
          </Text>
        </Section>
      </Container>
    </EmailShell>
  );
}
