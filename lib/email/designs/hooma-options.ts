/**
 * Editable settings for the Hooma design.
 *
 * Unlike the other designs, Hooma's shell carries copy of its own — the hero
 * title and subtitle, the "next update" note, the greeting, the button — and
 * changes colour with the stage (green for a confirmation, blue for a
 * delivery). All of it is stored per template in `email_templates.design_options`
 * so every word and colour can be changed from the template editor.
 *
 * Data only, with no React Email import, so the editor can read it in the
 * browser.
 */

export const HOOMA_THEMES = {
  green: {
    name: "Green",
    heroFrom: "#F0FDF4",
    heroTo: "#DCFCE7",
    solid: "#22C55E",
    title: "#166534",
    noteBg: "#F0FDF4",
    noteBorder: "#BBF7D0",
    noteText: "#166534",
    button: "#16A34A",
  },
  blue: {
    name: "Blue",
    heroFrom: "#EFF6FF",
    heroTo: "#DBEAFE",
    solid: "#3B82F6",
    title: "#1E40AF",
    noteBg: "#F0F9FF",
    noteBorder: "#BAE6FD",
    noteText: "#075985",
    button: "#2563EB",
  },
  amber: {
    name: "Amber",
    heroFrom: "#FFFBEB",
    heroTo: "#FEF3C7",
    solid: "#F59E0B",
    title: "#92400E",
    noteBg: "#FFFBEB",
    noteBorder: "#FDE68A",
    noteText: "#92400E",
    button: "#D97706",
  },
  purple: {
    name: "Purple",
    heroFrom: "#F5F3FF",
    heroTo: "#EDE9FE",
    solid: "#8B5CF6",
    title: "#5B21B6",
    noteBg: "#F5F3FF",
    noteBorder: "#DDD6FE",
    noteText: "#5B21B6",
    button: "#7C3AED",
  },
  red: {
    name: "Red",
    heroFrom: "#FEF2F2",
    heroTo: "#FEE2E2",
    solid: "#EF4444",
    title: "#991B1B",
    noteBg: "#FEF2F2",
    noteBorder: "#FECACA",
    noteText: "#991B1B",
    button: "#DC2626",
  },
  gray: {
    name: "Gray",
    heroFrom: "#F9FAFB",
    heroTo: "#F3F4F6",
    solid: "#6B7280",
    title: "#1F2937",
    noteBg: "#F9FAFB",
    noteBorder: "#E5E7EB",
    noteText: "#374151",
    button: "#111827",
  },
} as const;

export type HoomaThemeId = keyof typeof HOOMA_THEMES | "brand";

export const HOOMA_THEME_IDS: HoomaThemeId[] = [
  ...(Object.keys(HOOMA_THEMES) as Array<keyof typeof HOOMA_THEMES>),
  "brand",
];

export type HoomaOptions = {
  theme: HoomaThemeId;
  /** An emoji or a character drawn inside the circle. "✓" is drawn white. */
  icon: string;
  heroTitle: string;
  heroSubtitle: string;
  /** The "🕐 Next update: …" note under the hero. Empty hides it. */
  nextUpdate: string;
  /** Bold line above the body, e.g. "Hi {{customer_first_name}},". */
  greeting: string;
  showOrderCard: boolean;
  /** Card right under the hero (confirmation) or after the message. */
  orderCardFirst: boolean;
  showTotal: boolean;
  showItems: boolean;
  showAddress: boolean;
  /** Label of the tracking button. Empty hides the button. */
  buttonLabel: string;
  /** Small text above the footer. Empty hides it. */
  footerNote: string;
};

export const HOOMA_DEFAULT_OPTIONS: HoomaOptions = {
  theme: "blue",
  icon: "📦",
  heroTitle: "Out for Delivery",
  heroSubtitle: "The package is on its way today.",
  nextUpdate: "Next update: later today",
  greeting: "Hi {{customer_first_name}},",
  showOrderCard: true,
  orderCardFirst: false,
  showTotal: true,
  showItems: false,
  showAddress: true,
  buttonLabel: "Track your order",
  footerNote: "Questions? Simply reply to this email.",
};

