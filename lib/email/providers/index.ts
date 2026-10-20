import { env } from "@/lib/env";
import { postalProvider } from "./postal";
import { resendProvider } from "./resend";
import {
  RateLimitError,
  type EmailProvider,
  type SendEmailInput,
  type SendEmailResult,
} from "./types";

export * from "./types";

/** Resend first; Postal takes over only when Resend is saturated. */
const CHAIN: EmailProvider[] = [resendProvider, postalProvider];

/** The providers that can actually send, in fallback order. */
function configuredChain(): EmailProvider[] {
  return CHAIN.filter((provider) => provider.configured());
}

/** True when at least one provider can send, so callers can degrade. */
export function emailConfigured(): boolean {
  return configuredChain().length > 0;
}

function shouldFallback(err: unknown): boolean {
  if (env.email.fallbackMode === "any_error") return true;
  return err instanceof RateLimitError;
}

/**
 * Sends one email through the first provider that accepts it.
 *
 * A provider that refuses for a rate limit or quota hands over to the next
 * one; any other refusal is thrown, so the caller records it and QStash
 * retries. `EMAIL_FALLBACK_MODE=any_error` widens the hand-over to every
 * failure.
 */
export async function sendEmail(
  input: SendEmailInput,
  chain: EmailProvider[] = configuredChain(),
): Promise<SendEmailResult> {
  if (chain.length === 0) {
    throw new Error(
      "No email provider is configured (RESEND_API_KEY or POSTAL_API_URL + POSTAL_API_KEY).",
    );
  }

  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const isLast = i === chain.length - 1;
    try {
      return await provider.send(input);
    } catch (err) {
      lastErr = err;
      if (isLast || !shouldFallback(err)) throw err;
      console.warn(
        `[email] ${provider.name} failed, falling back to ${chain[i + 1].name}`,
        { idempotencyKey: input.idempotencyKey },
      );
    }
  }
  throw lastErr;
}
