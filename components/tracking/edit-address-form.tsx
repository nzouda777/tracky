import type { Order } from "@/lib/db";

/**
 * Address editing, available until the order reaches a stage that locks it.
 *
 * It posts back through the App Proxy sub-path (`…/track-order/address`) so
 * Shopify signs the request; the handler verifies that signature, writes the
 * new address to Shopify via the Admin API, and redirects back here.
 *
 * Deliberately a plain form: the page is served inside the merchant's theme and
 * must work without any client-side JavaScript.
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
    border: "1px solid var(--brand-border)",
    backgroundColor: "var(--brand-background)",
    color: "var(--brand-text)",
  };

  return (
    <section
      className="rounded-xl p-5"
      style={{ border: "1px solid var(--brand-border)" }}
    >
      <h3 className="text-sm font-semibold">Delivery address</h3>

      {message ? (
        <p
          role="status"
          className="mt-3 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ backgroundColor: "#dcfce7", color: "#166534" }}
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
        >
          {error}
        </p>
      ) : null}

      <details className="mt-3" open={Boolean(error)}>
        <summary className="cursor-pointer text-sm font-medium">
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
            <Field label="Full name" name="name" defaultValue={address.name} style={fieldStyle} required />
            <Field label="Phone" name="phone" defaultValue={address.phone} style={fieldStyle} />
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
            <Field label="Suburb / City" name="city" defaultValue={address.city} style={fieldStyle} required />
            <Field label="State" name="province" defaultValue={address.province} style={fieldStyle} />
          </Row>

          <Row>
            <Field label="Postcode" name="zip" defaultValue={address.zip} style={fieldStyle} required />
            <Field label="Country" name="country" defaultValue={address.country} style={fieldStyle} required />
          </Row>

          <button
            type="submit"
            className="w-full rounded-lg px-4 py-3 text-base font-semibold"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-background)",
            }}
          >
            Save new address
          </button>

          <p className="text-xs" style={{ color: "var(--brand-muted)" }}>
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
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="w-full rounded-lg px-3 py-2.5 text-base"
        style={style}
      />
    </div>
  );
}
