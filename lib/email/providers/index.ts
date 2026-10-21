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

/** Default order; a store can put Postal first (`stores.email_primary_provider`). */
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

/** How many times a provider is tried before the next one takes over. */
export const ATTEMPTS_BEFORE_FALLBACK = 5;

/** Pause before retry n (1-based): 0.5s, 1s, 2s, 4s. */
const RETRY_BASE_DELAY_MS = 500;

export type SendEmailOptions = {
  /** Tries per provider before handing over; defaults to 5. */
  attempts?: number;
  /** First pause between tries, doubled each time; 0 in tests. */
  retryDelayMs?: number;
};

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/**
 * Sends one email through the first provider that accepts it. `chain`
 * defaults to the platform order; pass `providerChain(store.emailPrimaryProvider)`
 * for a store's own mail.
 *
 * Each provider but the last gets up to `attempts` tries, with a growing
 * pause between them, before the next one takes over. Two refusals skip
 * the retries and hand over at once: a rate limit or quota (retrying only
 * makes it worse), and — with `EMAIL_FALLBACK_MODE=any_error` — any failure
 * at all. The last provider is tried once and its error is thrown, so the
 * caller records the send as failed.
 */
export async function sendEmail(
  input: SendEmailInput,
  chain: EmailProvider[] = configuredChain(),
  options: SendEmailOptions = {},
): Promise<SendEmailResult> {
  if (chain.length === 0) {
    throw new Error(
      "No email provider is configured (RESEND_API_KEY or POSTAL_API_URL + POSTAL_API_KEY).",
    );
  }

  const attempts = Math.max(1, options.attempts ?? ATTEMPTS_BEFORE_FALLBACK);
  const retryDelayMs = options.retryDelayMs ?? RETRY_BASE_DELAY_MS;
  const handOverAtOnce = (err: unknown) =>
    err instanceof RateLimitError || env.email.fallbackMode === "any_error";

  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const isLast = i === chain.length - 1;
    const tries = isLast ? 1 : attempts;

    for (let attempt = 1; attempt <= tries; attempt++) {
      try {
        return await provider.send(input);
      } catch (err) {
        lastErr = err;
        if (isLast) throw err;
        if (handOverAtOnce(err) || attempt === tries) break;
        console.warn(
          `[email] ${provider.name} attempt ${attempt}/${tries} failed, retrying`,
          { idempotencyKey: input.idempotencyKey },
        );
        await sleep(retryDelayMs * 2 ** (attempt - 1));
      }
    }

    console.warn(
      `[email] ${provider.name} failed, falling back to ${chain[i + 1].name}`,
      { idempotencyKey: input.idempotencyKey },
    );
  }
  throw lastErr;
}
