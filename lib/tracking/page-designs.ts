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
    layout: "column",
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
    layout: "column",
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
    layout: "column",
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
    layout: "column",
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
    layout: "column",
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
    layout: "column",
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
  {
    id: "showroom",
    layout: "split",
    name: "Showroom",
    tagline: "Split screen, brand panel",
    description:
      "The page splits in two: a full-height panel in your brand colour holds the headline and progress, the details scroll beside it. Stacks on phones.",
    swatches: ["#0F3D3E", "#FFFFFF", "#F2B705"],
    preset: {
      primaryColor: "#0F3D3E",
      accentColor: "#0F3D3E",
      backgroundColor: "#FFFFFF",
      textColor: "#111418",
      secondaryColor: "#F2B705",
      fontFamily: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
      headingFontSize: 48,
      contentAlignment: "left",
      cardRadius: 16,
      buttonRadius: 12,
      buttonFullWidth: true,
      sectionBackground: null,
    },
  },
  {
    id: "ticket",
    layout: "ticket",
    name: "Boarding pass",
    tagline: "The order as a ticket",
    description:
      "The order is drawn as a boarding pass: order date, destination, status, a tear line and a barcode stub, above the full journey.",
    swatches: ["#EEF1F5", "#1D3557", "#E63946"],
    preset: {
      primaryColor: "#1D3557",
      accentColor: "#1D3557",
      backgroundColor: "#EEF1F5",
      textColor: "#14213D",
      secondaryColor: "#E63946",
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      headingFontSize: 40,
      contentAlignment: "center",
      cardRadius: 18,
      buttonRadius: 12,
      buttonFullWidth: true,
      sectionBackground: "#FFFFFF",
    },
  },
  {
    id: "journey",
    layout: "journey",
    name: "Journey",
    tagline: "Progress first, dashboard feel",
    description:
      "A giant status headline with a segmented progress bar, numbered step cards instead of a line, and the order facts as tiles.",
    swatches: ["#FFFFFF", "#2563EB", "#0F172A"],
    preset: {
      primaryColor: "#2563EB",
      accentColor: "#2563EB",
      backgroundColor: "#FFFFFF",
      textColor: "#0F172A",
      secondaryColor: "#22C55E",
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      headingFontSize: 44,
      contentAlignment: "left",
      cardRadius: 16,
      buttonRadius: 12,
      buttonFullWidth: true,
      sectionBackground: "#F8FAFC",
    },
  },
  {
    id: "atelier",
    layout: "atelier",
    name: "Atelier",
    tagline: "Fashion-house index",
    description:
      "An oversized Didone wordmark over tiny uppercase type. The steps become a numbered index between hairlines, beside the status on desktop.",
    swatches: ["#FFFFFF", "#000000", "#6B6B6B"],
    preset: {
      primaryColor: "#000000",
      accentColor: "#000000",
      backgroundColor: "#FFFFFF",
      textColor: "#000000",
      secondaryColor: "#000000",
      fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
      headingFontSize: 40,
      contentAlignment: "left",
      cardRadius: 0,
      buttonRadius: 0,
      buttonFullWidth: true,
      sectionBackground: null,
    },
  },
  {
    id: "beaute",
    layout: "beaute",
    name: "Beauté",
    tagline: "Graphic stripes, bold and upbeat",
    description:
      "A black bar with your store name over a stripe band, a bold centred headline and a stat strip with the order's key facts.",
    swatches: ["#000000", "#FFFFFF", "#E4007C"],
    preset: {
      primaryColor: "#000000",
      accentColor: "#000000",
      backgroundColor: "#FFFFFF",
      textColor: "#000000",
      secondaryColor: "#E4007C",
      fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
      headingFontSize: 44,
      contentAlignment: "center",
      cardRadius: 0,
      buttonRadius: 0,
      buttonFullWidth: true,
      sectionBackground: "#F6F6F6",
    },
  },
  {
    id: "maison",
    layout: "maison",
    name: "Maison",
    tagline: "A letter from a luxury house",
    description:
      "A gold monogram and a double-framed card on cream, serif small capitals, and the order opened like a letter addressed to your customer.",
    swatches: ["#F7F3EC", "#B89B5E", "#3B2A1E"],
    preset: {
      primaryColor: "#3B2A1E",
      accentColor: "#3B2A1E",
      backgroundColor: "#F7F3EC",
      textColor: "#3B2A1E",
      secondaryColor: "#B89B5E",
      fontFamily: "Georgia, 'Times New Roman', Times, serif",
      headingFontSize: 34,
      contentAlignment: "center",
      cardRadius: 0,
      buttonRadius: 0,
      buttonFullWidth: true,
      sectionBackground: "#FFFDF9",
    },
  },
  {
    id: "classic",
    layout: "classic",
    name: "Classic",
    tagline: "A carrier's tracking card",
    description:
      "A white tracking card with the four-phase progress bar, a green last update and a full timeline of every step — the familiar parcel-carrier page.",
    swatches: ["#FFFFFF", "#F7F8F8", "#111111"],
    preset: {
      primaryColor: "#111111",
      accentColor: "#111111",
      backgroundColor: "#FFFFFF",
      textColor: "#111111",
      secondaryColor: "#888888",
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      headingFontSize: 28,
      contentAlignment: "left",
      cardRadius: 16,
      buttonRadius: 10,
      buttonFullWidth: false,
      sectionBackground: "#F7F8F8",
    },
  },
] as const;

