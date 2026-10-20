/**
 * The contract every email provider implements.
 *
 * Nothing outside `lib/email/providers/` talks to a provider's SDK or API:
 * callers go through `sendEmail`, which walks the fallback chain.
 */

export type EmailProviderName = "resend" | "postal";

export type SendEmailInput = {
  /** Full `From` header, e.g. `"Store name" <orders@send.example.com>`. */
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  /**
   * Stable key for one logical email — the `email_sends.id` for customer
   * mail — so a provider that supports it can drop a duplicate request.
   */
  idempotencyKey?: string;
};

export type SendEmailResult = {
  provider: EmailProviderName;
  providerMessageId: string | null;
};

export interface EmailProvider {
  name: EmailProviderName;
  /** Whether this provider's credentials are present at all. */
  configured(): boolean;
  /** Resolves on acceptance; throws on any refusal. */
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

/**
 * A provider refused the send because of a rate limit or a sending quota.
 *
 * The only error that moves a send to the next provider by default: anything
 * else (bad address, bad payload, an outage) is a real failure that the
 * QStash retry and the email log should see.
 */
export class RateLimitError extends Error {
  constructor(
    readonly provider: EmailProviderName,
    message: string,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}
