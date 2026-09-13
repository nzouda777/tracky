/**
 * Default email templates for a newly connected store, in English.
 *
 * The body is stored as light HTML containing {{merge_variables}}; it is
 * rendered into a branded React Email layout at send time (lib/email/render).
 * Everything here is editable from the backoffice.
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
    previewText: "Thanks for your order — here is your tracking link.",
    body: [
      "<p>Hi {{customer_name}},</p>",
      "<p>Thanks for shopping with {{store_name}}. We have received order <strong>{{order_number}}</strong>, placed on {{order_date}}.</p>",
      "<p>You can follow its progress at any time:</p>",
      '<p><a href="{{tracking_link}}">Track your order</a></p>',
      "<p>We will email you again as soon as it is on the way.</p>",
      "<p>— {{store_name}}</p>",
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
      "<p>Good news — order <strong>{{order_number}}</strong> is now being packed.</p>",
      "<p>Current status: <strong>{{current_stage}}</strong></p>",
      '<p><a href="{{tracking_link}}">View the latest update</a></p>',
      "<p>— {{store_name}}</p>",
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
      "<p>Order <strong>{{order_number}}</strong> is on board with our driver and on its way to:</p>",
      "<p>{{shipping_address}}</p>",
      "<p>Our driver will ask you to sign the paper delivery note on arrival.</p>",
      '<p><a href="{{tracking_link}}">Follow your delivery</a></p>',
      "<p>— {{store_name}}</p>",
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
      "<p>Order <strong>{{order_number}}</strong> has been delivered and signed for. We hope everything arrived in perfect condition.</p>",
      '<p><a href="{{tracking_link}}">View your delivery details</a></p>',
      "<p>Thanks for shopping with {{store_name}}.</p>",
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
      "<p>It has been a few days since order <strong>{{order_number}}</strong> was placed. If anything is not quite right, just reply to this email and we will sort it out.</p>",
      "<p>— {{store_name}}</p>",
    ].join("\n"),
    // A delay only ever schedules an email. It never moves an order forward.
    trigger: { type: "delay_after_order", delayDays: 7 },
  },
];
