/**
 * Centralised environment access.
 *
 * Values are read lazily so that importing a module during `next build` (or in
 * a unit test) never crashes because an unrelated secret is missing. Call the
 * accessor at the point of use instead of destructuring at module scope.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Reads a variable that the surrounding feature cannot work without. */
export function required(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. See .env.example for the expected value.`,
    );
  }
  return value;
}

/** Reads an optional variable, falling back to `fallback`. */
export function optional(name: string, fallback: string): string {
  return read(name) ?? fallback;
}

/** True when a feature's credentials are present, so callers can degrade. */
export function isConfigured(...names: string[]): boolean {
  return names.every((name) => read(name) !== undefined);
}

export const env = {
  get appUrl(): string {
    const raw =
      read("APP_URL") ??
      (read("VERCEL_PROJECT_PRODUCTION_URL")
        ? `https://${read("VERCEL_PROJECT_PRODUCTION_URL")}`
        : undefined) ??
      "http://localhost:3000";
    return raw.replace(/\/+$/, "");
  },
  get platformName(): string {
    return optional("PLATFORM_NAME", "Tracky");
  },
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get encryptionKey(): string {
    return required("ENCRYPTION_KEY");
  },
  shopify: {
    /**
     * The single set of app credentials the platform used to run on.
     *
     * Credentials now live on each store row (`stores.api_key` /
     * `stores.api_secret`), so several Shopify apps can be spread across
     * stores. These two are only a fallback, for stores connected before that
     * change and for a deployment that still runs one app for everything —
     * which is why they are optional rather than `required()`. Resolve them
     * through `lib/shopify/credentials.ts`, never directly.
     */
    get fallbackApiKey(): string | null {
      return read("SHOPIFY_API_KEY") ?? null;
    },
    get fallbackApiSecret(): string | null {
      return read("SHOPIFY_API_SECRET") ?? null;
    },
    get fallbackConfigured(): boolean {
      return isConfigured("SHOPIFY_API_KEY", "SHOPIFY_API_SECRET");
    },
    get scopes(): string {
      return optional(
        "SHOPIFY_SCOPES",
        "read_orders,write_orders,read_fulfillments,write_fulfillments",
      );
    },
    get apiVersion(): string {
      return optional("SHOPIFY_API_VERSION", "2025-07");
    },
  },
  resend: {
    get apiKey(): string {
      return required("RESEND_API_KEY");
    },
    get fromEmail(): string {
      return required("RESEND_FROM_EMAIL");
    },
    get fromName(): string {
      return optional("RESEND_FROM_NAME", "Tracky");
    },
    /**
     * Where a customer's reply actually lands.
     *
     * Every email tells the customer to reply to it, so the address they
     * answer has to be a mailbox someone reads. The sending address usually
     * is not: a transactional domain is typically a subdomain with no MX
     * records at all, which is exactly what keeps its reputation separate —
     * and exactly why a reply to it would bounce.
     *
     * Unset means replies go to the From address, which is only correct when
     * that address is itself a real inbox.
     */
    get replyTo(): string | null {
      return read("RESEND_REPLY_TO") ?? null;
    },
    get configured(): boolean {
      return isConfigured("RESEND_API_KEY", "RESEND_FROM_EMAIL");
    },
  },
  qstash: {
    get token(): string {
      return required("QSTASH_TOKEN");
    },
    get configured(): boolean {
      return isConfigured("QSTASH_TOKEN");
    },
  },
  get cronSecret(): string {
    return required("CRON_SECRET");
  },
} as const;
