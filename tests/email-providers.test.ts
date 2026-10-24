import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RateLimitError,
  providerChain,
  sendEmail,
  type EmailProvider,
  type SendEmailInput,
} from "@/lib/email/providers";
import { postalProvider } from "@/lib/email/providers/postal";
import { summariseVolume } from "@/lib/email/log";

/**
 * The provider chain: the primary is tried up to five times, then the other
 * provider takes over.
 *
 * The chain is passed in explicitly so these never touch a real provider;
 * Postal's own response handling is pinned against a stubbed `fetch`.
 */

const INPUT: SendEmailInput = {
  from: "Store <orders@send.example.com>",
  to: "customer@example.com",
  subject: "Your order is on its way",
  html: "<p>Hello</p>",
  text: "Hello",
  idempotencyKey: "0b1f6a4e-7f6e-4d0c-9a51-5c2a8f0b9e11",
};

function fakeProvider(
  name: EmailProvider["name"],
  send: EmailProvider["send"],
): EmailProvider & { send: ReturnType<typeof vi.fn> } {
  return { name, configured: () => true, send: vi.fn(send) };
}

beforeEach(() => {
  delete process.env.EMAIL_FALLBACK_MODE;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sendEmail", () => {
  it("returns Resend's result when Resend accepts, without calling Postal", async () => {
    const resend = fakeProvider("resend", async () => ({
      provider: "resend",
      providerMessageId: "re_123",
    }));
    const postal = fakeProvider("postal", async () => ({
      provider: "postal",
      providerMessageId: "1",
    }));

    const result = await sendEmail(INPUT, [resend, postal]);

    expect(result).toEqual({ provider: "resend", providerMessageId: "re_123" });
    expect(postal.send).not.toHaveBeenCalled();
  });

  it("falls back to Postal when Resend is rate limited", async () => {
    process.env.EMAIL_FALLBACK_MODE = "rate_limit";
    const resend = fakeProvider("resend", async () => {
      throw new RateLimitError("resend", "Too many requests");
    });
    const postal = fakeProvider("postal", async () => ({
      provider: "postal",
      providerMessageId: "42",
    }));

    const result = await sendEmail(INPUT, [resend, postal]);

    expect(result).toEqual({ provider: "postal", providerMessageId: "42" });
    expect(postal.send).toHaveBeenCalledWith(INPUT);
  });

  it("retries the primary five times before falling back on another error", async () => {
    const postal = fakeProvider("postal", async () => {
      throw new Error("Postal send failed: 500 Internal error");
    });
    const resend = fakeProvider("resend", async () => ({
      provider: "resend",
      providerMessageId: "re_9",
    }));

    const result = await sendEmail(INPUT, [postal, resend], { retryDelayMs: 0 });

    expect(postal.send).toHaveBeenCalledTimes(5);
    expect(resend.send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ provider: "resend", providerMessageId: "re_9" });
  });

  it("stops retrying once the primary accepts", async () => {
    let calls = 0;
    const postal = fakeProvider("postal", async () => {
      calls += 1;
      if (calls < 3) throw new Error("Postal send failed: 502 Bad gateway");
      return { provider: "postal", providerMessageId: "77" };
    });
    const resend = fakeProvider("resend", async () => ({
      provider: "resend",
      providerMessageId: "re_1",
    }));

    const result = await sendEmail(INPUT, [postal, resend], { retryDelayMs: 0 });

    expect(postal.send).toHaveBeenCalledTimes(3);
    expect(resend.send).not.toHaveBeenCalled();
    expect(result.provider).toBe("postal");
  });

  it("hands over at once on a rate limit, without retrying", async () => {
    const postal = fakeProvider("postal", async () => {
      throw new RateLimitError("postal", "slow down");
    });
    const resend = fakeProvider("resend", async () => ({
      provider: "resend",
      providerMessageId: "re_2",
    }));

    await sendEmail(INPUT, [postal, resend], { retryDelayMs: 0 });

    expect(postal.send).toHaveBeenCalledTimes(1);
    expect(resend.send).toHaveBeenCalledTimes(1);
  });

  it("throws the fallback's error when both providers fail", async () => {
    const postal = fakeProvider("postal", async () => {
      throw new Error("Postal down");
    });
    const resend = fakeProvider("resend", async () => {
      throw new Error("Invalid `to` field.");
    });

    await expect(
      sendEmail(INPUT, [postal, resend], { retryDelayMs: 0 }),
    ).rejects.toThrow("Invalid `to` field.");
    expect(postal.send).toHaveBeenCalledTimes(5);
    expect(resend.send).toHaveBeenCalledTimes(1);
  });

  it("falls back on any error in any_error mode", async () => {
    process.env.EMAIL_FALLBACK_MODE = "any_error";
    const resend = fakeProvider("resend", async () => {
      throw new Error("Internal server error");
    });
    const postal = fakeProvider("postal", async () => ({
      provider: "postal",
      providerMessageId: "7",
    }));

    await expect(sendEmail(INPUT, [resend, postal])).resolves.toMatchObject({
      provider: "postal",
    });
  });

  it("surfaces the last provider's error even when it is a rate limit", async () => {
    const postal = fakeProvider("postal", async () => {
      throw new RateLimitError("postal", "slow down");
    });
    await expect(sendEmail(INPUT, [postal])).rejects.toBeInstanceOf(RateLimitError);
  });

  it("refuses when no provider is configured", async () => {
    await expect(sendEmail(INPUT, [])).rejects.toThrow(/No email provider/);
  });
});

