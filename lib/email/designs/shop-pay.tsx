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

import { isOffRoute } from "./journey";
import { EmailShell, authoredBody, mix, type EmailModel } from "./shared";

const PAGE = "#F2F1F7";
const WHITE = "#FFFFFF";
const INK = "#0B0B0F";
const MUTED = "#707079";
const LINE = "#ECEBF2";
/** Shop's purple — the one colour this design is recognised by. */
const PURPLE = "#5A31F4";
const GREEN = "#0E8A4F";
const RED = "#C0392B";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Updates shown on the timeline before "See N more updates". */
const SHOWN = 3;

function Card({ children, padding = "20px" }: { children: React.ReactNode; padding?: string }) {
  return (
    <Section style={{ backgroundColor: WHITE, borderRadius: 18, padding, margin: "0 0 12px" }}>
      {children}
    </Section>
  );
}

/** A 44px rounded tile: the product photo, or the store's initial. */
function Thumb({ src, label }: { src: string | null; label: string }) {
  return src ? (
    <Img
      src={src}
      alt={label}
      width={44}
      height={44}
      style={{ borderRadius: 10, objectFit: "cover", display: "block" }}
    />
  ) : (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: mix(PURPLE, WHITE, 0.1),
        color: PURPLE,
        fontSize: 18,
        fontWeight: 700,
        lineHeight: "44px",
        textAlign: "center",
      }}
    >
      {label.trim().charAt(0).toUpperCase() || "•"}
    </div>
  );
}

/**
 * Shop Pay: the Shop app's tracking screen, without the map. A bold
 * "Tracking" title over the order number, the status as a purple pill, the
 * latest updates on a thick purple rail with "See more updates", the order
 * number to copy, and the items as the app's home-list rows — thumbnail,
 * title, price and store, status in colour. Rounded white cards on a faint
 * lilac page; the masthead stays the store's own.
 */
