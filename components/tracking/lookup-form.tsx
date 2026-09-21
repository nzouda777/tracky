import type { Branding } from "./branding";

/**
 * The customer lookup.
 *
 * Two fields side by side read as a form to fill in; one reads as a question
 * to answer, which is the difference between a visitor trying and a visitor
 * closing the tab. So this asks for one thing at a time — and how many things
 * it asks for depends on which surface it is rendered on.
 *
 * `two-factor` — the Shopify App Proxy page. Step one takes whichever detail
 * the visitor has to hand, order number or email, and step two asks for the
 * other. Step two is always shown, whether or not step one matched anything,
 * so the form never reveals which orders or addresses exist.
 *
 * `order-only` — the hosted page on Tracky's own domain, where the order
 * number alone opens the order. One field, one submit, nothing else to
 * remember. What that buys in simplicity it pays for in privacy: order numbers
 * are sequential, so anyone can walk `#1001`, `#1002`, `#1003`. The page
 * answers by showing only what tracking needs and holding back the delivery
 * address, the full name and the address-change form until the visitor
 * confirms the email on the order — see `tracking-page.tsx`.
 *
 * Either way it is a GET form pointing at the page's own path, so on the proxy
 * surface Shopify signs the submitted parameters on the way back in.
 */
export type LookupStep =
  | { step: "identify" }
  | { step: "confirm"; value: string; kind: "email" | "order" };

/** How many details this surface asks a visitor for. */
export type LookupMode = "two-factor" | "email-only" | "order-only";

/** Decides which half of the pair a typed value is. */
export function classifyLookup(value: string): "email" | "order" {
  return value.includes("@") ? "email" : "order";
}

