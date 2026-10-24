import { generateKeyPairSync, createSign } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  parsePostalEvent,
  tokenMatches,
  toPem,
  verifyPostalSignature,
} from "@/lib/email/postal-webhook";

/**
 * Postal's delivery webhooks: which reports are read, what they match on,
 * and which ones hand the email to Resend.
 */

const MESSAGE = {
  id: 12345,
  token: "abc",
  message_id: "5817a64332f44@rp.postal.example.com",
  to: "customer@icloud.com",
};

describe("parsePostalEvent", () => {
  it("reads a soft fail as delayed, without rerouting", () => {
    const event = parsePostalEvent({
      event: "MessageDelayed",
      payload: {
        message: MESSAGE,
        status: "SoftFail",
        details: "Temporary failure from mx01.mail.icloud.com",
        output: "421 4.7.0 [CS01] Message rejected due to local policy",
      },
    });

    expect(event).toMatchObject({ status: "delayed", reroute: false });
    expect(event?.detail).toContain("421 4.7.0");
    expect(event?.messageIds).toEqual(
      expect.arrayContaining([
        "5817a64332f44@rp.postal.example.com",
        "<5817a64332f44@rp.postal.example.com>",
        "12345",
      ]),
    );
  });

  it("reroutes a hard fail and a hold", () => {
    for (const name of ["MessageDeliveryFailed", "MessageHeld"]) {
      const event = parsePostalEvent({
        event: name,
        payload: { message: MESSAGE, status: "HardFail", details: "550 no" },
      });
      expect(event?.reroute).toBe(true);
    }
  });

  it("marks a delivery as delivered", () => {
    expect(
      parsePostalEvent({ event: "MessageSent", payload: { message: MESSAGE, status: "Sent" } }),
    ).toMatchObject({ status: "delivered", reroute: false });
  });

  it("matches a bounce on the original message", () => {
    const event = parsePostalEvent({
      event: "MessageBounced",
      payload: {
        original_message: MESSAGE,
        bounce: { id: 9, subject: "Mail delivery failed" },
      },
    });
    expect(event).toMatchObject({ status: "bounced", reroute: false });
    expect(event?.messageIds).toContain("12345");
    expect(event?.detail).toBe("Bounced: Mail delivery failed");
  });

  it("ignores events it does not track and malformed bodies", () => {
    expect(parsePostalEvent({ event: "MessageLinkClicked", payload: { message: MESSAGE } })).toBeNull();
    expect(parsePostalEvent({ event: "MessageSent", payload: {} })).toBeNull();
    expect(parsePostalEvent(null)).toBeNull();
  });
});

describe("webhook authentication", () => {
  it("compares the token exactly", () => {
    expect(tokenMatches("s3cret", "s3cret")).toBe(true);
    expect(tokenMatches("s3cre", "s3cret")).toBe(false);
    expect(tokenMatches(null, "s3cret")).toBe(false);
  });

  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  // What Postal shows: the key without its PEM armour.
  const bare = pem.replace(/-----[^-]+-----|\s/g, "");
  const rawBody = JSON.stringify({ event: "MessageSent", payload: { message: MESSAGE } });
  const sign = (algorithm: string, body = rawBody) =>
    createSign(algorithm).update(body).sign(privateKey, "base64");

  it("accepts a SHA-256 signature with a bare base64 key", () => {
    expect(toPem(bare)).toContain("BEGIN PUBLIC KEY");
    expect(
      verifyPostalSignature({
        rawBody,
        signature256: sign("RSA-SHA256"),
        signature: null,
        publicKey: bare,
      }),
    ).toBe(true);
  });

  it("accepts the legacy SHA-1 signature", () => {
    expect(
      verifyPostalSignature({
        rawBody,
        signature256: null,
        signature: sign("RSA-SHA1"),
        publicKey: pem,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body or a missing signature", () => {
    expect(
      verifyPostalSignature({
        rawBody: rawBody.replace("MessageSent", "MessageDeliveryFailed"),
        signature256: sign("RSA-SHA256"),
        signature: null,
        publicKey: pem,
      }),
    ).toBe(false);
    expect(
      verifyPostalSignature({ rawBody, signature256: null, signature: null, publicKey: pem }),
    ).toBe(false);
  });
});
