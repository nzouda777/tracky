import { createVerify, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db, emailSends } from "@/lib/db";

/**
 * Postal's delivery webhooks: what happened to an email after Postal
 * accepted it. `status = sent` on a row only means Postal took the email;
 * these reports say whether the recipient's server did.
 */

export type DeliveryStatus = "delivered" | "delayed" | "held" | "failed" | "bounced";

export type PostalEvent = {
  /** The values a send's `provider_message_id` may hold for this message. */
  messageIds: string[];
  status: DeliveryStatus;
  /** The remote server's answer, for the email log. */
  detail: string;
  /** Postal has given up on it: Resend should send it instead. */
  reroute: boolean;
};

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  MessageSent: "delivered",
  MessageDelayed: "delayed",
  MessageHeld: "held",
  MessageDeliveryFailed: "failed",
  MessageBounced: "bounced",
};

type PostalMessage = { id?: number | string; message_id?: string };

type PostalWebhookBody = {
  event?: string;
  payload?: {
    message?: PostalMessage;
    original_message?: PostalMessage;
    status?: string;
    details?: string;
    output?: string;
    bounce?: { subject?: string };
  };
};

/**
 * Reads one webhook body. Null for an event this app does not track (clicks,
 * opens, DNS errors…) or a body without a message to match.
 */
export function parsePostalEvent(body: unknown): PostalEvent | null {
  const { event, payload } = (body ?? {}) as PostalWebhookBody;
  const status = event ? EVENT_STATUS[event] : undefined;
  if (!status || !payload) return null;

  // A bounce arrives as a new inbound message; the one it bounces is the original.
  const message = status === "bounced" ? payload.original_message : payload.message;
  if (!message) return null;

  const ids = new Set<string>();
  if (message.message_id) {
    const bare = message.message_id.trim().replace(/^<|>$/g, "");
    ids.add(bare);
    ids.add(`<${bare}>`);
  }
  if (message.id !== undefined && message.id !== null) ids.add(String(message.id));
  if (ids.size === 0) return null;

  const detail =
    status === "bounced"
      ? `Bounced${payload.bounce?.subject ? `: ${payload.bounce.subject}` : ""}`
      : [payload.status, payload.details, payload.output]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(" — ");

  return {
    messageIds: [...ids],
    status,
    detail: (detail || status).slice(0, 1000),
    reroute: status === "failed" || status === "held",
  };
}

/** Constant-time check of the `?token=` secret. */
export function tokenMatches(given: string | null, secret: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Postal shows its key as bare base64 (sometimes DNS-style `p=…;`): make it PEM. */
export function toPem(key: string): string {
  if (key.includes("BEGIN")) return key.replace(/\\n/g, "\n");
  const body = key.replace(/^.*p=/, "").replace(/[;"\s]/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

/**
 * Checks Postal's RSA signature over the raw body: `X-Postal-Signature-256`
 * (SHA-256, newer Postal) when present, else `X-Postal-Signature` (SHA-1).
 */
export function verifyPostalSignature({
  rawBody,
  signature256,
  signature,
  publicKey,
}: {
  rawBody: string;
  signature256: string | null;
  signature: string | null;
  publicKey: string;
}): boolean {
  const [algorithm, value] = signature256
    ? ["RSA-SHA256", signature256]
    : signature
      ? ["RSA-SHA1", signature]
      : [null, null];
  if (!algorithm || !value) return false;
  try {
    return createVerify(algorithm).update(rawBody).verify(toPem(publicKey), value, "base64");
  } catch {
    return false;
  }
}

/** Reports a later event may overwrite: never undo a final outcome. */
const OVERWRITABLE: Record<DeliveryStatus, Array<DeliveryStatus>> = {
  delayed: ["delayed"],
  delivered: ["delayed", "held"],
  // Claiming the row for a reroute: a redelivered webhook finds it taken.
  failed: ["delayed"],
  held: ["delayed"],
  // A bounce can follow an accepted delivery.
  bounced: ["delayed", "delivered", "held", "failed"],
};

/**
 * Records one report on the matching Postal send and returns the sends that
 * Resend should now take over. The update is conditional, so it is safe to
 * receive the same webhook twice and out of order.
 */
export async function applyPostalEvent(event: PostalEvent): Promise<{
  matched: number;
  reroute: string[];
}> {
  const current = emailSends.deliveryStatus;
  const allowed: SQL = or(
    isNull(current),
    inArray(current, OVERWRITABLE[event.status]),
  ) as SQL;

  const updated = await db
    .update(emailSends)
    .set({
      deliveryStatus: event.status,
      deliveryDetail: event.detail,
      deliveryUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(emailSends.provider, "postal"),
        eq(emailSends.status, "sent"),
        inArray(emailSends.providerMessageId, event.messageIds),
        allowed,
      ),
    )
    .returning({ id: emailSends.id });

  return {
    matched: updated.length,
    reroute: event.reroute ? updated.map((row) => row.id) : [],
  };
}
