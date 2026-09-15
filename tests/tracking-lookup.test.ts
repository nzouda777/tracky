import { describe, expect, it } from "vitest";

import { classifyLookup } from "@/components/tracking/lookup-form";
import { resolveLookupParams } from "@/lib/tracking/lookup";

/**
 * The two customer surfaces ask for different things, and the difference is
 * load-bearing.
 *
 * The App Proxy page (`two-factor`) requires the order number *and* the email,
 * so the page served on a merchant's own domain can never be walked. The hosted
 * page (`order-only`) opens an order on its number alone, which is a guessable
 * credential — so what it hands back is capped by `access`, and the page renders
 * the restricted view for `order-number`.
 *
 * These tests pin both halves: that `order-only` really is one field, and that
 * it never claims more access than the visitor proved.
 */
describe("classifyLookup", () => {
  it("treats anything with an @ as an email address", () => {
    expect(classifyLookup("sarah@example.com")).toBe("email");
    expect(classifyLookup(" SARAH@EXAMPLE.COM ")).toBe("email");
  });

  it("treats everything else as an order number", () => {
    expect(classifyLookup("#1042")).toBe("order");
    expect(classifyLookup("1042")).toBe("order");
  });
});

describe("resolveLookupParams — shared behaviour", () => {
  it("asks for the first field when nothing was supplied", () => {
    for (const mode of ["two-factor", "order-only"] as const) {
      const result = resolveLookupParams({ mode });
      expect(result.attempted).toBe(false);
      expect(result.access).toBe("none");
      expect(result.formStep).toEqual({ step: "identify" });
    }
  });

  it("gives the emailed token link the highest access, on either surface", () => {
    for (const mode of ["two-factor", "order-only"] as const) {
      const result = resolveLookupParams({ token: "tok_abc123", mode });
      expect(result).toMatchObject({
        token: "tok_abc123",
        attempted: true,
        access: "token",
      });
    }
  });

  it("treats a matching order+email pair as verified, on either surface", () => {
    for (const mode of ["two-factor", "order-only"] as const) {
      expect(
        resolveLookupParams({
          q: "#1042",
          confirm: "sarah@example.com",
          mode,
        }),
      ).toMatchObject({
        orderNumber: "#1042",
        email: "sarah@example.com",
        attempted: true,
        access: "verified",
      });

      // The halves may arrive in either order.
      expect(
        resolveLookupParams({
          q: "sarah@example.com",
          confirm: "#1042",
          mode,
        }),
      ).toMatchObject({
        orderNumber: "#1042",
        email: "sarah@example.com",
        access: "verified",
      });

      // And the legacy pair still works.
      expect(
        resolveLookupParams({
          order: "#1042",
          email: "sarah@example.com",
          mode,
        }),
      ).toMatchObject({ attempted: true, access: "verified" });
    }
  });

  it("ignores whitespace-only input rather than treating it as an answer", () => {
    for (const mode of ["two-factor", "order-only"] as const) {
      expect(resolveLookupParams({ q: "   ", mode }).attempted).toBe(false);
      expect(resolveLookupParams({ token: "  ", mode }).attempted).toBe(false);
      expect(resolveLookupParams({ q: "   ", mode }).formStep).toEqual({
        step: "identify",
      });
    }
  });
});

describe("resolveLookupParams — the App Proxy page (two-factor)", () => {
  it("never searches on one field: it asks for the other half", () => {
    const order = resolveLookupParams({ q: "#1042", mode: "two-factor" });
    expect(order.attempted).toBe(false);
    expect(order.orderNumber).toBeNull();
    expect(order.access).toBe("none");
    expect(order.formStep).toEqual({
      step: "confirm",
      value: "#1042",
      kind: "order",
    });

    const email = resolveLookupParams({
      q: "sarah@example.com",
      mode: "two-factor",
    });
    expect(email.attempted).toBe(false);
    expect(email.formStep).toEqual({
      step: "confirm",
      value: "sarah@example.com",
      kind: "email",
    });
  });

  it("refuses a half-filled legacy pair", () => {
    expect(
      resolveLookupParams({ order: "#1042", mode: "two-factor" }).attempted,
    ).toBe(false);
    expect(
      resolveLookupParams({ email: "sarah@example.com", mode: "two-factor" })
        .attempted,
    ).toBe(false);
  });

  it("defaults to two-factor when no mode is named", () => {
    // A new surface that forgets to choose gets the strict rule, not the lax one.
    expect(resolveLookupParams({ q: "#1042" }).attempted).toBe(false);
  });
});

describe("resolveLookupParams — the hosted page (order-only)", () => {
  it("searches on the order number alone, at the lowest access level", () => {
    const result = resolveLookupParams({ q: "#1042", mode: "order-only" });
    expect(result).toMatchObject({
      orderNumber: "#1042",
      email: null,
      attempted: true,
      access: "order-number",
    });
    // One field, one submit — it never advances to a second question.
    expect(result.formStep).toEqual({ step: "identify" });
  });

  it("accepts an order number in the legacy `order` slot too", () => {
    expect(
      resolveLookupParams({ order: "1042", mode: "order-only" }),
    ).toMatchObject({ orderNumber: "1042", attempted: true, access: "order-number" });
  });

  it("refuses an email on its own and says what it wants instead", () => {
    const result = resolveLookupParams({
      q: "sarah@example.com",
      mode: "order-only",
    });
    expect(result.attempted).toBe(false);
    expect(result.access).toBe("none");
    expect(result.inputError).toMatch(/order number/i);
  });

  it("falls back to the two-step form when the visitor asks to verify", () => {
    const result = resolveLookupParams({
      q: "#1042",
      verify: "1",
      mode: "order-only",
    });
    expect(result.attempted).toBe(false);
    expect(result.access).toBe("none");
    expect(result.formStep).toEqual({
      step: "confirm",
      value: "#1042",
      kind: "order",
    });
  });

  it("upgrades to verified once the email comes back with the order number", () => {
    expect(
      resolveLookupParams({
        q: "#1042",
        confirm: "sarah@example.com",
        verify: "1",
        mode: "order-only",
      }),
    ).toMatchObject({ attempted: true, access: "verified" });
  });

  /**
   * The whole restricted view hangs off this: `order-number` must never be
   * reported for a lookup that actually proved something, and `verified` must
   * never be reported for one that did not.
   */
  it("never reports an access level the visitor did not earn", () => {
    const earned: Array<[Parameters<typeof resolveLookupParams>[0], string]> = [
      [{ q: "#1042", mode: "order-only" }, "order-number"],
      [{ q: "#1042", confirm: "a@b.com", mode: "order-only" }, "verified"],
      [{ token: "tok", mode: "order-only" }, "token"],
      [{ q: "a@b.com", mode: "order-only" }, "none"],
      [{ mode: "order-only" }, "none"],
    ];

    for (const [input, expected] of earned) {
      expect(resolveLookupParams(input).access).toBe(expected);
    }
  });
});
