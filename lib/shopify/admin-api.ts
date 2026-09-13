import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { Store } from "@/lib/db";

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

/** Authenticated Admin API client for one store. */
export class ShopifyAdminClient {
  private constructor(
    private readonly shopDomain: string,
    private readonly accessToken: string,
  ) {}

  /** Builds a client from a store row, decrypting the stored token. */
  static forStore(store: Pick<Store, "shopDomain" | "accessToken" | "status">) {
    if (store.status !== "active" || !store.accessToken) {
      throw new ShopifyApiError(
        `Store ${store.shopDomain} has no usable Shopify access token.`,
      );
    }
    return new ShopifyAdminClient(
      store.shopDomain,
      decryptSecret(store.accessToken),
    );
  }

  static withToken(shopDomain: string, accessToken: string) {
    return new ShopifyAdminClient(shopDomain, accessToken);
  }

  private get baseUrl(): string {
    return `https://${this.shopDomain}/admin/api/${env.shopify.apiVersion}`;
  }

  private get headers(): HeadersInit {
    return {
      "X-Shopify-Access-Token": this.accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /** REST call. Used for webhook registration and shop metadata. */
  async rest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    return (await this.restWithPaging<T>(method, path, body)).data;
  }

  /**
   * REST call that also surfaces Shopify's cursor pagination.
   *
   * Shopify paginates REST collections through a `Link` header rather than the
   * body, so a caller that only reads the JSON silently stops after the first
   * page. `nextPageInfo` is the opaque cursor to pass back as `page_info`.
   */
  async restWithPaging<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<{ data: T; nextPageInfo: string | null }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();
    const parsed = text ? safeJson(text) : null;

    if (!response.ok) {
      throw new ShopifyApiError(
        `Shopify REST ${method} ${path} failed with ${response.status}.`,
        response.status,
        parsed ?? text,
      );
    }

    return {
      data: parsed as T,
      nextPageInfo: parseNextPageInfo(response.headers.get("link")),
    };
  }

  /**
   * GraphQL Admin API call. Throws on transport errors, GraphQL `errors`, and
   * leaves document-level `userErrors` to the caller, which knows their shape.
   */
  async graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/graphql.json`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

    const text = await response.text();
    const parsed = text ? safeJson(text) : null;

    if (!response.ok) {
      throw new ShopifyApiError(
        `Shopify GraphQL request failed with ${response.status}.`,
        response.status,
        parsed ?? text,
      );
    }

    const payload = parsed as {
      data?: T;
      errors?: Array<{ message: string }>;
    } | null;

    if (payload?.errors?.length) {
      throw new ShopifyApiError(
        payload.errors.map((error) => error.message).join("; "),
        response.status,
        payload.errors,
      );
    }
    if (!payload?.data) {
      throw new ShopifyApiError("Shopify GraphQL response contained no data.");
    }
    return payload.data;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Extracts the `page_info` cursor of the `rel="next"` link.
 *
 * Shopify sends, for example:
 *   <https://shop.myshopify.com/admin/api/2025-07/orders.json?page_info=abc>; rel="next"
 * and omits the `next` link entirely on the final page.
 */
export function parseNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(",")) {
    if (!/rel="?next"?/.test(part)) continue;
    const url = part.match(/<([^>]+)>/)?.[1];
    if (!url) continue;
    try {
      return new URL(url).searchParams.get("page_info");
    } catch {
      return null;
    }
  }
  return null;
}

/** `gid://shopify/Order/123` from a numeric or already-qualified id. */
export function toGid(resource: string, id: string | number): string {
  const value = String(id);
  return value.startsWith("gid://") ? value : `gid://shopify/${resource}/${value}`;
}

/** Numeric id from a Shopify global id. */
export function fromGid(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? gid;
}
