import {
  BlockStack,
  Button,
  Heading,
  Text,
  View,
  reactExtension,
  useEmail,
  useSettings,
  useShop,
} from "@shopify/ui-extensions-react/checkout";

/**
 * "Track my order", on Shopify's thank-you page.
 *
 * Until an order is fulfilled Shopify has no tracking to offer: its own
 * "Track shipment" button appears only once a fulfillment carries a tracking
 * URL, and this app deliberately does not fulfil until a delivery has been
 * confirmed on the ground. That leaves the customer on the thank-you page with
 * nowhere to go at the exact moment they most want to know where their order
 * is — so this block puts the link there itself.
 *
 * It points at the App Proxy path on the merchant's own domain, so the
 * customer never leaves the store: they land on the tracking page rendered
 * inside the theme, with the shop's header and footer around it.
 */

/**
 * Must match `APP_PROXY_PREFIX` / `APP_PROXY_SUBPATH` in `lib/tracking/links`.
 *
 * Written out rather than imported: this file is bundled by the Shopify CLI
 * for a different runtime, with its own module resolution, and reaching back
 * into the Next app would drag its imports along. `tests/thank-you-extension.test.ts`
 * fails if the two ever disagree.
 */
const TRACKING_PATH = "/apps/track-order";

function TrackOrderBlock() {
  const shop = useShop();
  const email = useEmail();

  // Editable in the checkout editor, so the wording can match the store's
  // voice without anyone redeploying an extension.
  const { heading, body, action } = useSettings() as {
    heading?: string;
    body?: string;
    action?: string;
  };

  // `storefrontUrl` is the customer-facing domain, and the one the App Proxy
  // answers on. The myshopify host is the fallback: it always exists and
  // redirects to the primary domain.
  const origin = (
    shop.storefrontUrl ?? `https://${shop.myshopifyDomain}`
  ).replace(/\/+$/, "");

  // The tracking page asks for the email used at checkout, and we already know
  // it here — so it arrives filled in and the customer presses one button.
  const href = email
    ? `${origin}${TRACKING_PATH}?q=${encodeURIComponent(email)}`
    : `${origin}${TRACKING_PATH}`;

  return (
    <View border="base" cornerRadius="base" padding="base">
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Heading level={2}>{heading || "Follow your delivery"}</Heading>
          <Text appearance="subdued" size="small">
            {body ||
              "Every step is recorded as it happens, from packing to the moment it reaches your door."}
          </Text>
        </BlockStack>

        <Button kind="secondary" to={href}>
          {action || "Track my order"}
        </Button>
      </BlockStack>
    </View>
  );
}

export default reactExtension("purchase.thank-you.block.render", () => (
  <TrackOrderBlock />
));
