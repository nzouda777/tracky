import { env } from "@/lib/env";
import {
  RateLimitError,
  type EmailProvider,
  type SendEmailInput,
  type SendEmailResult,
} from "./types";

/** Resend error codes that mean "too much, too fast" rather than "wrong". */
const RATE_LIMIT_CODES = new Set([
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

export const resendProvider: EmailProvider = {
  name: "resend",

  configured() {
    return env.resend.configured;
  },

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const { Resend } = await import("resend");
    const resend = new Resend(env.resend.apiKey);

    const base = {
      from: input.from,
      to: [input.to],
      subject: input.subject,
      ...(input.replyTo ? { replyTo: [input.replyTo] } : {}),
      ...(input.headers ? { headers: input.headers } : {}),
    };
    // Resend wants at least one body; every caller passes one or both.
    const payload =
      input.html !== undefined
        ? { ...base, html: input.html, ...(input.text ? { text: input.text } : {}) }
        : { ...base, text: input.text ?? "" };

    const response = await resend.emails.send(
      payload,
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );

    if (response.error) {
      const { name, message, statusCode } = response.error;
      if (statusCode === 429 || RATE_LIMIT_CODES.has(name)) {
        throw new RateLimitError("resend", `Resend: ${message}`);
      }
      throw new Error(message);
    }

    return { provider: "resend", providerMessageId: response.data?.id ?? null };
  },
};
