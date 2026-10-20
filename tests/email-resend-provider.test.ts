import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { RateLimitError } from "@/lib/email/providers";
import { resendProvider } from "@/lib/email/providers/resend";

/** Only a rate limit or quota refusal may hand a send over to Postal. */
const INPUT = {
  from: "Store <orders@send.example.com>",
  to: "customer@example.com",
  subject: "Hi",
  html: "<p>Hi</p>",
  idempotencyKey: "send-1",
};

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM_EMAIL = "orders@send.example.com";
  send.mockReset();
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

describe("resendProvider", () => {
  it("passes the idempotency key and returns the message id", async () => {
    send.mockResolvedValue({ data: { id: "re_1" }, error: null });
    await expect(resendProvider.send(INPUT)).resolves.toEqual({
      provider: "resend",
      providerMessageId: "re_1",
    });
    expect(send.mock.calls[0][1]).toEqual({ idempotencyKey: "send-1" });
  });

  it.each([
    ["rate_limit_exceeded", 429],
    ["daily_quota_exceeded", 429],
    ["monthly_quota_exceeded", 429],
  ])("maps %s to a RateLimitError", async (name, statusCode) => {
    send.mockResolvedValue({
      data: null,
      error: { name, message: "Too many", statusCode },
    });
    await expect(resendProvider.send(INPUT)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("keeps any other refusal a plain error", async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid `to`", statusCode: 422 },
    });
    const error = await resendProvider.send(INPUT).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(RateLimitError);
  });
});
