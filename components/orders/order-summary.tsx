import type { Order } from "@/lib/db";
import { formatAddressLines, formatDate, formatMoney } from "@/lib/utils";

/** Customer, address and items — the facts mirrored from Shopify. */
export function OrderSummary({ order }: { order: Order }) {
  const addressLines = formatAddressLines(order.shippingAddress);

  return (
    <div className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail label="Customer" value={order.customerName ?? "—"} />
        <Detail label="Email" value={order.customerEmail ?? "—"} />
        <Detail label="Phone" value={order.customerPhone ?? "—"} />
        <Detail label="Order date" value={formatDate(order.orderDate)} />
        <Detail
          label="Order total"
          value={formatMoney(order.total, order.currency)}
        />
        <Detail
          label="Assigned driver"
          value={order.assignedDriverName ?? "Not assigned"}
        />
      </dl>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-ink-500">
          Shipping address
        </p>
        {addressLines.length > 0 ? (
          <address className="text-sm not-italic leading-relaxed text-ink-800">
            {addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        ) : (
          <p className="text-sm text-ink-500">No shipping address on file.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-500">
          Items
        </p>
        {order.lineItems.length === 0 ? (
          <p className="text-sm text-ink-500">No line items recorded.</p>
        ) : (
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {order.lineItems.map((item, index) => (
              <li
                key={`${item.id ?? item.title}-${index}`}
                className="flex items-start justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-900">{item.title}</p>
                  {item.variantTitle ? (
                    <p className="truncate text-xs text-ink-500">
                      {item.variantTitle}
                    </p>
                  ) : null}
                  {item.sku ? (
                    <p className="truncate text-xs text-ink-400">
                      SKU {item.sku}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-ink-700">× {item.quantity}</p>
                  {item.price ? (
                    <p className="text-xs text-ink-500">
                      {formatMoney(item.price, order.currency)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-semibold text-ink-500">
        {label}
      </dt>
      <dd className="break-words text-sm text-ink-900">{value}</dd>
    </div>
  );
}
