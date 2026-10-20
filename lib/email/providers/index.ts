import { env } from "@/lib/env";
import { postalProvider } from "./postal";
import { resendProvider } from "./resend";
import {
  RateLimitError,
  type EmailProvider,
  type EmailProviderName,
  type SendEmailInput,
  type SendEmailResult,
} from "./types";

export * from "./types";

/** Default order: Resend first, Postal when Resend is saturated. */
const CHAIN: EmailProvider[] = [resendProvider, postalProvider];

export const EMAIL_PROVIDER_NAMES: EmailProviderName[] = CHAIN.map((p) => p.name);

/** Narrows a stored value to a provider name, falling back to the default. */
export function parseProviderName(value: unknown): EmailProviderName {
  return EMAIL_PROVIDER_NAMES.includes(value as EmailProviderName)
    ? (value as EmailProviderName)
    : CHAIN[0].name;
}

/**
 * The providers that can actually send, in fallback order, with `primary`
 * (a store's choice) moved to the front. An unconfigured primary simply drops
 * out, so mail still goes through the other one.
 */
export function providerChain(primary?: string | null): EmailProvider[] {
  const first = parseProviderName(primary);
  return [
    ...CHAIN.filter((provider) => provider.name === first),
    ...CHAIN.filter((provider) => provider.name !== first),
  ].filter((provider) => provider.configured());
}

/** Whether one provider's credentials are present, for the settings page. */
export function providerConfigured(name: EmailProviderName): boolean {
  return CHAIN.some((provider) => provider.name === name && provider.configured());
}

function configuredChain(): EmailProvider[] {
  return providerChain();
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
 * Sends one email through the first provider that accepts it. `chain`
 * defaults to the platform order; pass `providerChain(store.emailPrimaryProvider)`
 * for a store's own mail.
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
