/**
 * Default email templates for a newly connected store, in English.
 *
 * The body is stored as light HTML containing {{merge_variables}}; it is
 * rendered into a branded layout at send time (lib/email/render). Everything
 * here is editable from the backoffice.
 *
 * What these bodies deliberately leave out, because the layout already renders
 * it and saying it twice is what made the old emails look unfinished:
 *
 *   - the order number and date — the eyebrow above the headline carries them;
 *   - the current stage — it is the headline;
 *   - the tracking link — the layout owns the single call to action;
 *   - the delivery address — it has its own panel;
 *   - a sign-off naming the store — the wordmark and the footer both do.
 *
 * What is left is the one thing a template should be: what to say to the
 * customer at this point in the journey, in as few words as it takes.
 */
export type DefaultTemplate = {
  key: string;
  name: string;
  subject: string;
  previewText: string;
  body: string;
  /** How the seeded sequence wires this template up. */
  trigger:
    | { type: "on_stage"; stageKey: string }
    | { type: "delay_after_order"; delayDays: number };
};

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplate[] = [
  {
    key: "order-confirmation",
    name: "Order confirmation",
    subject: "Order {{order_number}} is confirmed",
    previewText: "We have your order — here is where to follow it.",
    body: [
      "<p>Hi {{customer_name}}, thanks for shopping with {{store_name}}.</p>",
      "<p>Your order is confirmed and we have started getting it ready. You can follow every step from the link below, and we will email you as soon as it is on the way.</p>",
    ].join("\n"),
    trigger: { type: "on_stage", stageKey: "order-placed" },
  },
  {
    key: "order-processing",
    name: "Order is being packed",
    subject: "We are packing order {{order_number}}",
    previewText: "Your items are being picked and packed.",
    body: [
      "<p>Hi {{customer_name}},</p>",
      "<p>Your order is being picked and packed right now. The next email you get from us will be the one saying it has left for delivery.</p>",
    ].join("\n"),
    trigger: { type: "on_stage", stageKey: "processing" },
  },
  {
    key: "out-for-delivery",
    name: "Out for delivery",
    subject: "Order {{order_number}} is out for delivery",
    previewText: "Your order is with our driver today.",
    body: [
      "<p>Hi {{customer_name}},</p>",
      "<p>Your order is on board with our driver and arriving today. Please make sure someone can receive it — <strong>the driver will ask you to sign the paper delivery note</strong> on arrival.</p>",
    ].join("\n"),
    trigger: { type: "on_stage", stageKey: "out-for-delivery" },
  },
  {
    key: "delivered",
    name: "Delivered",
    subject: "Order {{order_number}} has been delivered",
    previewText: "Your order was delivered and signed for.",
    body: [
      "<p>Hi {{customer_name}},</p>",
      "<p>Your order has been delivered and signed for. We hope everything arrived in perfect condition — if anything is not right, just reply to this email and we will sort it out.</p>",
    ].join("\n"),
    trigger: { type: "on_stage", stageKey: "delivered" },
  },
  {
    key: "post-delivery-check-in",
    name: "Post-delivery check-in",
    subject: "How was your order, {{customer_name}}?",
    previewText: "A quick note after your delivery.",
    body: [
      "<p>Hi {{customer_name}},</p>",
      "<p>It has been a few days since your order. We wanted to check everything arrived as it should.</p>",
      "<p>If something is missing, damaged or simply not what you expected, reply to this email — a real person reads it.</p>",
    ].join("\n"),
    // A delay only ever schedules an email. It never moves an order forward.
    trigger: { type: "delay_after_order", delayDays: 7 },
  },
];
