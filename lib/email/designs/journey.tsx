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
  MONO,
  authoredBody,
  mix,
  visibleOn,
  type EmailModel,
} from "./shared";

const WHITE = "#FFFFFF";
const INK = "#0F172A";
const MUTED = "#64748B";
const TILE = "#F1F5F9";
const SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * The three checkpoints the email can state truthfully. It knows the order
 * was placed and which stage it is at now — nothing about how many stages a
 * store runs — so the tracker is placed → now → delivered, and the last one
 * only fills when the current stage says so.
 */
function checkpoints(stage: string) {
  // Only a stage that *starts* by saying it was delivered counts: "Delivered"
  // or "Order delivered", never "Not delivered", "Could not be delivered" or
  // "Out for delivery". A false "Delivered" is the one thing this tracker
  // must never show.
  const delivered = /^\s*(order\s+)?delivered\b/i.test(stage);
  return [
    { name: "Ordered", state: "done" as const },
    {
      name: delivered ? "On its way" : stage || "Processing",
      state: delivered ? ("done" as const) : ("now" as const),
    },
    {
      name: "Delivered",
      state: delivered ? ("now" as const) : ("next" as const),
    },
  ];
}

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Section
      style={{ backgroundColor: TILE, borderRadius: 14, padding: "14px 16px" }}
    >
      <Text
        style={{
          color: MUTED,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          lineHeight: "15px",
          textTransform: "uppercase",
          margin: "0 0 4px",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: INK,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: "21px",
          margin: 0,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

/**
 * Journey: progress first, like an app notification. The status is the
 * headline, a segmented tracker sits right under it, and the order facts are
 * laid out as tiles rather than rows. Left-aligned, roomy, and the brand
 * colour does exactly one job — showing how far along the order is.
 */
export function JourneyLayout({ model }: { model: EmailModel }) {
  const accent = visibleOn(model.accent, WHITE, INK);
  const onAccent = visibleOn(WHITE, accent, INK);
  const empty = mix(INK, WHITE, 0.1);
  const steps = checkpoints(model.stage);
  // A stage that has left the road to the door — cancelled, returned, failed,
  // on hold — gets no tracker: a half-filled bar would say it is still coming.
  const offRoute =
    /cancel|return|refund|fail|lost|hold|undeliver|not delivered/i.test(
      model.stage,
    );
  const body = authoredBody(model.html, {
    text: INK,
    muted: MUTED,
    link: visibleOn(model.link, WHITE, INK),
    size: model.size,
  });

  return (
    <EmailShell model={model} background={WHITE} font={SANS}>
      <Container
        style={{ maxWidth: 600, margin: "0 auto", backgroundColor: WHITE }}
      >
        <Section style={{ padding: "32px 28px 0" }}>
          <Row>
            <Column style={{ verticalAlign: "middle" }}>
              {model.logoUrl ? (
                <Img
                  src={model.logoUrl}
                  alt={model.storeName}
                  style={{
                    display: "block",
                    maxHeight: 30,
                    maxWidth: 150,
                    height: "auto",
                  }}
                />
              ) : (
                <Text
                  style={{
                    color: INK,
                    fontSize: 17,
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  {model.storeName}
                </Text>
              )}
            </Column>
            {model.orderNumber ? (
              <Column style={{ verticalAlign: "middle", textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: TILE,
                    borderRadius: 999,
                    color: INK,
                    fontFamily: MONO,
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "6px 12px",
                  }}
                >
                  {model.orderNumber}
                </span>
              </Column>
            ) : null}
          </Row>
        </Section>

        <Section style={{ padding: "44px 28px 0" }}>
          <Text
            style={{
              color: MUTED,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              margin: "0 0 10px",
            }}
          >
            Order status
          </Text>
          <Text
            style={{
              color: INK,
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: "44px",
              margin: 0,
            }}
          >
            {model.stage || "Order received"}
          </Text>
        </Section>

        {/* The tracker: three bars, then three labels under them. */}
        {offRoute ? null : (
          <Section style={{ padding: "24px 28px 0" }}>
            <Row>
              {steps.map((step, index) => (
                <Column
                  key={index}
                  style={{
                    width: "33.33%",
                    padding: index === 1 ? "0 4px" : 0,
                    verticalAlign: "top",
                  }}
                >
                  <div
                    style={{
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: step.state === "next" ? empty : accent,
                      fontSize: 0,
                      lineHeight: "10px",
                    }}
                  >
                    &nbsp;
                  </div>
                  <Text
                    style={{
                      color: step.state === "next" ? MUTED : INK,
                      fontSize: 12,
                      fontWeight: step.state === "now" ? 800 : 600,
                      lineHeight: "16px",
                      margin: "8px 0 0",
                      textAlign:
                        index === 0 ? "left" : index === 1 ? "center" : "right",
                    }}
                  >
                    {step.state === "now" ? "● " : ""}
                    {step.name}
                  </Text>
                </Column>
              ))}
            </Row>
          </Section>
        )}

        <Section style={{ padding: "36px 28px 0" }}>
          <div dangerouslySetInnerHTML={{ __html: body }} />
        </Section>

        {model.trackingUrl ? (
          <Section style={{ padding: "28px 28px 0" }}>
            <Button
              href={model.trackingUrl}
              style={{
                backgroundColor: accent,
                borderRadius: 12,
                color: onAccent,
                display: "block",
                fontSize: 16,
                fontWeight: 700,
                padding: "16px 24px",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              See every step
            </Button>
          </Section>
        ) : null}

        <Section style={{ padding: "32px 22px 0" }}>
          <Row>
            <Column
              style={{
                width: "50%",
                padding: "0 6px 12px",
                verticalAlign: "top",
              }}
            >
              <Tile label="Placed">{model.orderDate || "—"}</Tile>
            </Column>
            <Column
              style={{
                width: "50%",
                padding: "0 6px 12px",
                verticalAlign: "top",
              }}
            >
              <Tile label="Order">{model.orderNumber || "—"}</Tile>
            </Column>
          </Row>
          {model.address ? (
            <Row>
              <Column style={{ padding: "0 6px" }}>
                <Tile label="Delivering to">{model.address}</Tile>
              </Column>
            </Row>
          ) : null}
        </Section>

        <Section style={{ padding: "36px 28px 40px" }}>
          <div
            style={{
              borderTop: `1px solid ${empty}`,
              fontSize: 0,
              lineHeight: 0,
            }}
          >
            &nbsp;
          </div>
          <Text
            style={{
              color: INK,
              fontSize: 14,
              fontWeight: 700,
              margin: "20px 0 4px",
            }}
          >
            Need anything?
          </Text>
          <Text
            style={{
              color: MUTED,
              fontSize: 13,
              lineHeight: "20px",
              margin: 0,
            }}
          >
            Just reply to this email
            {model.orderNumber ? ` with ${model.orderNumber}` : ""}.
            {model.helpUrl ? (
              <>
                {" "}
                <Link
                  href={model.helpUrl}
                  style={{
                    color: INK,
                    fontWeight: 700,
                    textDecoration: "underline",
                  }}
                >
                  Help centre
                </Link>
              </>
            ) : null}
          </Text>
          <Text
            style={{
              color: MUTED,
              fontSize: 11,
              lineHeight: "17px",
              margin: "20px 0 0",
            }}
          >
            {model.footerText}
          </Text>
          {model.postalAddress ? (
            <Text
              style={{
                color: MUTED,
                fontSize: 11,
                lineHeight: "17px",
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