export function ShopPayLayout({ model }: { model: EmailModel }) {
  const body = authoredBody(model.html, {
    text: INK,
    muted: MUTED,
    link: PURPLE,
    size: model.size - 1,
  });

  const order = model.order;
  const items = order?.items ?? [];
  const allEvents = order?.events.length
    ? order.events
    : [
        {
          title: model.stage || "Order confirmed",
          detail: "",
          date: model.orderDate,
          time: "",
        },
      ];
  const events = allEvents.slice(0, SHOWN);
  const more = allEvents.length - events.length;

  const delivered = /^\s*(order\s+)?delivered\b/i.test(model.stage);
  const statusColor = delivered ? GREEN : isOffRoute(model.stage) ? RED : PURPLE;
  const rail = mix(PURPLE, WHITE, 0.55);

  return (
    <EmailShell model={model} background={PAGE} font={SANS}>
      <Container style={{ maxWidth: 460, margin: "0 auto", padding: "28px 12px 40px" }}>
        <Section style={{ padding: "0 8px 18px" }}>
          {model.logoUrl ? (
            <Img
              src={model.logoUrl}
              alt={model.storeName}
              style={{ display: "block", maxHeight: 30, maxWidth: 140, height: "auto" }}
            />
          ) : (
            <Text style={{ color: INK, fontSize: 16, fontWeight: 700, margin: 0 }}>
              {model.storeName}
            </Text>
          )}
        </Section>

        <Card padding="24px 20px">
          <Text
            style={{
              color: INK,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: "34px",
              margin: 0,
            }}
          >
            Tracking
            {model.orderNumber ? (
              <>
                <br />
                {model.orderNumber}
              </>
            ) : null}
          </Text>

          <Section style={{ padding: "14px 0 0" }}>
            <span
              style={{
                display: "inline-block",
                backgroundColor: mix(statusColor, WHITE, 0.1),
                borderRadius: 999,
                color: statusColor,
                fontSize: 13,
                fontWeight: 600,
                padding: "5px 12px",
              }}
            >
              {model.stage || "Order confirmed"}
            </span>
          </Section>

          <Section style={{ padding: "18px 0 0" }}>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </Section>

          {/* The rail: one thick rounded bar, built a segment per update so
              every step gets its own white dot. The newest is solid purple. */}
          <Section style={{ padding: "20px 0 0" }}>
            {events.map((event, index) => {
              const first = index === 0;
              const last = index === events.length - 1;
              return (
                <Row key={index}>
                  <Column
                    style={{
                      width: 10,
                      height: 58,
                      verticalAlign: "top",
                      backgroundColor: first ? PURPLE : rail,
                      borderRadius: `${first ? "999px 999px" : "0 0"} ${last ? "999px 999px" : "0 0"}`,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: first ? 6 : 4,
                        height: first ? 6 : 4,
                        margin: first ? "6px auto 0" : "7px auto 0",
                        borderRadius: 999,
                        backgroundColor: WHITE,
                        fontSize: 0,
                        lineHeight: 0,
                      }}
                    >
                      &nbsp;
                    </div>
                  </Column>
                  <Column style={{ width: 14 }}>&nbsp;</Column>
                  <Column style={{ verticalAlign: "top", paddingBottom: last ? 0 : 14 }}>
                    <Text
                      style={{
                        color: INK,
                        fontSize: 15,
                        fontWeight: 600,
                        lineHeight: "20px",
                        margin: 0,
                      }}
                    >
                      {event.title}
                    </Text>
                    <Text style={{ color: MUTED, fontSize: 12, lineHeight: "17px", margin: "3px 0 0" }}>
                      {[event.detail, [event.date, event.time].filter(Boolean).join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </Column>
                </Row>
              );
            })}
          </Section>

          {model.trackingUrl ? (
            <Text style={{ fontSize: 14, fontWeight: 600, margin: "4px 0 0 22px" }}>
              <Link href={model.trackingUrl} style={{ color: PURPLE, textDecoration: "none" }}>
                {more > 0
                  ? `See ${more} more update${more === 1 ? "" : "s"}`
                  : "See tracking details"}
              </Link>
            </Text>
          ) : null}

          {model.orderNumber ? (
            <Section style={{ borderTop: `1px solid ${LINE}`, margin: "20px 0 0", padding: "16px 0 0" }}>
              <Text style={{ color: MUTED, fontSize: 12, lineHeight: "16px", margin: 0 }}>
                Order number
              </Text>
              <Text style={{ color: PURPLE, fontSize: 15, fontWeight: 600, lineHeight: "22px", margin: "2px 0 0" }}>
                {model.orderNumber}
              </Text>
            </Section>
          ) : null}

          {model.trackingUrl ? (
            <Section style={{ padding: "20px 0 0" }}>
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
          <Card padding="8px 20px">
            {items.map((item, index) => (
              <Row
                key={index}
                style={{ borderBottom: index === items.length - 1 ? undefined : `1px solid ${LINE}` }}
              >
                <Column style={{ width: 56, padding: "14px 0", verticalAlign: "middle" }}>
                  <Thumb src={item.imageUrl} label={model.storeName} />
                </Column>
                <Column style={{ padding: "14px 0", verticalAlign: "middle" }}>
                  <Text style={{ color: INK, fontSize: 14, fontWeight: 600, lineHeight: "19px", margin: 0 }}>
                    {item.title}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 13, lineHeight: "18px", margin: "2px 0 0" }}>
                    {[item.price, item.variant || model.storeName].filter(Boolean).join(" • ")}
                  </Text>
                  <Text style={{ color: statusColor, fontSize: 13, fontWeight: 500, lineHeight: "18px", margin: "2px 0 0" }}>
                    {model.stage || "Order confirmed"}
                  </Text>
                </Column>
              </Row>
            ))}
            {order?.total ? (
              <Row style={{ borderTop: `1px solid ${LINE}` }}>
                <Column style={{ padding: "14px 0" }}>
                  <Text style={{ color: INK, fontSize: 14, fontWeight: 700, margin: 0 }}>Total</Text>
                </Column>
                <Column align="right" style={{ padding: "14px 0" }}>
                  <Text style={{ color: INK, fontSize: 14, fontWeight: 700, margin: 0, textAlign: "right" }}>
                    {order.total}
                  </Text>
                </Column>
              </Row>
            ) : null}
          </Card>
        ) : null}

        {(order?.addressLines.length || model.address) ? (
          <Card>
            <Text style={{ color: MUTED, fontSize: 12, lineHeight: "16px", margin: "0 0 4px" }}>
              Delivering to
            </Text>
            {(order?.addressLines.length ? order.addressLines : [model.address]).map((line, index) => (
              <Text
                key={index}
                style={{ color: INK, fontSize: 14, fontWeight: index === 0 ? 600 : 400, lineHeight: "21px", margin: 0 }}
              >
                {line}
              </Text>
            ))}
          </Card>
        ) : null}

        <Section style={{ padding: "12px 12px 0", textAlign: "center" }}>
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
          <Text style={{ color: MUTED, fontSize: 11, lineHeight: "17px", margin: "14px 0 0" }}>
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
