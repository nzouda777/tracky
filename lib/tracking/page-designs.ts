/**
 * Designs for the customer-facing tracking page.
 *
 * A design is two things:
 *
 *   1. **A preset** — colours, type and shape written into the ordinary
 *      branding fields when the owner picks it. They stay editable afterwards,
 *      so choosing a design is a starting point, never a lock.
 *   2. **A structural layer** — scoped CSS that changes what plain branding
 *      fields cannot: uppercase display type, a hero filled with the brand
 *      colour, underlined fields, a pill-shaped status badge.
 *
 * The layer targets `data-design` on the page root and `data-part` hooks on
 * its blocks, never a utility class, so it styles the page identically on our
 * own domain and embedded in a Shopify theme. Every selector sits under the
 * page's id, and every size is in px — the same rules `embed-styles.ts`
 * follows, for the same reasons.
 *
 * Wherever possible a design re-points the page's own custom properties
 * (`--brand-muted`, `--brand-line` …) on a block instead of overriding the
 * inline styles that read them: the components keep working from variables,
 * and the few `!important`s left are on shape alone.
 *
 * Data only, with no React import, so the branding editor (a client
 * component) and the server-rendered page share one definition.
 */

export const PAGE_DESIGNS = [
  {
    id: "standard",
    name: "Standard",
    tagline: "The original, calm run sheet",
    description:
      "A contained column with a tinted band behind the form. Neutral enough to sit inside any theme.",
    swatches: ["#FFFFFF", "#F4F5F3", "#1B2B44"],
    preset: {
      primaryColor: "#1B2B44",
      accentColor: "#1B2B44",
      backgroundColor: "#FFFFFF",
      textColor: "#131A24",
      secondaryColor: "#F5A524",
      fontFamily: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
      headingFontSize: 42,
      contentAlignment: "center",
      cardRadius: 14,
      buttonRadius: 10,
      buttonFullWidth: true,
      sectionBackground: "#F4F5F3",
    },
  },
  {
    id: "athletic",
    name: "Athletic",
    tagline: "Loud, black and confident",
    description:
      "Huge uppercase headlines, a black band behind the form and pill buttons. Built for impact.",
    swatches: ["#111111", "#FFFFFF", "#F5F5F5"],
    preset: {
      primaryColor: "#111111",
      accentColor: "#111111",
      backgroundColor: "#FFFFFF",
      textColor: "#111111",
      secondaryColor: "#FF5A1F",
      fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
      headingFontSize: 48,
      contentAlignment: "left",
      cardRadius: 0,
      buttonRadius: 40,
      buttonFullWidth: true,
      sectionBackground: "#111111",
    },
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Serif, centred, unhurried",
    description:
      "A magazine page on warm ivory: serif headlines, underlined fields and letter-spaced buttons.",
    swatches: ["#F4F0EA", "#1F1B16", "#B08D57"],
    preset: {
      primaryColor: "#1F1B16",
      accentColor: "#1F1B16",
      backgroundColor: "#F4F0EA",
      textColor: "#1F1B16",
      secondaryColor: "#B08D57",
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      headingFontSize: 46,
      contentAlignment: "center",
      cardRadius: 0,
      buttonRadius: 0,
      buttonFullWidth: true,
      sectionBackground: "#ECE6DC",
    },
  },
  {
    id: "noir",
    name: "Noir",
    tagline: "Dark luxury",
    description:
      "Black canvas, light wide-tracked type, hairline fields and a gold waypoint. Quietly expensive.",
    swatches: ["#0A0A0A", "#F2F2F2", "#C9A96E"],
    preset: {
      primaryColor: "#F2F2F2",
      accentColor: "#F2F2F2",
      backgroundColor: "#0A0A0A",
      textColor: "#F2F2F2",
      secondaryColor: "#C9A96E",
      fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
      headingFontSize: 40,
      contentAlignment: "center",
      cardRadius: 0,
      buttonRadius: 0,
      buttonFullWidth: true,
      sectionBackground: "#141414",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    tagline: "Precise, product-led",
    description:
      "Soft grey surfaces, floating cards, pill buttons and a receipt-style summary. Calm and exact.",
    swatches: ["#FFFFFF", "#F5F5F7", "#0071E3"],
    preset: {
      primaryColor: "#0071E3",
      accentColor: "#0071E3",
      backgroundColor: "#FFFFFF",
      textColor: "#1D1D1F",
      secondaryColor: "#FF9F0A",
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      headingFontSize: 44,
      contentAlignment: "center",
      cardRadius: 20,
      buttonRadius: 40,
      buttonFullWidth: true,
      sectionBackground: "#F5F5F7",
    },
  },
  {
    id: "spotlight",
    name: "Spotlight",
    tagline: "Your brand colour, front and centre",
    description:
      "The headline sits in a big rounded card filled with your primary colour. Friendly, vivid, unmistakably yours.",
    swatches: ["#5B3DF5", "#FFFFFF", "#F1EEFF"],
    preset: {
      primaryColor: "#5B3DF5",
      accentColor: "#5B3DF5",
      backgroundColor: "#FFFFFF",
      textColor: "#14121F",
      secondaryColor: "#FFB800",
      fontFamily: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
      headingFontSize: 46,
      contentAlignment: "left",
      cardRadius: 24,
      buttonRadius: 40,
      buttonFullWidth: true,
      sectionBackground: null,
    },
  },
] as const;

export type PageDesign = (typeof PAGE_DESIGNS)[number];
export type PageDesignId = PageDesign["id"];

export const DEFAULT_PAGE_DESIGN: PageDesignId = "standard";

export function isPageDesign(value: unknown): value is PageDesignId {
  return PAGE_DESIGNS.some((design) => design.id === value);
}

export function resolvePageDesign(value: unknown): PageDesignId {
  return isPageDesign(value) ? value : DEFAULT_PAGE_DESIGN;
}

export function getPageDesign(value: unknown): PageDesign {
  const id = resolvePageDesign(value);
  return PAGE_DESIGNS.find((design) => design.id === id)!;
}

// ---------------------------------------------------------------------------
// Structural layers
// ---------------------------------------------------------------------------

const GROTESK = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',Times,serif";

/** `[data-part="x"]` — the hooks `tracking-page.tsx` and friends carry. */
const P = (part: string) => `[data-part="${part}"]`;

/**
 * Rules per design, with `&` standing for the scoped root. Kept as
 * `[selector, body]` pairs so each selector can have the scope distributed
 * across its comma list — `& a,b` would otherwise leak `b` onto the theme.
 */
const LAYERS: Record<PageDesignId, Array<[string, string]>> = {
  standard: [],

  athletic: [
    [
      "& .type-display",
      `font-family:${GROTESK};font-variation-settings:normal;font-weight:900;` +
        "text-transform:uppercase;letter-spacing:-0.03em;line-height:0.95 !important",
    ],
    [`& ${P("masthead")} p`, "text-transform:uppercase;font-weight:900;letter-spacing:-0.02em"],
    [`& ${P("subtitle")}`, "font-size:18px"],
    [`& ${P("band")}`, "padding-top:56px !important;padding-bottom:56px !important"],
    [`& ${P("card")}`, "border:0 !important;padding:32px !important"],
    [`& ${P("button")}`, "font-weight:600;letter-spacing:0"],
    [
      `& ${P("section-title")}`,
      "text-transform:uppercase;font-weight:900;letter-spacing:0.02em;font-size:15px",
    ],
    [
      `& ${P("pill")}`,
      "background:var(--brand-text) !important;color:var(--brand-surface);" +
        "border:0 !important;border-radius:999px !important;padding:6px 14px !important;" +
        "text-transform:uppercase;font-weight:700;letter-spacing:0.06em;font-size:12px",
    ],
    [`& ${P("order-head")} .type-display`, "font-size:44px;line-height:42px !important"],
    [`& ${P("manifest")}`, "border-top:2px solid var(--brand-text);padding-top:16px"],
    [
      `& ${P("footer")}`,
      "text-transform:uppercase;font-weight:700;letter-spacing:0.08em;font-size:12px",
    ],
  ],

  editorial: [
    [
      "& .type-display",
      `font-family:${SERIF};font-variation-settings:normal;font-weight:400;letter-spacing:-0.01em`,
    ],
    [`& ${P("masthead")} p`, `font-family:${SERIF};font-weight:400`],
    [`& ${P("subtitle")}`, `font-family:${SERIF};font-style:italic;font-size:19px`],
    [`& ${P("section-title")}`, `font-family:${SERIF};font-weight:400;font-size:22px`],
    [`& ${P("card")}`, "border-width:1px 0 !important;background:transparent !important"],
    [
      `& ${P("field")}`,
      "border-width:0 0 1px !important;border-radius:0 !important;" +
        "background:transparent !important;padding-left:0 !important",
    ],
    [
      `& ${P("button")}`,
      "text-transform:uppercase;letter-spacing:0.22em;font-size:13px;font-weight:600",
    ],
    [
      `& ${P("pill")}`,
      `border-radius:999px !important;background:transparent !important;` +
        `font-family:${SERIF};font-style:italic;font-weight:400;font-size:15px`,
    ],
    [`& ${P("help")}`, "background:transparent !important;border-width:1px 0 !important;text-align:center"],
    [`& ${P("footer")}`, `font-family:${SERIF};font-style:italic;text-align:center`],
  ],

  noir: [
    [
      "& .type-display",
      "font-variation-settings:normal;font-weight:300;text-transform:uppercase;" +
        "letter-spacing:0.12em",
    ],
    [
      `& ${P("masthead")} p`,
      "text-transform:uppercase;font-weight:500;letter-spacing:0.42em;font-size:14px",
    ],
    [
      `& ${P("section-title")}`,
      "text-transform:uppercase;font-weight:500;letter-spacing:0.28em;font-size:12px",
    ],
    [`& ${P("card")}`, "border-color:#262626 !important"],
    [
      `& ${P("field")}`,
      "border-width:0 0 1px !important;border-radius:0 !important;" +
        "background:transparent !important;padding-left:0 !important",
    ],
    [
      `& ${P("button")}`,
      "text-transform:uppercase;letter-spacing:0.3em;font-size:12px;font-weight:600",
    ],
    [
      `& ${P("pill")}`,
      "background:transparent !important;text-transform:uppercase;" +
        "letter-spacing:0.2em;font-size:11px;padding:6px 14px !important",
    ],
    ["&", "--brand-line:#262626;--brand-panel:#121212"],
    [
      `& ${P("footer")}`,
      "text-transform:uppercase;letter-spacing:0.24em;font-size:11px;text-align:center",
    ],
  ],

  minimal: [
    [
      "& .type-display",
      "font-variation-settings:normal;font-weight:600;letter-spacing:-0.03em",
    ],
    [
      `& ${P("card")}`,
      "border:0 !important;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 12px 32px rgba(0,0,0,0.07)",
    ],
    [
      `& ${P("field")}`,
      "background:var(--brand-panel) !important;border-color:transparent !important;border-radius:14px !important",
    ],
    [`& ${P("button")}`, "font-weight:500"],
    [`& ${P("section-title")}`, "font-weight:600;letter-spacing:-0.01em"],
    [
      `& ${P("pill")}`,
      "border:0 !important;border-radius:999px !important;padding:6px 14px !important",
    ],
    [
      `& ${P("manifest")} dl`,
      "background:var(--brand-panel);border-radius:18px;padding:4px 20px",
    ],
    [`& ${P("help")}`, "border:0 !important;border-radius:18px !important;text-align:center"],
    [`& ${P("footer")}`, "border-top-width:0 !important;text-align:center"],
  ],

  spotlight: [
    [
      "& .type-display",
      "font-weight:800;letter-spacing:-0.035em",
    ],
    // The two heroes re-point the page's own variables, so everything inside
    // — the subtitle, the status badge, the name — recolours itself on the
    // filled background without a single component knowing it moved.
    [
      `& ${P("intro")},& ${P("order-head")}`,
      "background:var(--brand-accent);border-radius:28px;padding:40px 32px;" +
        "--brand-text:var(--brand-on-accent);color:var(--brand-on-accent);" +
        "--brand-muted:color-mix(in srgb,var(--brand-on-accent) 78%,var(--brand-accent));" +
        "--brand-line:color-mix(in srgb,var(--brand-on-accent) 30%,var(--brand-accent));" +
        "--brand-panel:color-mix(in srgb,var(--brand-on-accent) 14%,var(--brand-accent))",
    ],
    [`& ${P("subtitle")}`, "font-size:18px"],
    [`& ${P("band")}`, "padding-top:24px !important"],
    [
      `& ${P("card")}`,
      "border:0 !important;background:var(--brand-surface) !important;" +
        "box-shadow:0 18px 48px color-mix(in srgb,var(--brand-accent) 18%,transparent)",
    ],
    [`& ${P("button")}`, "font-weight:700"],
    [`& ${P("section-title")}`, "font-weight:800;letter-spacing:-0.01em"],
    [
      `& ${P("pill")}`,
      "border:0 !important;border-radius:999px !important;padding:6px 14px !important;font-weight:700",
    ],
    [
      `& ${P("manifest")},& ${P("events")} > div`,
      "border-radius:20px !important",
    ],
    [`& ${P("help")}`, "border:0 !important;border-radius:20px !important;background:var(--brand-wash) !important"],
  ],
};

/**
 * The scoped stylesheet for one design. `scope` is the page root's selector
 * (`#tracky-tracking`), and the design id is matched on its `data-design`
 * attribute too, so a stale sheet can never style a page set to another one.
 */
export function pageDesignCss(design: unknown, scope: string): string {
  const id = resolvePageDesign(design);
  const root = `${scope}[data-design="${id}"]`;

  return LAYERS[id]
    .map(([selector, body]) => {
      const scoped = selector
        .split(",")
        .map((part) => part.trim().replace(/^&/, root))
        .join(",");
      return `${scoped}{${body}}`;
    })
    .join("");
}
