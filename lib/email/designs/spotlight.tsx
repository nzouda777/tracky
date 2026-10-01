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

import { mutedOn, readableOn } from "@/components/tracking/branding";
import {
  EmailShell,
  authoredBody,
  eyebrowOf,
  mix,
  type EmailModel,
} from "./shared";

const WHITE = "#FFFFFF";

/**
 * Spotlight: the brand colour as the whole hero. A rounded card filled with
 * the store's primary colour carries the stage and the button; a second, white
 * card underneath holds the message and the details.
 *
 * Two separate cards rather than one card with a coloured top: a filled row
 * inside a rounded container has to be clipped to the corners, which email
 * clients will not do reliably. Two whole cards need no clipping at all.
 */
export function SpotlightLayout({ model }: { model: EmailModel }) {
  const { accent, text } = model;
  const onAccent = readableOn(accent, text);
  const softOnAccent = mix(onAccent, accent, 0.72);
  const backdrop = mix(accent, WHITE, 0.07);
  const muted = mutedOn(text, WHITE);
  const tint = mix(accent, WHITE, 0.06);

  const eyebrow = eyebrowOf(model);
  const body = authoredBody(model.html, {
    text,
    muted,
    link: model.link,
    size: model.size,
  });

  return (
    <EmailShell model={model} background={backdrop}>
      <Section style={{ padding: "32px 12px 48px" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Section style={{ padding: "0 8px 20px" }}>
            {model.logoUrl ? (
              <Img
                src={model.logoUrl}
                alt={model.storeName}
                style={{ display: "block", maxHeight: 30, maxWidth: 170, height: "auto" }}
              />
            ) : (
              <Text
                style={{
                  color: text,
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {model.storeName}
              </Text>
            )}
          </Section>

          <Section
            style={{
              backgroundColor: accent,
              borderRadius: 24,
              padding: "40px 36px 40px",
            }}
          >
            {eyebrow ? (
              <Text
                style={{
                  color: softOnAccent,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  margin: "0 0 14px",
                }}
              >
                {eyebrow}
              </Text>
            ) : null}
            <Text
              style={{
                color: onAccent,
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: "-0.035em",
                lineHeight: "44px",
                margin: 0,
              }}
            >
              {model.stage || "Your order update"}
            </Text>
            {model.trackingUrl ? (
              <Button
                href={model.trackingUrl}
                style={{
                  backgroundColor: onAccent,
                  borderRadius: 999,
                  color: accent,
                  display: "inline-block",
                  fontSize: 15,
                  fontWeight: 700,
                  marginTop: 28,
                  padding: "14px 28px",
                  textDecoration: "none",
                }}
              >
                Track your order →
              </Button>
            ) : null}
          </Section>

          <Section
            style={{
              backgroundColor: WHITE,
              borderRadius: 24,
              marginTop: 12,
              padding: "36px 36px 32px",
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: body }} />

            {model.address ? (
              <Section
                style={{
                  backgroundColor: tint,
                  borderRadius: 16,
                  marginTop: 28,
                  padding: "16px 18px",
                }}
              >
                <Row>
                  <Column style={{ width: 36, verticalAlign: "top" }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: accent,
                        color: onAccent,
                        fontSize: 12,
                        lineHeight: "24px",
                        textAlign: "center",
                      }}
                    >
                      ●
                    </div>
                  </Column>
                  <Column style={{ verticalAlign: "top" }}>
                    <Text
                      style={{
                        color: muted,
                        fontSize: 12,
                        fontWeight: 700,
                        margin: "0 0 2px",
                      }}
                    >
                      Delivering to
                    </Text>
                    <Text style={{ color: text, fontSize: 14, lineHeight: "20px", margin: 0 }}>
                      {model.address}
                    </Text>
                  </Column>
                </Row>
              </Section>
            ) : null}

            <Text style={{ color: muted, fontSize: 13, lineHeight: "20px", margin: "28px 0 0" }}>
              Questions? Hit reply
              {model.orderNumber ? ` and mention ${model.orderNumber}` : ""} — we
              are happy to help.
            </Text>
          </Section>

          <Section style={{ padding: "24px 16px 0", textAlign: "center" }}>
            {model.helpUrl ? (
              <Text style={{ fontSize: 13, margin: "0 0 8px" }}>
                <Link href={model.helpUrl} style={{ color: text, fontWeight: 700 }}>
                  Help centre
                </Link>
              </Text>
            ) : null}
            <Text
              style={{ color: mutedOn(text, backdrop), fontSize: 12, lineHeight: "18px", margin: 0 }}
            >
              {model.footerText}
            </Text>
            {model.postalAddress ? (
              <Text
                style={{
                  color: mutedOn(text, backdrop),
                  fontSize: 12,
                  lineHeight: "18px",
                  margin: "6px 0 0",
                }}
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
