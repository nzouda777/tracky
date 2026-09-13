import { asc, eq } from "drizzle-orm";

import { orders, stages, type ShippingAddress, type Store } from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { isAddressEditable } from "@/lib/orders/stages";
import { ShopifyAdminClient, toGid } from "@/lib/shopify/admin-api";
import { getBranding } from "./lookup";

/**
 * Customer-initiated address change.
 *
 * Shared by both tracking surfaces — the App Proxy page and the hosted page —
 * so the rules cannot drift between them. The caller is responsible for
 * authenticating the *request* (App Proxy signature, where there is one); this
 * function authorises the *order* and performs the change:
 *
 *   1. the order must resolve from its own opaque tracking token;
 *   2. the order must not be cancelled;
 *   3. the order must not have reached a stage that locks address editing;
 *   4. Shopify must accept the new address before it is mirrored locally.
 *
 * It deliberately writes no `order_stage_history` row: editing an address is
 * not delivery progress, and the customer timeline shows delivery events only.
 */
export type AddressChangeResult =
  | { status: "updated"; trackingToken: string }
  | { status: "locked"; trackingToken: string }
  | { status: "failed"; trackingToken: string }
  | { status: "not-found" };

const ORDER_UPDATE = `
  mutation UpdateShippingAddress($input: OrderInput!) {
    orderUpdate(input: $input) {
      order { id }
      userErrors { field message }
    }
  }
`;

export async function applyCustomerAddressChange({
  store,
  token,
  form,
}: {
  store: Store;
  token: string;
  form: FormData;
}): Promise<AddressChangeResult> {
  if (!token) return { status: "not-found" };

  const tdb = new TenantDb(store.id);

  const order = await tdb.findFirst(orders, {
    where: eq(orders.trackingToken, token),
  });
  if (!order) return { status: "not-found" };

  const [allStages, branding] = await Promise.all([
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
    getBranding(tdb),
  ]);

  const editable = isAddressEditable({
    allStages,
    currentStageId: order.currentStageId,
    allowedByBranding: branding?.showAddressEditing ?? true,
  });

  if (!editable || order.cancelledAt) {
    return { status: "locked", trackingToken: order.trackingToken };
  }

  const address: ShippingAddress = {
    name: text(form.get("name")),
    company: order.shippingAddress?.company ?? null,
    address1: text(form.get("address1")),
    address2: text(form.get("address2")),
    city: text(form.get("city")),
    province: text(form.get("province")),
    provinceCode: order.shippingAddress?.provinceCode ?? null,
    country: text(form.get("country")),
    countryCode: order.shippingAddress?.countryCode ?? null,
    zip: text(form.get("zip")),
    phone: text(form.get("phone")),
  };

  if (!address.address1 || !address.city || !address.zip || !address.country) {
    return { status: "failed", trackingToken: order.trackingToken };
  }

  try {
    const client = ShopifyAdminClient.forStore(store);
    const result = await client.graphql<{
      orderUpdate: {
        order: { id: string } | null;
        userErrors: Array<{ field: string[] | null; message: string }>;
      };
    }>(ORDER_UPDATE, {
      input: {
        id: toGid("Order", order.shopifyOrderId),
        shippingAddress: {
          firstName: firstNameOf(address.name),
          lastName: lastNameOf(address.name),
          address1: address.address1,
          address2: address.address2,
          city: address.city,
          province: address.province,
          country: address.country,
          zip: address.zip,
          phone: address.phone,
        },
      },
    });

    if (result.orderUpdate.userErrors.length > 0) {
      console.error(
        "[tracking] address update rejected by Shopify:",
        result.orderUpdate.userErrors,
      );
      return { status: "failed", trackingToken: order.trackingToken };
    }
  } catch (error) {
    console.error("[tracking] address update failed", error);
    return { status: "failed", trackingToken: order.trackingToken };
  }

  // Shopify accepted it, so mirror it for the tracking page and the agency's
  // delivery list.
  await tdb.updateById(orders, order.id, {
    shippingAddress: address,
    updatedAt: new Date(),
  });

  return { status: "updated", trackingToken: order.trackingToken };
}

function text(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstNameOf(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.split(/\s+/)[0] ?? null;
}

function lastNameOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : null;
}