/**
 * The page's skeleton. `column` is one centred column restyled by CSS; the
 * others are different markup — see `components/tracking/layouts.tsx`.
 */
export type PageDesign = (typeof PAGE_DESIGNS)[number];
export type PageLayout = PageDesign["layout"];
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
const DIDONE = "Didot,'Bodoni 72','Bodoni MT','Playfair Display',Georgia,serif";

/** Small uppercase type, the voice of Atelier and Maison. */
const TINY_CAPS =
  "font-size:11px;line-height:16px;letter-spacing:0.12em;text-transform:uppercase";

/** A field reduced to its baseline. */
const UNDERLINED =
  "border-width:0 0 1px !important;border-radius:0 !important;" +
  "background:transparent !important;padding-left:0 !important";

/** `[data-part="x"]` — the hooks `tracking-page.tsx` and friends carry. */
const P = (part: string) => `[data-part="${part}"]`;

/**
 * Two-column breakpoint, in px of the page's own width.
 *
 * A container query, not a media query: the page is also shown in the
 * branding editor's narrow preview pane and can be embedded in a narrow theme
 * column, and in both the viewport is far wider than the page. Measuring the
 * viewport there squeezed the desktop grid into a few hundred pixels.
 */
const WIDE = "(min-width:900px)";

/**
 * A rule, with `&` standing for the scoped root. Kept as `[selector, body]`
 * so each selector can have the scope distributed across its comma list —
 * `& a,b` would otherwise leak `b` onto the theme. An optional third element
 * wraps the rule in a container query on the page root.
 */
type LayerRule = [selector: string, body: string, query?: string];

/**
 * Re-points the page's colour variables for a block filled with the brand
 * colour, so every component inside recolours itself without knowing.
 */
const ON_ACCENT =
  "background:var(--brand-accent);color:var(--brand-on-accent);" +
  "--brand-text:var(--brand-on-accent);" +
  "--brand-muted:color-mix(in srgb,var(--brand-on-accent) 74%,var(--brand-accent));" +
  "--brand-line:color-mix(in srgb,var(--brand-on-accent) 26%,var(--brand-accent));" +
  "--brand-panel:color-mix(in srgb,var(--brand-on-accent) 12%,var(--brand-accent))";

