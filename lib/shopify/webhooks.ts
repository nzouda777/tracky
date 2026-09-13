import { env } from "@/lib/env";
import { ShopifyAdminClient } from "./admin-api";

/**
 * Webhook topics the app relies on. Every order transition that is *not* a
 * human action in this app originates from one of these.
 */
export const WEBHOOK_TOPICS = [
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "ORDERS_CANCELLED",
  "FULFILLMENTS_CREATE",
  "APP_UNINSTALLED",
] as const;

export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number];

/** Maps the header value Shopify sends (`orders/create`) to our enum. */
export function topicFromHeader(header: string): WebhookTopic | null {
  const normalized = header.trim().toUpperCase().replace(/[\/-]/g, "_");
  return (WEBHOOK_TOPICS as readonly string[]).includes(normalized)
    ? (normalized as WebhookTopic)
    : null;
}

const SUBSCRIPTION_MUTATION = `
  mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
    ) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

const LIST_QUERY = `
  query Webhooks {
    webhookSubscriptions(first: 100) {
      nodes {
        id
        topic
        endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } }
      }
    }
  }
`;

export type WebhookRegistrationResult = {
  topic: WebhookTopic;
  status: "created" | "already-registered" | "failed";
  message?: string;
};

/**
 * Registers every topic the app needs, right after installation.
 *
 * Idempotent: existing subscriptions pointing at our callback URL are left
 * alone, so reinstalling or redeploying never produces duplicate deliveries.
 */
export async function registerWebhooks(
  client: ShopifyAdminClient,
): Promise<WebhookRegistrationResult[]> {
  const callbackUrl = `${env.appUrl}/api/shopify/webhooks`;

  const existing = await client.graphql<{
    webhookSubscriptions: {
      nodes: Array<{
        id: string;
        topic: string;
        endpoint: { __typename: string; callbackUrl?: string };
      }>;
    };
  }>(LIST_QUERY);

  const alreadyRegistered = new Set(
    existing.webhookSubscriptions.nodes
      .filter((node) => node.endpoint?.callbackUrl === callbackUrl)
      .map((node) => node.topic),
  );

  const results: WebhookRegistrationResult[] = [];

  for (const topic of WEBHOOK_TOPICS) {
    if (alreadyRegistered.has(topic)) {
      results.push({ topic, status: "already-registered" });
      continue;
    }

    try {
      const data = await client.graphql<{
        webhookSubscriptionCreate: {
          webhookSubscription: { id: string } | null;
          userErrors: Array<{ field: string[] | null; message: string }>;
        };
      }>(SUBSCRIPTION_MUTATION, { topic, callbackUrl });

      const errors = data.webhookSubscriptionCreate.userErrors;
      if (errors.length > 0) {
        results.push({
          topic,
          status: "failed",
          message: errors.map((error) => error.message).join("; "),
        });
      } else {
        results.push({ topic, status: "created" });
      }
    } catch (error) {
      results.push({
        topic,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
