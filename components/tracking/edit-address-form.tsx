import type { Order } from "@/lib/db";

/**
 * Address editing, available until the order reaches a stage that locks it.
 *
 * It posts back through the App Proxy sub-path (`…/track-order/address`) so
 * Shopify signs the request; the handler verifies that signature, writes the
 * new address to Shopify via the Admin API, and redirects back here.
 *
 * Deliberately a plain form: the page is served inside the merchant's theme and
 * must work without any client-side JavaScript. It stays collapsed by default
 * so the manifest above it is what the page leads with — the address is a fact
 * to check far more often than a thing to change.
 */
export function EditAddressForm({
  proxyPath,
  order,
  message,
  error,
}: {
  proxyPath: string;
  order: Order;
  message?: string | null;
  error?: string | null;
}) {
  const address = order.shippingAddress ?? {};
  const fieldStyle = {
    border: "1px solid var(--brand-line)",
    backgroundColor: "var(--brand-surface)",
    color: "var(--brand-text)",
  };

  return (
    <section>
      {/* Confirmation is stated, not coloured in: the delivered green is
          reserved for the terminal waypoint and must not start meaning
          "saved" as well. */}
      {message ? (
        <p
          role="status"
          className="mb-3 rounded-control px-3 py-2.5 text-small font-medium"
          style={{
            border: "1px solid var(--brand-line)",
            backgroundColor: "var(--brand-panel)",
          }}
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-control px-3 py-2.5 text-small font-medium"
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

      <details open={Boolean(error)}>
        <summary
          className="cursor-pointer text-small font-medium underline underline-offset-2"
          style={{ color: "var(--brand-link)" }}
        >
          Edit address
        </summary>

        <form
          action={`${proxyPath}/address`}
          method="post"
          className="mt-4 space-y-3"
        >
          {/* The token identifies the order; the signature Shopify adds proves
              the request came through the storefront. */}
          <input type="hidden" name="token" value={order.trackingToken} />

          <Row>
            <Field
              label="Full name"
              name="name"
              defaultValue={address.name}
              style={fieldStyle}
              required
            />
            <Field
              label="Phone"
              name="phone"
              defaultValue={address.phone}
              style={fieldStyle}
            />
          </Row>

          <Field
            label="Address line 1"
            name="address1"
            defaultValue={address.address1}
            style={fieldStyle}
            required
          />
          <Field
            label="Address line 2"
            name="address2"
            defaultValue={address.address2}
            style={fieldStyle}
          />

          <Row>
            <Field
              label="Suburb / City"
              name="city"
              defaultValue={address.city}
              style={fieldStyle}
              required
            />
            <Field
              label="State"
              name="province"
              defaultValue={address.province}
              style={fieldStyle}
            />
          </Row>

          <Row>
            <Field
              label="Postcode"
              name="zip"
              defaultValue={address.zip}
              style={fieldStyle}
              required
            />
            <Field
              label="Country"
              name="country"
              defaultValue={address.country}
              style={fieldStyle}
              required
            />
          </Row>

          <button
            type="submit"
            className="w-full rounded-control px-4 py-3 text-body font-semibold"
            style={{
              backgroundColor: "var(--brand-accent)",
              color: "var(--brand-on-accent)",
            }}
          >
            Save new address
          </button>

          <p className="text-caption" style={{ color: "var(--brand-muted)" }}>
            You can change your address until your order leaves for delivery.
          </p>
        </form>
      </details>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  name,
  defaultValue,
  style,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  style: React.CSSProperties;
  required?: boolean;
}) {
  const id = `address-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-small font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="w-full rounded-control px-3 py-2.5 text-body"
        style={style}
      />
    </div>
  );
}
