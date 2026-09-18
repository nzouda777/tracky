/**
 * The tracking page's styles, as one self-contained sheet.
 *
 * On our own domain the page is styled by the app's Tailwind build. Inside a
 * Shopify theme it cannot be: that build ships Tailwind's preflight, a global
 * reset that would land on the merchant's header, nav and footer and take them
 * apart. Loading it would style our page by breaking their site.
 *
 * So the embedded page carries its own CSS instead, and every rule here is
 * confined in two ways:
 *
 *   - **Scoped.** Every selector sits under `#tracky-tracking`, so nothing
 *     reaches a single element the theme owns.
 *   - **Bounded.** The reset covers only the elements this page actually
 *     renders, and only inside that scope, so the theme's own typography and
 *     spacing are untouched.
 *
 * The class names are the ones the components already use, which is why none
 * of them had to change: this sheet simply supplies, in a scoped form, what
 * Tailwind supplies globally elsewhere. `tests/tracking-embed-styles.test.ts`
 * reads the components and fails if one of them uses a class this file does
 * not define, because that drift would otherwise appear only as a subtly
 * broken layout on a merchant's storefront.
 */

export const TRACKING_SCOPE_ID = "tracky-tracking";

const S = `#${TRACKING_SCOPE_ID}`;

/** Tailwind's spacing scale, in rem, for the steps this page uses. */
const SPACE: Record<string, string> = {
  "0": "0",
  "0.5": "0.125rem",
  "1": "0.25rem",
  "1.5": "0.375rem",
  "2": "0.5rem",
  "2.5": "0.625rem",
  "3": "0.75rem",
  "3.5": "0.875rem",
  "4": "1rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "7": "1.75rem",
  "9": "2.25rem",
  "12": "3rem",
};

/**
 * One rule, with the scope distributed across every selector in the list.
 *
 * `#scope h1,h2` would mean "`h1` inside the scope, or `h2` anywhere" — the
 * comma ends the descendant relationship, and the rest of the list escapes
 * onto the merchant's page. Each part therefore gets its own prefix.
 */
function rule(selector: string, body: string): string {
  const scoped = selector
    .split(",")
    .map((part) => part.trim())
    .map((part) => (part ? `${S} ${part}` : S))
    .join(",");

  return `${scoped}{${body}}`;
}

/**
 * A rule for a class carried by the scope element itself.
 *
 * `#id .cls` is a descendant selector and matches nothing when the class sits
 * on `#id`. Both forms are emitted, so a class used on the root and on a child
 * behaves the same either way.
 */
function rootRule(className: string, body: string): string {
  return `${S}${className},${S} ${className}{${body}}`;
}

/**
 * A class name as it has to be written in a selector.
 *
 * Tailwind's scale contains half steps, so the class is `py-2.5` — and in a
 * selector an unescaped dot starts a *second* class name, making `.py-2.5`
 * mean "carries `py-2` and `5`". It matches nothing, silently.
 */
function escapeClass(name: string): string {
  return name.replace(/([.:[\]])/g, "\\$1");
}

/** `p-5`, `mt-9`, `gap-x-3` … for one property and a set of steps. */
function scale(
  prefix: string,
  properties: string[],
  steps: string[],
): string[] {
  return steps.map((step) =>
    rule(
      `.${escapeClass(`${prefix}-${step}`)}`,
      properties.map((property) => `${property}:${SPACE[step]}`).join(";"),
    ),
  );
}

// ---------------------------------------------------------------------------
// Reset — only our elements, only inside our scope
// ---------------------------------------------------------------------------

