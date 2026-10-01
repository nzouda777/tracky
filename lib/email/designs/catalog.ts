/**
 * The email designs a template can be rendered in.
 *
 * A design is the shell around a template's copy: masthead, headline, call to
 * action, delivery details and footer. The copy itself never changes between
 * designs, so an owner can restyle a template — or every template at once —
 * without rewriting a word of it.
 *
 * This file is data only, with no React Email import, so client components
 * (the gallery, the editor's picker) can read it without pulling the renderer
 * into the browser bundle. The layouts live next to it in `./layouts`.
 */
export const EMAIL_DESIGNS = [
  {
    id: "classic",
    name: "Classic",
    tagline: "Clean card, your colours",
    description:
      "A rounded card on a soft backdrop, topped with a rule in your brand colour. Quiet and dependable.",
    swatches: ["#F1F2EF", "#FFFFFF", "#1B2B44"],
  },
  {
    id: "athletic",
    name: "Athletic",
    tagline: "Loud, black and confident",
    description:
      "A black hero with a huge uppercase headline, pill button and a sharp spec grid. Built for impact.",
    swatches: ["#111111", "#FFFFFF", "#F5F5F5"],
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Serif, centred, unhurried",
    description:
      "Magazine-style serif headline on warm ivory, generous whitespace and fine rules. For considered brands.",
    swatches: ["#F4F0EA", "#1F1B16", "#8C7F6E"],
  },
  {
    id: "noir",
    name: "Noir",
    tagline: "Dark luxury",
    description:
      "Black canvas, light type and a wide-tracked wordmark. Uses your store name rather than your logo, so it reads on dark.",
    swatches: ["#000000", "#F5F5F5", "#7A7A7A"],
  },
  {
    id: "minimal",
    name: "Minimal",
    tagline: "Precise, product-led",
    description:
      "Centred logo, tight headline and a soft grey receipt panel. Calm, exact and easy to scan.",
    swatches: ["#FFFFFF", "#F5F5F7", "#1D1D1F"],
  },
  {
    id: "spotlight",
    name: "Spotlight",
    tagline: "Your brand colour, front and centre",
    description:
      "A bold hero card filled with your brand colour, then a crisp white card for the details. Friendly and vivid.",
    swatches: ["#1B2B44", "#FFFFFF", "#EEF0F3"],
  },
] as const;

export type EmailDesign = (typeof EMAIL_DESIGNS)[number];
export type EmailDesignId = EmailDesign["id"];

export const DEFAULT_EMAIL_DESIGN: EmailDesignId = "classic";

export function isEmailDesign(value: unknown): value is EmailDesignId {
  return EMAIL_DESIGNS.some((design) => design.id === value);
}

/** A stored design id, or the default when it is missing or no longer exists. */
export function resolveEmailDesign(value: unknown): EmailDesignId {
  return isEmailDesign(value) ? value : DEFAULT_EMAIL_DESIGN;
}

export function getEmailDesign(value: unknown): EmailDesign {
  const id = resolveEmailDesign(value);
  return EMAIL_DESIGNS.find((design) => design.id === id)!;
}

/**
 * The copy the gallery previews every design with, so the designs are compared
 * on the shell alone. Written the way the default templates are: no order
 * number, link or address — the shell already renders those.
 */
export const DESIGN_SAMPLE = {
  subject: "Order {{order_number}} is out for delivery",
  previewText: "Your order is with our driver today.",
  body: [
    "<p>Hi {{customer_name}},</p>",
    "<p>Your order is on board with our driver and arriving today. Please make sure someone can receive it — <strong>the driver will ask for a signature</strong> on arrival.</p>",
  ].join("\n"),
};