/** The text fields, which accept merge variables. */
export const HOOMA_TEXT_FIELDS = [
  "icon",
  "heroTitle",
  "heroSubtitle",
  "nextUpdate",
  "greeting",
  "buttonLabel",
  "footerNote",
] as const satisfies ReadonlyArray<keyof HoomaOptions>;

export const HOOMA_TOGGLE_FIELDS = [
  "showOrderCard",
  "orderCardFirst",
  "showTotal",
  "showItems",
  "showAddress",
] as const satisfies ReadonlyArray<keyof HoomaOptions>;

/** Stored JSON → complete options; anything missing or malformed is defaulted. */
export function resolveHoomaOptions(raw: unknown): HoomaOptions {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const options: HoomaOptions = { ...HOOMA_DEFAULT_OPTIONS };

  if (HOOMA_THEME_IDS.includes(input.theme as HoomaThemeId)) {
    options.theme = input.theme as HoomaThemeId;
  }
  for (const field of HOOMA_TEXT_FIELDS) {
    if (typeof input[field] === "string") {
      options[field] = (input[field] as string).slice(0, 500);
    }
  }
  for (const field of HOOMA_TOGGLE_FIELDS) {
    if (typeof input[field] === "boolean") options[field] = input[field];
  }
  return options;
}

/** Reads the editor's form fields (prefixed `hooma.`) into options. */
export function readHoomaOptionsForm(formData: FormData): HoomaOptions {
  const raw: Record<string, unknown> = {
    theme: formData.get("hooma.theme"),
  };
  for (const field of HOOMA_TEXT_FIELDS) {
    raw[field] = String(formData.get(`hooma.${field}`) ?? "").trim();
  }
  for (const field of HOOMA_TOGGLE_FIELDS) {
    raw[field] = formData.get(`hooma.${field}`) === "on";
  }
  return resolveHoomaOptions(raw);
}

/**
 * The ready-made Hooma set: one template per stage, each with the hero, colour
 * and sections that suit it. Created from the templates page.
 */
export const HOOMA_TEMPLATE_SET: Array<{
  name: string;
  subject: string;
  previewText: string;
  body: string;
  options: HoomaOptions;
}> = [
  {
    name: "Hooma · Order confirmation",
    subject: "Order Confirmation - {{order_number}}",
    previewText: "Thank you for your order! We'll keep you updated every step of the way.",
    body: "<p>Thank you for shopping with {{store_name}}!<br />Here's a summary of your order.</p>",
    options: {
      ...HOOMA_DEFAULT_OPTIONS,
      theme: "green",
      icon: "✓",
      heroTitle: "Thank you for your order!",
      heroSubtitle:
        "Your order has been received and is being processed. We'll keep you updated every step of the way.",
      nextUpdate: "",
      orderCardFirst: true,
      showTotal: false,
      showItems: true,
      showAddress: true,
    },
  },
  {
    name: "Hooma · Processing",
    subject: "Order {{order_number}} is being prepared",
    previewText: "Your order is being prepared for shipping.",
    body: "<p>your order shipping status has been updated:</p>",
    options: {
      ...HOOMA_DEFAULT_OPTIONS,
      theme: "amber",
      icon: "🛠️",
      heroTitle: "Processing",
      heroSubtitle: "Your order is being prepared for shipping.",
      nextUpdate: "Next update: within 24 hours",
    },
  },
  {
    name: "Hooma · Out for delivery",
    subject: "Order {{order_number}} is out for delivery",
    previewText: "The package is on its way today.",
    body: "<p>your order shipping status has been updated:</p>",
    options: { ...HOOMA_DEFAULT_OPTIONS },
  },
  {
    name: "Hooma · Delivered",
    subject: "Order {{order_number}} has been delivered",
    previewText: "Your package has been delivered.",
    body: "<p>your order shipping status has been updated:</p>",
    options: {
      ...HOOMA_DEFAULT_OPTIONS,
      theme: "green",
      icon: "🏠",
      heroTitle: "Delivered",
      heroSubtitle: "Your package has been delivered. Enjoy!",
      nextUpdate: "",
    },
  },
];
