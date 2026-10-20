import { env } from "@/lib/env";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

type PostalResponse = {
  status?: string;
  data?: {
    message_id?: string;
    messages?: Record<string, { id?: number | string; token?: string }>;
    code?: string;
    message?: string;
  };
};

/**
 * Our self-hosted Postal server, over its HTTP API.
 *
 * It sits last in the chain, so it needs no rate-limit mapping: whatever it
 * refuses is surfaced as-is.
 */
export const postalProvider: EmailProvider = {
  name: "postal",

  configured() {
    return env.postal.configured;
  },

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const res = await fetch(`${env.postal.apiUrl}/api/v1/send/message`, {
      method: "POST",
      headers: {
        "X-Server-API-Key": env.postal.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        to: [input.to],
        from: input.from,
        subject: input.subject,
        html_body: input.html,
        plain_body: input.text,
        reply_to: input.replyTo,
        headers: {
          ...input.headers,
          ...(input.idempotencyKey
            ? { "X-Idempotency-Key": input.idempotencyKey }
            : {}),
        },
      }),
    });

    // Postal answers HTTP 200 for some refusals too, with the outcome in the
    // body's `status`, so the body decides — not only the status code.
    const data = (await res.json().catch(() => null)) as PostalResponse | null;
    if (!res.ok || !data || data.status !== "success") {
      const detail = data?.data?.message ?? data?.data?.code ?? JSON.stringify(data);
      throw new Error(`Postal send failed: ${res.status} ${detail}`);
    }

    const messageId =
      data.data?.message_id ??
      Object.values(data.data?.messages ?? {})[0]?.id ??
      null;
    return {
      provider: "postal",
      providerMessageId: messageId === null ? null : String(messageId),
    };
  },
};