describe("providerChain", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "orders@send.example.com";
    process.env.POSTAL_API_URL = "https://postal.example.com";
    process.env.POSTAL_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.POSTAL_API_URL;
    delete process.env.POSTAL_API_KEY;
  });

  const names = (primary?: string | null) => providerChain(primary).map((p) => p.name);

  it("puts Resend first by default", () => {
    expect(names()).toEqual(["resend", "postal"]);
    expect(names(null)).toEqual(["resend", "postal"]);
  });

  it("puts Postal first when a store chooses it", () => {
    expect(names("postal")).toEqual(["postal", "resend"]);
  });

  it("ignores an unknown stored value", () => {
    expect(names("sendgrid")).toEqual(["resend", "postal"]);
  });

  it("puts Resend first for every non-Gmail recipient, whatever the store chose", () => {
    expect(names("postal")).toEqual(["postal", "resend"]);
    expect(providerChain("postal", "Kirsty@iCloud.com").map((p) => p.name)).toEqual([
      "resend",
      "postal",
    ]);
    expect(providerChain("postal", "a@me.com")[0].name).toBe("resend");
    expect(providerChain("postal", "a@outlook.com")[0].name).toBe("resend");
    expect(providerChain("postal", "a@yahoo.fr")[0].name).toBe("resend");
    expect(providerChain("postal", "a@shop.example")[0].name).toBe("resend");
  });

  it("keeps the store's choice for Gmail recipients", () => {
    expect(providerChain("postal", "A@Gmail.com")[0].name).toBe("postal");
    expect(providerChain("postal", "a@googlemail.com")[0].name).toBe("postal");
  });

  it("still sends non-Gmail mail through Postal when Resend is not configured", () => {
    delete process.env.RESEND_API_KEY;
    expect(providerChain("postal", "a@icloud.com").map((p) => p.name)).toEqual(["postal"]);
  });

  it("drops an unconfigured primary so mail still goes out", () => {
    delete process.env.POSTAL_API_KEY;
    expect(names("postal")).toEqual(["resend"]);
  });
});

describe("postalProvider", () => {
  beforeEach(() => {
    process.env.POSTAL_API_URL = "https://postal.example.com/";
    process.env.POSTAL_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.POSTAL_API_URL;
    delete process.env.POSTAL_API_KEY;
  });

  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("returns the message id on success", async () => {
    const fetchMock = stubFetch(200, {
      status: "success",
      data: {
        message_id: "abc@postal.example.com",
        messages: { "customer@example.com": { id: 991, token: "t" } },
      },
    });

    const result = await postalProvider.send(INPUT);

    expect(result).toEqual({
      provider: "postal",
      providerMessageId: "abc@postal.example.com",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://postal.example.com/api/v1/send/message");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      to: ["customer@example.com"],
      html_body: "<p>Hello</p>",
      plain_body: "Hello",
    });
    expect(body.headers["X-Idempotency-Key"]).toBe(INPUT.idempotencyKey);
  });

  it("throws on a status: error body, even with HTTP 200", async () => {
    stubFetch(200, {
      status: "error",
      data: { code: "ValidationError", message: "From address is not valid" },
    });

    await expect(postalProvider.send(INPUT)).rejects.toThrow(
      /Postal send failed: 200 From address is not valid/,
    );
  });

  it("maps an HTTP 429 to a RateLimitError", async () => {
    stubFetch(429, { status: "error", data: { message: "Too many requests" } });
    await expect(postalProvider.send(INPUT)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("throws on a non-JSON error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Bad gateway", { status: 502 })),
    );
    await expect(postalProvider.send(INPUT)).rejects.toThrow(/Postal send failed: 502/);
  });
});

describe("summariseVolume", () => {
  it("computes the provider split, largest first", () => {
    const stats = summariseVolume([
      { provider: "postal", last30: 6, last7: 2 },
      { provider: "resend", last30: 94, last7: 30 },
    ]);
    expect(stats.sentLast30Days).toBe(100);
    expect(stats.sentLast7Days).toBe(32);
    expect(stats.providers30Days.map((p) => [p.provider, p.share])).toEqual([
      ["resend", 0.94],
      ["postal", 0.06],
    ]);
  });

  it("reports zero shares when nothing was sent", () => {
    expect(summariseVolume([])).toEqual({
      sentLast7Days: 0,
      sentLast30Days: 0,
      providers30Days: [],
    });
  });
});

describe("Brevo is gone", () => {
  it("has no reference left in the application source", () => {
    let matches = "";
    try {
      matches = execFileSync(
        "git",
        ["grep", "-il", "brevo", "--", "app", "lib", "components", "scripts", ".env.example", "docs"],
        { encoding: "utf8" },
      );
    } catch {
      // `git grep` exits 1 when nothing matches — the outcome we want.
    }
    expect(matches.trim()).toBe("");
  });
});