const LAYERS: Record<PageDesignId, LayerRule[]> = {
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

  // --- Showroom: two panels -------------------------------------------------
  showroom: [
    ["& .type-display", "font-weight:800;letter-spacing:-0.035em"],
    [`& ${P("split-panel")}`, ON_ACCENT + ";padding:40px 24px 44px"],
    [`& ${P("split-main")}`, "padding:40px 24px 56px"],
    [`& ${P("split-panel")} ${P("masthead")}`, "margin-bottom:24px !important"],
    [`& ${P("split-panel")} ${P("masthead")} p`, "color:var(--brand-on-accent) !important"],
    [`& ${P("split-title")}`, "font-size:var(--brand-heading-size);line-height:1.02"],
    [`& ${P("progress")}`, "display:flex;gap:6px;margin-top:14px"],
    [`& ${P("progress")} > span`, "flex:1 1 0%;height:6px;border-radius:999px;background:var(--brand-line)"],
    [`& ${P("progress")} > span[data-on]`, "background:var(--brand-on-accent)"],
    [
      `& ${P("card")}`,
      "max-width:none !important;box-shadow:0 1px 2px rgba(0,0,0,0.05),0 10px 30px rgba(0,0,0,0.06)",
    ],
    [`& ${P("pill")}`, "border-radius:999px !important"],
    [
      `& ${P("split")}`,
      "display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);min-height:680px",
      WIDE,
    ],
    [`& ${P("split-panel")}`, "padding:64px 56px", WIDE],
    [`& ${P("split-inner")}`, "position:sticky;top:48px", WIDE],
    [`& ${P("split-main")}`, "padding:64px 56px 72px;max-width:760px", WIDE],
  ],

  // --- Boarding pass --------------------------------------------------------
  ticket: [
    ["& .type-display", "font-weight:800;letter-spacing:-0.03em"],
    [
      `& ${P("ticket")}`,
      "position:relative;background:var(--brand-section);border-radius:var(--brand-card-radius);" +
        "box-shadow:0 1px 2px rgba(0,0,0,0.06),0 18px 40px rgba(20,33,61,0.10);text-align:left",
    ],
    [
      `& ${P("ticket-head")}`,
      ON_ACCENT +
        ";display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 24px;" +
        "border-radius:var(--brand-card-radius) var(--brand-card-radius) 0 0;" +
        "font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase",
    ],
    [`& ${P("ticket-body")}`, "padding:24px"],
    [`& ${P("ticket-route")}`, "display:flex;align-items:center;gap:12px"],
    [`& ${P("ticket-route")} > div`, "flex:1 1 0%;min-width:0"],
    [`& ${P("ticket-route")} > div:last-child`, "text-align:right"],
    [
      `& ${P("ticket-label")}`,
      "display:block;font-size:11px;font-weight:700;letter-spacing:0.14em;" +
        "text-transform:uppercase;color:var(--brand-muted)",
    ],
    [
      `& ${P("ticket-value")}`,
      "display:block;font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.2",
    ],
    [`& ${P("ticket-status")}`, "margin:24px 0;padding:18px 0;border-top:1px solid var(--brand-line);border-bottom:1px solid var(--brand-line)"],
    [`& ${P("ticket-tear")}`, "position:relative;margin:4px 0;border-top:2px dashed var(--brand-line)"],
    [
      `& ${P("ticket-notch")}`,
      "position:absolute;top:-15px;width:28px;height:28px;border-radius:999px;background:var(--brand-surface)",
    ],
    [
      `& ${P("ticket-stub")}`,
      "display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 24px 22px",
    ],
    [
      `& ${P("barcode")}`,
      "flex:1 1 0%;max-width:260px;height:46px;background:repeating-linear-gradient(90deg," +
        "var(--brand-text) 0 2px,transparent 2px 4px,var(--brand-text) 4px 5px,transparent 5px 8px," +
        "var(--brand-text) 8px 11px,transparent 11px 13px)",
    ],
    [
      `& ${P("ticket")} ${P("card")}`,
      "background:transparent !important;border:0 !important;max-width:none !important;" +
        "margin:0 !important;padding:24px !important",
    ],
    [`& ${P("pill")}`, "border-radius:999px !important"],
  ],

  // --- Journey --------------------------------------------------------------
  journey: [
    ["& .type-display", "font-weight:800;letter-spacing:-0.035em"],
    [`& ${P("journey-title")}`, "font-size:var(--brand-heading-size);line-height:1.04"],
    [`& ${P("progress")}`, "display:flex;gap:6px;margin-top:20px"],
    [`& ${P("progress")} > span`, "flex:1 1 0%;height:10px;border-radius:999px;background:var(--brand-line)"],
    [`& ${P("progress")} > span[data-on]`, "background:var(--brand-accent)"],
    [`& ${P("steps")}`, "display:grid;gap:10px"],
    [
      `& ${P("step")}`,
      "display:flex;align-items:center;gap:14px;padding:14px 16px;" +
        "border:1px solid var(--brand-line);border-radius:var(--brand-card-radius)",
    ],
    [
      `& ${P("step")}[data-state="current"]`,
      ON_ACCENT +
        ";border-color:transparent;box-shadow:0 12px 28px color-mix(in srgb,var(--brand-accent) 28%,transparent)",
    ],
    [`& ${P("step")}[data-state="upcoming"]`, "opacity:0.6"],
    [
      `& ${P("step-number")}`,
      "flex-shrink:0;display:grid;place-items:center;width:36px;height:36px;border-radius:999px;" +
        "background:var(--brand-panel);font-weight:800;font-variant-numeric:tabular-nums",
    ],
    [
      `& ${P("step")}[data-state="complete"] ${P("step-number")}`,
      "background:var(--brand-text);color:var(--brand-surface)",
    ],
    [`& ${P("step-state")}`, "margin-left:auto;font-size:13px;font-weight:700;color:var(--brand-muted)"],
    [`& ${P("journey-split")}`, "display:grid;gap:36px"],
    [`& ${P("journey-hero")}`, "display:flex;flex-direction:column;gap:28px"],
    [`& ${P("manifest")} dl`, "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"],
    [
      `& ${P("manifest")} dl > div`,
      "display:block !important;border:0 !important;background:var(--brand-section);" +
        "border-radius:var(--brand-card-radius);padding:14px 16px !important",
    ],
    [`& ${P("manifest")} dl > div:last-child`, "grid-column:1 / -1"],
    [
      `& ${P("manifest")} dt`,
      "width:auto !important;font-size:12px;font-weight:700;letter-spacing:0.08em;" +
        "text-transform:uppercase;margin-bottom:4px",
    ],
    [`& ${P("events")} > div`, "border-radius:var(--brand-card-radius) !important"],
    [
      `& ${P("card")}`,
      "max-width:none !important;border:0 !important;" +
        "box-shadow:0 1px 2px rgba(0,0,0,0.05),0 14px 36px rgba(15,23,42,0.08)",
    ],
    [`& ${P("pill")}`, "border-radius:999px !important"],
    [
      `& ${P("journey-hero")}`,
      "display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px;align-items:center",
      WIDE,
    ],
    [
      `& ${P("journey-split")}`,
      "grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start",
      WIDE,
    ],
  ],

  // --- Atelier: type only ---------------------------------------------------
  atelier: [
    [
      "& .type-display",
      `font-family:${DIDONE};font-variation-settings:normal;font-weight:400;` +
        "text-transform:uppercase;letter-spacing:0.02em",
    ],
    [`& ${P("atelier")}`, "max-width:1180px;margin:0 auto;padding:48px 20px 56px"],
    [
      `& ${P("atelier-wordmark")}`,
      "font-size:calc(var(--brand-heading-size) * 1.6);line-height:0.95;text-align:center;" +
        "letter-spacing:0.04em;padding-bottom:40px;margin-bottom:48px;border-bottom:1px solid var(--brand-text)",
    ],
    [`& ${P("atelier-grid")}`, "display:grid;gap:48px"],
    [`& ${P("atelier-title")}`, "font-size:var(--brand-heading-size);line-height:1.02"],
    [`& ${P("atelier-small")}`, TINY_CAPS],
    [`& ${P("subtitle")}`, `${TINY_CAPS};letter-spacing:0.06em;max-width:360px !important`],
    [`& ${P("section-title")}`, `${TINY_CAPS};font-weight:600;letter-spacing:0.16em`],
    [`& ${P("card")}`, "border:0 !important;background:transparent !important;padding:0 !important;max-width:none !important"],
    [`& ${P("field")}`, UNDERLINED],
    [`& ${P("button")}`, `${TINY_CAPS};font-size:12px;font-weight:600;letter-spacing:0.22em`],
    [`& ${P("index")}`, "border-bottom:1px solid var(--brand-text)"],
    [
      `& ${P("index-row")}`,
      `${TINY_CAPS};display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:16px;` +
        "padding:14px 0;border-top:1px solid var(--brand-text)",
    ],
    [`& ${P("index-row")}[data-state="current"]`, "font-weight:700"],
    [`& ${P("index-row")}[data-state="upcoming"]`, "color:var(--brand-muted)"],
    [`& ${P("manifest")} dl > div`, "border-color:var(--brand-text) !important"],
    [`& ${P("manifest")} dt`, `${TINY_CAPS};padding-top:2px`],
    [`& ${P("events")} > div`, "border-radius:0 !important"],
    [`& ${P("help")}`, "background:transparent !important;border-width:1px 0 !important;border-radius:0 !important;padding-left:0 !important"],
    [`& ${P("footer")}`, `${TINY_CAPS};border-color:var(--brand-text) !important`],
    [
      `& ${P("atelier-grid")}`,
      "grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:96px;align-items:start",
      WIDE,
    ],
    [`& ${P("atelier-aside")}`, "position:sticky;top:48px", WIDE],
  ],

  // --- Beauté: stripes and a stat strip -------------------------------------
  beaute: [
    [
      "& .type-display",
      `font-family:${GROTESK};font-variation-settings:normal;font-weight:800;letter-spacing:-0.02em`,
    ],
    [
      `& ${P("beaute-bar")}`,
      "background:var(--brand-text);color:var(--brand-surface);text-align:center;padding:22px 20px;" +
        "font-size:22px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase",
    ],
    [`& ${P("beaute-bar")}[data-logo]`, "background:var(--brand-surface);padding:18px 20px"],
    [
      `& ${P("stripes")}`,
      "height:14px;background:repeating-linear-gradient(90deg,var(--brand-text) 0 24px,var(--brand-surface) 24px 48px)",
    ],
    [
      `& ${P("beaute-eyebrow")}`,
      "color:var(--brand-signal);font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase",
    ],
    [`& ${P("beaute-title")}`, "font-size:var(--brand-heading-size);line-height:1.05"],
    [
      `& ${P("stats")}`,
      "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;" +
        "background:var(--brand-section);padding:20px 12px;text-align:center",
    ],
    [
      `& ${P("stat")} dt`,
      "font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;" +
        "color:var(--brand-muted);margin-bottom:4px",
    ],
    [`& ${P("stat")} dd`, "font-size:15px;font-weight:700;line-height:1.3"],
    [`& ${P("card")}`, "border:0 !important;background:var(--brand-section) !important"],
    [`& ${P("button")}`, "text-transform:uppercase;font-weight:800;letter-spacing:0.12em;font-size:14px"],
    [`& ${P("section-title")}`, "text-transform:uppercase;font-weight:800;letter-spacing:0.06em;font-size:15px"],
    [`& ${P("manifest")}`, "border-top:3px solid var(--brand-text);padding-top:16px"],
    [`& ${P("events")}`, "border-top:3px solid var(--brand-text);padding-top:16px"],
    [`& ${P("help")}`, "border:0 !important;border-radius:0 !important;text-align:center;font-weight:700"],
    [`& ${P("footer")}`, "border-top-width:0 !important;text-align:center;margin-top:0 !important"],
  ],

  // --- Maison: the letter -----------------------------------------------------
  maison: [
    [
      "& .type-display",
      `font-family:${SERIF};font-variation-settings:normal;font-weight:400;` +
        "text-transform:uppercase;letter-spacing:0.06em",
    ],
    [
      `& ${P("monogram")}`,
      `display:grid;place-items:center;width:64px;height:64px;border-radius:999px;` +
        `border:1px solid var(--brand-signal);font-family:${SERIF};font-size:22px;letter-spacing:0.08em`,
    ],
    [`& ${P("caps")}`, `font-family:${SERIF};${TINY_CAPS};letter-spacing:0.3em;color:var(--brand-muted)`],
    [`& ${P("frame")}`, "border:1px solid var(--brand-signal);padding:6px;background:var(--brand-section)"],
    [
      `& ${P("frame-inner")}`,
      "border:1px solid var(--brand-signal);padding:44px 22px 40px;text-align:center;" +
        "display:flex;flex-direction:column;align-items:center;gap:20px",
    ],
    [`& ${P("maison-title")}`, "font-size:var(--brand-heading-size);line-height:1.2"],
    [`& ${P("gold-rule")}`, "display:block;width:40px;border-top:1px solid var(--brand-signal)"],
    [`& ${P("letter")}`, `font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.6`],
    [`& ${P("letter")} ${P("subtitle")}`, "font-size:17px"],
    [`& ${P("frame-body")}`, "align-self:stretch;text-align:left;margin-top:12px"],
    [`& ${P("card")}`, "border:0 !important;background:transparent !important;padding:0 !important;max-width:none !important"],
    [`& ${P("field")}`, UNDERLINED],
    [`& ${P("button")}`, `font-family:${SERIF};text-transform:uppercase;letter-spacing:0.28em;font-size:12px;font-weight:400`],
    [
      `& ${P("section-title")}`,
      `font-family:${SERIF};font-weight:400;${TINY_CAPS};letter-spacing:0.3em;text-align:center`,
    ],
    [`& ${P("manifest")} dl > div`, "border-color:color-mix(in srgb,var(--brand-signal) 45%,transparent) !important"],
    [`& ${P("events")} > div`, "border-radius:0 !important"],
    [`& ${P("help")}`, `background:transparent !important;border:0 !important;text-align:center;font-family:${SERIF};font-style:italic`],
    [`& ${P("footer")}`, `font-family:${SERIF};font-style:italic;text-align:center;border-color:var(--brand-signal) !important`],
    [`& ${P("frame-inner")}`, "padding:60px 56px 52px", WIDE],
  ],

  // --- Classic: the carrier's tracking card -----------------------------------
  classic: [
    [
      "& .type-display",
      "font-variation-settings:normal;font-weight:700;letter-spacing:-0.01em",
    ],
    [`& ${P("classic")}`, "background:var(--brand-section);min-height:100%"],
    [
      `& ${P("classic-header")}`,
      "background:var(--brand-surface);border-bottom:1px solid var(--brand-line);padding:18px 0",
    ],
    [`& ${P("classic-inner")}`, "max-width:680px;margin:0 auto;padding-left:16px;padding-right:16px"],
    [`& main${P("classic-inner")}`, "padding-top:28px;padding-bottom:40px"],
    [`& ${P("classic-header")} ${P("masthead")}`, "margin-bottom:12px !important"],
    [`& ${P("classic-title")}`, "font-size:20px;line-height:28px"],
    [
      `& ${P("classic-card")}, & ${P("classic-search")}`,
      "background:var(--brand-surface);border-radius:var(--brand-card-radius);padding:24px 20px;" +
        "box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 28px rgba(0,0,0,0.06)",
    ],
    [
      `& ${P("classic-meta")}`,
      "display:flex;justify-content:space-between;align-items:flex-start;gap:24px",
    ],
    [
      `& ${P("classic-label")}`,
      "margin:0 0 1px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--brand-muted)",
    ],
    [`& ${P("classic-value")}`, "margin:0;font-size:16px;font-weight:700"],
    [
      `& ${P("classic-heading")}`,
      "margin:0 0 4px;padding-bottom:8px;border-bottom:1px solid var(--brand-line);" +
        "font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--brand-muted)",
    ],

    // The summary as label-left, value-right rows, under the "Order" heading.
    [`& ${P("classic-section")} ${P("manifest")} > ${P("section-title")}`, "display:none"],
    [`& ${P("classic-section")} ${P("manifest")} dl`, "margin-top:0 !important"],
    [
      `& ${P("classic-section")} ${P("manifest")} dl > div`,
      "justify-content:space-between;flex-wrap:nowrap !important;padding:8px 0 !important;" +
        "font-size:13px;border-color:color-mix(in srgb,var(--brand-line) 60%,var(--brand-surface)) !important",
    ],
    [`& ${P("classic-section")} ${P("manifest")} dt`, "width:auto !important;font-weight:500"],
    [
      `& ${P("classic-section")} ${P("manifest")} dd`,
      "flex:0 1 auto !important;text-align:right !important;font-weight:600",
    ],

    // The search row: the prompt above, field and button side by side.
    [`& ${P("classic-search")} ${P("subtitle")}`, "margin:0 !important;font-size:14px"],
    [
      `& ${P("classic-search")} ${P("card")}`,
      "border:0 !important;background:transparent !important;padding:0 !important;max-width:none !important",
    ],
    [
      `& ${P("classic-search")} ${P("field")}`,
      "border-radius:12px !important;border:1px solid var(--brand-line) !important;background:var(--brand-surface) !important",
    ],
    [`& ${P("classic-search")} ${P("button")}`, "border-radius:10px !important;padding-left:22px !important;padding-right:22px !important"],
    [`& ${P("faq")}, & ${P("help")}`, "background:var(--brand-surface);border-radius:var(--brand-card-radius);padding:20px !important"],
    [`& ${P("faq")} ${P("section-title")}`, "font-size:18px"],
    [`& ${P("footer")}`, "margin-top:0 !important;text-align:center;border-top-width:0 !important"],
    [`& ${P("classic-card")}, & ${P("classic-search")}`, "padding:28px 32px", WIDE],
    [
      `& ${P("classic-search")} form`,
      "display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;row-gap:14px;align-items:end",
      "(min-width:560px)",
    ],
    [`& ${P("classic-search")} form > *`, "grid-column:1 / -1;margin-top:0 !important", "(min-width:560px)"],
    [
      `& ${P("classic-search")} form > div:has(> ${P("field")})`,
      "grid-column:1",
      "(min-width:560px)",
    ],
    [`& ${P("classic-search")} form > ${P("button")}`, "grid-column:2;width:auto !important", "(min-width:560px)"],
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

  const rules = LAYERS[id];

  // The root is the container its own responsive rules measure. A container
  // no longer takes its width from its content, so it is given the full width
  // outright — in a theme's shrink-to-fit wrapper it would otherwise collapse.
  const container = rules.some(([, , query]) => query)
    ? `${root}{container-type:inline-size;width:100%}`
    : "";

  return (
    container +
    rules
      .map(([selector, body, query]) => {
        const scoped = selector
          .split(",")
          .map((part) => part.trim().replace(/^&/, root))
          .join(",");
        return query
          ? `@container ${query}{${scoped}{${body}}}`
          : `${scoped}{${body}}`;
      })
      .join("")
  );
}