const RESET = [
  // The theme's box model is whatever it is; ours is predictable. Written out
  // rather than passed through `rule`, because the scope itself is one of the
  // subjects here, not only its descendants.
  `${S},${S} *,${S} *::before,${S} *::after{box-sizing:border-box}`,

  rule(
    "",
    // Border defaults matter: the utilities below set widths only, and with no
    // colour of their own they would inherit the theme's, or currentColor.
    "border:0 solid var(--brand-line,currentColor);" +
      "-webkit-font-smoothing:antialiased;" +
      "text-align:left",
  ),
  `${S} *{border-width:0;border-style:solid;border-color:var(--brand-line,currentColor)}`,

  // `text-transform` and `letter-spacing` are in here because themes set them
  // on headings — uppercase, widely tracked — and both inherit. Without this
  // the page's own headings arrive in the theme's voice rather than the
  // store's branding, which is the thing the customer is supposed to see.
  rule(
    "h1,h2,h3,p,dl,dd,ol,ul,figure,address",
    "margin:0;padding:0;font-size:inherit;font-weight:inherit;font-style:normal;" +
      "text-transform:none;letter-spacing:normal;line-height:inherit",
  ),
  rule("ol,ul", "list-style:none"),
  rule("address", "font-style:normal"),
  rule(
    "a",
    "color:inherit;text-decoration:inherit;background-color:transparent",
  ),
  rule(
    "button,input,select,textarea",
    "font:inherit;color:inherit;margin:0;padding:0;background:transparent;border-radius:0",
  ),
  rule("button", "cursor:pointer;-webkit-appearance:button;text-align:inherit"),
  rule("img,svg", "display:block;max-width:100%;height:auto"),
  rule("summary", "display:list-item;cursor:pointer"),
  rule("details>summary::-webkit-details-marker", "display:none"),
  rule("time", "font-variant-numeric:tabular-nums"),
  rule(":focus-visible", "outline:2px solid var(--brand-signal,#F5A524);outline-offset:2px"),
];

// ---------------------------------------------------------------------------
// The page's own classes
// ---------------------------------------------------------------------------

const IDENTITY = [
  // Not `min-height:100dvh` here, unlike the standalone page: inside a theme
  // the page is one band between the merchant's header and footer, and forcing
  // it to a viewport height would push their footer off the fold.
  rootRule(
    ".tracking-root",
    "background-color:var(--brand-surface);" +
      "color:var(--brand-text);" +
      "font-family:var(--brand-font);" +
      "font-size:calc(1rem * var(--brand-scale,1));" +
      "line-height:1.5",
  ),
  rootRule(".min-h-dvh", "min-height:auto"),

  rule(
    ".type-display",
    'font-variation-settings:"wdth" 118;font-weight:700;letter-spacing:-0.015em',
  ),
  rule(
    ".type-code",
    "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" +
      "font-variant-numeric:tabular-nums;font-weight:500",
  ),

  `@keyframes tracky-waypoint-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.35)}}`,
  rule(".waypoint-pulse", "animation:tracky-waypoint-pulse 2.4s ease-in-out infinite"),
];

const TYPE = [
  rule(".text-caption", "font-size:.8125rem;line-height:1.125rem;font-weight:500"),
  rule(".text-small", "font-size:.875rem;line-height:1.375rem"),
  rule(".text-body", "font-size:1rem;line-height:1.625rem"),
  rule(".text-h3", "font-size:1.0625rem;line-height:1.5rem"),
  rule(".text-h2", "font-size:1.3125rem;line-height:1.75rem"),
  rule(".text-h1", "font-size:1.625rem;line-height:2rem"),
  rule(".font-medium", "font-weight:500"),
  rule(".font-semibold", "font-weight:600"),
  rule(".text-center", "text-align:center"),
  rule(".text-right", "text-align:right"),
  rule(".not-italic", "font-style:normal"),
  rule(".underline", "text-decoration-line:underline"),
  rule(".underline-offset-2", "text-underline-offset:2px"),
];

const LAYOUT = [
  rule(".block", "display:block"),
  rule(".flex", "display:flex"),
  rule(".inline-flex", "display:inline-flex"),
  rule(".grid", "display:grid"),
  rule(".flex-col", "flex-direction:column"),
  rule(".flex-wrap", "flex-wrap:wrap"),
  rule(".flex-1", "flex:1 1 0%"),
  rule(".shrink-0", "flex-shrink:0"),
  rule(".items-center", "align-items:center"),
  rule(".items-baseline", "align-items:baseline"),
  rule(".justify-between", "justify-content:space-between"),
  rule(".place-items-center", "place-items:center"),
  rule(".relative", "position:relative"),
  rule(".absolute", "position:absolute"),
  rule(".inset-0", "inset:0"),
  rule(".mx-auto", "margin-left:auto;margin-right:auto"),
  rule(".w-full", "width:100%"),
  rule(".w-auto", "width:auto"),
  rule(".w-0", "width:0"),
  rule(".min-w-0", "min-width:0"),
  rule(".max-w-\\[40rem\\]", "max-width:40rem"),
  rule(".min-h-3", "min-height:.75rem"),
  rule(".h-9", "height:2.25rem"),
  rule(".object-contain", "object-fit:contain"),
  rule(".cursor-pointer", "cursor:pointer"),
  rule(".rounded-full", "border-radius:9999px"),
  rule(".rounded-control", "border-radius:4px"),
  rule(".rounded-panel", "border-radius:10px"),
];

