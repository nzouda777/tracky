import { beforeEach, describe, expect, it } from "vitest";

import { sendContactMessage } from "@/app/(marketing)/contact/actions";

/**
 * The contact form is the only endpoint an anonymous visitor can use to make
 * the server send an email, so its guards are worth pinning.
 *
 * These run with no CONTACT_EMAIL and no Resend key, which is the state a
 * fresh checkout is in — so nothing here can actually send. That is the point:
 * every path below either rejects before delivery, or reports honestly that it
 * could not deliver.
 */
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** A submission that looks human: complete, and filled in slowly enough. */
function humanSubmission(overrides: Record<string, string> = {}): FormData {
  return form({
    name: "Sarah Jenkins",
    email: "sarah@example.com",
    company: "Northside Supply",
    message:
      "We deliver about 200 orders a week with two of our own drivers and would like a proper tracking page.",
    renderedAt: String(Date.now() - 30_000),
    ...overrides,
  });
}

beforeEach(() => {
  delete process.env.CONTACT_EMAIL;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

describe("silent drops", () => {
  it("drops a submission that filled the honeypot", async () => {
    const result = await sendContactMessage(
      {},
      humanSubmission({ website: "https://spam.example" }),
    );

    // Reported as success so an automated client learns nothing and stops
    // retrying — but nothing was sent, which the unconfigured env proves.
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("drops a submission completed impossibly fast", async () => {
    const result = await sendContactMessage(
      {},
      humanSubmission({ renderedAt: String(Date.now() - 200) }),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts one that took a human amount of time", async () => {
    const result = await sendContactMessage({}, humanSubmission());
    // Passes the bot checks and validation, and then fails honestly at
    // delivery because nothing is configured.
    expect(result.ok).toBeUndefined();
    expect(result.error).toMatch(/not configured/i);
  });
});

describe("validation", () => {
  it("requires a name, an address and a message", async () => {
    const result = await sendContactMessage(
      {},
      form({ renderedAt: String(Date.now() - 30_000) }),
    );

    expect(result.fieldErrors?.name).toBeTruthy();
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(result.fieldErrors?.message).toBeTruthy();
  });

  it("rejects an address that is not one", async () => {
    const result = await sendContactMessage(
      {},
      humanSubmission({ email: "not-an-address" }),
    );
    expect(result.fieldErrors?.email).toBeTruthy();
  });

  it("asks for more than a couple of words", async () => {
    const result = await sendContactMessage(
      {},
      humanSubmission({ message: "call me" }),
    );
    expect(result.fieldErrors?.message).toBeTruthy();
  });

  it("treats whitespace as empty", async () => {
    const result = await sendContactMessage(
      {},
      humanSubmission({ name: "   ", message: "   " }),
    );
    expect(result.fieldErrors?.name).toBeTruthy();
    expect(result.fieldErrors?.message).toBeTruthy();
  });
});

describe("honest failure", () => {
  it("never claims to have sent when it cannot", async () => {
    const result = await sendContactMessage({}, humanSubmission());
    expect(result.ok).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("still refuses when a contact address exists but email does not", async () => {
    process.env.CONTACT_EMAIL = "hello@example.com";
    const result = await sendContactMessage({}, humanSubmission());
    expect(result.ok).toBeUndefined();
    expect(result.error).toMatch(/not configured/i);
  });
});
