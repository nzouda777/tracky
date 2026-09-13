/**
 * The customer lookup, asked one field at a time.
 *
 * Two fields side by side read as a form to fill in; one reads as a question
 * to answer, which is the difference between a visitor trying and a visitor
 * closing the tab. So step one takes whichever detail they happen to have —
 * order number or email — and step two asks for the other.
 *
 * **Both are still required.** It is presented as one field at a time, not
 * reduced to one field: an order number on its own would let anyone walk
 * `#1001`, `#1002`, `#1003` and read other people's names, addresses and
 * order contents, and an email on its own would do the same to anyone whose
 * address is known. Step two is therefore always shown, whether or not step
 * one matched anything, so the form never reveals which orders or addresses
 * exist.
 *
 * It is a GET form pointing at the page's own path, so the Shopify App Proxy
 * signs the submitted parameters on the way back in.
 */
export type LookupStep =
  | { step: "identify" }
  | { step: "confirm"; value: string; kind: "email" | "order" };

/** Decides which half of the pair a typed value is. */
export function classifyLookup(value: string): "email" | "order" {
  return value.includes("@") ? "email" : "order";
}

export function LookupForm({
  proxyPath,
  state,
  error,
}: {
  proxyPath: string;
  state: LookupStep;
  error?: string | null;
}) {
  const fieldStyle = {
    border: "1px solid var(--brand-border)",
    backgroundColor: "var(--brand-background)",
    color: "var(--brand-text)",
  };

  return (
    <section
      className="rounded-xl p-5 sm:p-6"
      style={{
        backgroundColor: "var(--brand-surface)",
        border: "1px solid var(--brand-border)",
      }}
    >
      <form action={proxyPath} method="get" className="space-y-4">
        {error ? (
          <p
            role="alert"
            className="rounded-lg px-3 py-2.5 text-sm font-medium"
            style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
          >
            {error}
          </p>
        ) : null}

        {state.step === "identify" ? (
          <>
            <div className="space-y-1.5">
              <label htmlFor="q" className="block text-sm font-medium">
                Order number or email address
              </label>
              <input
                id="q"
                name="q"
                required
                autoFocus
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                placeholder="#1042 or you@example.com"
                className="w-full rounded-lg px-3.5 py-3 text-base"
                style={fieldStyle}
              />
              <p className="text-xs" style={{ color: "var(--brand-muted)" }}>
                Whichever you have to hand. We will ask for the other next.
              </p>
            </div>

            <Submit label="Continue" />
          </>
        ) : (
          <>
            {/* Carries step one forward, so the pair arrives together. */}
            <input type="hidden" name="q" value={state.value} />

            <p className="text-sm" style={{ color: "var(--brand-muted)" }}>
              {state.kind === "email" ? "Email" : "Order"}:{" "}
              <span className="font-medium" style={{ color: "var(--brand-text)" }}>
                {state.value}
              </span>
            </p>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className="block text-sm font-medium">
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
                placeholder={
                  state.kind === "email" ? "#1042" : "you@example.com"
                }
                className="w-full rounded-lg px-3.5 py-3 text-base"
                style={fieldStyle}
              />
              <p className="text-xs" style={{ color: "var(--brand-muted)" }}>
                We ask for both so nobody else can look up your order.
              </p>
            </div>

            <Submit label="Find my order" />

            <a
              href={proxyPath}
              className="block text-center text-xs underline"
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
      className="w-full rounded-lg px-4 py-3 text-base font-semibold"
      style={{
        backgroundColor: "var(--brand-primary)",
        color: "var(--brand-background)",
      }}
    >
      {label}
    </button>
  );
}