const SIZES = ["2", "3", "3.5", "5"].map((step) =>
  rule(
    `.${escapeClass(`size-${step}`)}`,
    `width:${SPACE[step]};height:${SPACE[step]}`,
  ),
);

const BORDERS = [
  rule(".border-t", "border-top-width:1px"),
  rule(".border-b", "border-bottom-width:1px"),
  rule(".border-2", "border-width:2px"),
  rule(".border-l-2", "border-left-width:2px"),
  rule(".last\\:border-b-0:last-child", "border-bottom-width:0"),
  rule(".last\\:pb-0:last-child", "padding-bottom:0"),
];

const SPACING = [
  ...scale("p", ["padding"], ["5"]),
  ...scale("px", ["padding-left", "padding-right"], ["2.5", "3", "3.5", "4", "5"]),
  ...scale("py", ["padding-top", "padding-bottom"], ["1", "2.5", "3", "3.5", "9"]),
  ...scale("pt", ["padding-top"], ["5"]),
  ...scale("pb", ["padding-bottom"], ["7"]),
  ...scale("mt", ["margin-top"], ["0.5", "1.5", "3", "4", "5", "9", "12"]),
  ...scale("mb", ["margin-bottom"], ["3", "9"]),
  ...scale("gap", ["gap"], ["2", "3", "3.5"]),
  ...scale("gap-x", ["column-gap"], ["3", "4", "6"]),
  ...scale("gap-y", ["row-gap"], ["0.5", "1", "2"]),
];

/** `space-y-N` — a margin between siblings, never around the group. */
const SPACE_Y = ["1", "1.5", "3", "4", "9"].map((step) =>
  rule(`.${escapeClass(`space-y-${step}`)}>*+*`, `margin-top:${SPACE[step]}`),
);

// ---------------------------------------------------------------------------
// `sm:` — Tailwind's 40rem breakpoint
// ---------------------------------------------------------------------------

const SM = [
  rule(".sm\\:p-6", `padding:${SPACE["6"]}`),
  rule(".sm\\:px-1", `padding-left:${SPACE["1"]};padding-right:${SPACE["1"]}`),
  rule(".sm\\:py-12", `padding-top:${SPACE["12"]};padding-bottom:${SPACE["12"]}`),
  rule(".sm\\:pb-0", "padding-bottom:0"),
  rule(".sm\\:mt-2\\.5", `margin-top:${SPACE["2.5"]}`),
  rule(".sm\\:gap-0", "gap:0"),
  rule(".sm\\:grid-cols-2", "grid-template-columns:repeat(2,minmax(0,1fr))"),
  rule(".sm\\:flex-row", "flex-direction:row"),
  rule(".sm\\:flex-col", "flex-direction:column"),
  rule(".sm\\:flex-1", "flex:1 1 0%"),
  rule(".sm\\:items-start", "align-items:flex-start"),
  rule(".sm\\:text-center", "text-align:center"),
  rule(".sm\\:w-auto", "width:auto"),
  rule(".sm\\:w-full", "width:100%"),
  rule(".sm\\:min-w-0", "min-width:0"),
  rule(".sm\\:min-h-0", "min-height:0"),
  rule(".sm\\:h-0", "height:0"),
  rule(".sm\\:border-t-2", "border-top-width:2px"),
  rule(".sm\\:border-l-0", "border-left-width:0"),
  rule(".sm\\:border-transparent", "border-color:transparent"),
];

const REDUCED_MOTION =
  `@media (prefers-reduced-motion:reduce){` +
  rule(".waypoint-pulse", "animation:none") +
  `${S} *,${S} *::before,${S} *::after{animation-duration:.01ms !important;` +
  `animation-iteration-count:1 !important;transition-duration:.01ms !important}}`;

/** The whole sheet, minified, ready to inline in a `<style>` element. */
export const TRACKING_EMBED_CSS = [
  ...RESET,
  ...IDENTITY,
  ...TYPE,
  ...LAYOUT,
  ...SIZES,
  ...BORDERS,
  ...SPACING,
  ...SPACE_Y,
  `@media (min-width:40rem){${SM.join("")}}`,
  REDUCED_MOTION,
].join("");