export function LookupForm({
  branding,
  proxyPath,
  state,
  error,
  mode = "two-factor",
}: {
  /** Wording and shape come from the store, with fallbacks per lookup mode. */
  branding: Pick<
    Branding,
    | "formPrompt"
    | "formPlaceholder"
    | "formButtonLabel"
    | "showFormIcon"
    | "showButtonArrow"
  >;
  proxyPath: string;
  state: LookupStep;
  error?: string | null;
  mode?: LookupMode;
}) {
  const fieldStyle = {
    border: "1px solid var(--brand-line)",
    backgroundColor: "var(--brand-surface)",
    color: "var(--brand-text)",
    borderRadius: "var(--brand-button-radius)",
  };

  const identifying = state.step === "identify";
  const orderOnly = mode === "order-only" && identifying;
  const emailOnly = mode === "email-only" && identifying;

  // What the page says when the store has not written its own. Derived from
  // the lookup policy rather than fixed, so the prompt can never ask for
  // something this surface would refuse.
  const defaults = emailOnly
    ? {
        prompt: "Enter the email address you used at checkout to get started",
        label: "Email address",
        placeholder: "you@example.com",
        action: "Track my order",
      }
    : orderOnly
      ? {
          prompt: "Enter your order number to get started",
          label: "Order number",
          placeholder: "#1042",
          action: "Track my order",
        }
      : {
          prompt: "Enter your order number or email address to get started",
          label: "Order number or email address",
          placeholder: "#1042 or you@example.com",
          action: "Continue",
        };

  return (
    <section
      className="p-5 sm:p-6"
      style={{
        // Follows the page rather than centring itself: on a left-aligned
        // page a self-centred card breaks the one vertical edge every other
        // block shares.
        marginInline: "var(--brand-inline)",
        backgroundColor: "var(--brand-card)",
        border: "1px solid var(--brand-line)",
        borderRadius: "var(--brand-card-radius)",
        // The form is the one thing on an empty tracking page, so it keeps its
        // own measure rather than running the full width of a wide column.
        // px, not rem: a theme that redefines the root font size would
        // otherwise shrink this measure along with everything else.
        maxWidth: "544px",
        textAlign: "left",
      }}
    >
      <form action={proxyPath} method="get" className="space-y-4">
        {error ? (
          <p
            role="alert"
            className="rounded-control px-3 py-2.5 text-small font-medium"
            style={{
              border:
                "1px solid color-mix(in srgb, #C4462F 45%, var(--brand-surface))",
              backgroundColor:
                "color-mix(in srgb, #C4462F 7%, var(--brand-surface))",
              color: "#8F2F1F",
            }}
          >
            {error}
          </p>
        ) : null}

        {state.step === "identify" ? (
          <>
            {/* The prompt, not a field label: one line telling the customer
                the single thing to reach for. A label above a lone input
                restates what the placeholder already says. */}
            <div className="flex items-center gap-2.5">
              {branding.showFormIcon ? <ParcelMark /> : null}
              <p className="text-body" style={{ color: "var(--brand-text)" }}>
                {branding.formPrompt.trim() || defaults.prompt}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="q" className="sr-only">
                {defaults.label}
              </label>
              <input
                id="q"
                name="q"
                // An email field on a phone brings up the right keyboard and
                // lets the browser autofill the address, which is the whole
                // point of asking for only one thing.
                type={emailOnly ? "email" : "text"}
                required
                autoFocus
                autoCapitalize="none"
                autoComplete={emailOnly ? "email" : "off"}
                spellCheck={false}
                placeholder={
                  branding.formPlaceholder.trim() || defaults.placeholder
                }
                className="w-full px-4 text-body"
                style={{ ...fieldStyle, height: "var(--brand-input-height)" }}
              />
            </div>

            <Submit
              label={branding.formButtonLabel.trim() || defaults.action}
              arrow={branding.showButtonArrow}
            />
          </>
        ) : (
          <>
            {/* Carries step one forward, so the pair arrives together. */}
            <input type="hidden" name="q" value={state.value} />

            <p className="text-small" style={{ color: "var(--brand-muted)" }}>
              {state.kind === "email" ? "Email" : "Order"}{" "}
              <span
                className={state.kind === "email" ? "font-medium" : "type-code"}
                style={{ color: "var(--brand-text)" }}
              >
                {state.value}
              </span>
            </p>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className="block text-small font-medium">
                {state.kind === "email"
                  ? "Your order number"
                  : "The email address used on the order"}
              </label>
              <input
                id="confirm"
                name="confirm"
                type={state.kind === "email" ? "text" : "email"}
                required
                autoFocus
                autoCapitalize="none"
                autoComplete={state.kind === "email" ? "off" : "email"}
                spellCheck={false}
                placeholder={state.kind === "email" ? "#1042" : "you@example.com"}
                className="w-full px-4 text-body"
                style={{ ...fieldStyle, height: "var(--brand-input-height)" }}
              />
              <p className="text-caption" style={{ color: "var(--brand-muted)" }}>
                We ask for both so nobody else can see your delivery address.
              </p>
            </div>

            <Submit label="Find my order" arrow={branding.showButtonArrow} />

            <a
              href={proxyPath}
              className="block text-center text-caption underline underline-offset-2"
              style={{ color: "var(--brand-muted)" }}
            >
              Start again
            </a>
          </>
        )}
      </form>
    </section>
  );
}

/**
 * A parcel under a magnifier: the page's subject, at the size of a bullet.
 *
 * Inline SVG rather than an icon font or an image, because this markup is
 * served into a merchant's theme where neither is guaranteed to arrive.
 */
function ParcelMark() {
  return (
    <svg
      className="size-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--brand-accent)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 8.5 12 12 4 8.5 12 5z" />
      <path d="M4 8.5v7l8 3.5" />
      <path d="M20 8.5v3" />
      <circle cx="17.5" cy="16.5" r="3" />
      <path d="m20 19 2 2" />
    </svg>
  );
}

function Submit({ label, arrow }: { label: string; arrow?: boolean }) {
  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center gap-2 px-4 text-body font-semibold"
      style={{
        backgroundColor: "var(--brand-accent)",
        color: "var(--brand-on-accent)",
        borderRadius: "var(--brand-button-radius)",
        width: "var(--brand-button-width)",
        height: "var(--brand-input-height)",
      }}
    >
      {label}
      {arrow ? (
        <svg
          className="size-3.5 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M2 8h11" />
          <path d="m9 4 4 4-4 4" />
        </svg>
      ) : null}
    </button>
  );
}
