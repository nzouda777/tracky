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
  proxyPath,
  state,
  error,
  mode = "two-factor",
}: {
  proxyPath: string;
  state: LookupStep;
  error?: string | null;
  mode?: LookupMode;
}) {
  const fieldStyle = {
    border: "1px solid var(--brand-line)",
    backgroundColor: "var(--brand-surface)",
    color: "var(--brand-text)",
  };

  const identifying = state.step === "identify";
  const orderOnly = mode === "order-only" && identifying;
  const emailOnly = mode === "email-only" && identifying;

  return (
    <section
      className="rounded-panel p-5 sm:p-6"
      style={{
        backgroundColor: "var(--brand-panel)",
        border: "1px solid var(--brand-line)",
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
            <div className="space-y-1.5">
              <label htmlFor="q" className="block text-small font-medium">
                {emailOnly
                  ? "Email address"
                  : orderOnly
                    ? "Order number"
                    : "Order number or email address"}
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
                  emailOnly
                    ? "you@example.com"
                    : orderOnly
                      ? "#1042"
                      : "#1042 or you@example.com"
                }
                className="w-full rounded-control px-3.5 py-3 text-body"
                style={fieldStyle}
              />
              <p className="text-caption" style={{ color: "var(--brand-muted)" }}>
                {emailOnly
                  ? "The address you used at checkout. We will show your most recent order."
                  : orderOnly
                    ? "It is at the top of your order confirmation email."
                    : "Whichever you have to hand. We will ask for the other next."}
              </p>
            </div>

            <Submit
              label={emailOnly || orderOnly ? "Track my order" : "Continue"}
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
                className="w-full rounded-control px-3.5 py-3 text-body"
                style={fieldStyle}
              />
              <p className="text-caption" style={{ color: "var(--brand-muted)" }}>
                We ask for both so nobody else can see your delivery address.
              </p>
            </div>

            <Submit label="Find my order" />

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

function Submit({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="w-full rounded-control px-4 py-3 text-body font-semibold"
      style={{
        backgroundColor: "var(--brand-accent)",
        color: "var(--brand-on-accent)",
      }}
    >
      {label}
    </button>
  );
}
