import { describe, expect, it } from "vitest";

import { classifyLookup } from "@/components/tracking/lookup-form";
import { resolveLookupParams } from "@/lib/tracking/lookup";

/**
 * The public tracking page asks for one thing at a time, which makes it feel
 * like a single-field lookup. It is not: an order number on its own must never
 * resolve an order, or the page becomes an order-enumeration endpoint — type
 * #1001, #1002, #1003 and read a stranger's name and address each time.
 *
 * These tests pin that rule at the resolver, which is the only place both
 * customer-facing surfaces (the App Proxy page and the hosted one) turn query
 * parameters into a search.
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

describe("resolveLookupParams", () => {
  it("asks for the first field when nothing was supplied", () => {
    const result = resolveLookupParams({});
    expect(result.attempted).toBe(false);
    expect(result.formStep).toEqual({ step: "identify" });
  });

  it("does not search on step one alone — it asks for the other half", () => {
    const order = resolveLookupParams({ q: "#1042" });
    expect(order.attempted).toBe(false);
    expect(order.orderNumber).toBeNull();
    expect(order.email).toBeNull();
    expect(order.formStep).toEqual({
      step: "confirm",
      value: "#1042",
      kind: "order",
    });

    const email = resolveLookupParams({ q: "sarah@example.com" });
    expect(email.attempted).toBe(false);
    expect(email.formStep).toEqual({
      step: "confirm",
      value: "sarah@example.com",
      kind: "email",
    });
  });

  it("searches once both halves are in hand, whichever order they arrived in", () => {
    const orderFirst = resolveLookupParams({
      q: "#1042",
      confirm: "sarah@example.com",
    });
    expect(orderFirst).toMatchObject({
      token: null,
      orderNumber: "#1042",
      email: "sarah@example.com",
      attempted: true,
    });

    const emailFirst = resolveLookupParams({
      q: "sarah@example.com",
      confirm: "#1042",
    });
    expect(emailFirst).toMatchObject({
      token: null,
      orderNumber: "#1042",
      email: "sarah@example.com",
      attempted: true,
    });
  });

  it("still honours the emailed token link", () => {
    const result = resolveLookupParams({ token: "tok_abc123" });
    expect(result.attempted).toBe(true);
    expect(result.token).toBe("tok_abc123");
  });

  it("still honours the legacy order+email pair, and only as a pair", () => {
    expect(
      resolveLookupParams({ order: "#1042", email: "sarah@example.com" }),
    ).toMatchObject({ attempted: true });

    // An order number with no email is the enumeration case. It must not search.
    expect(resolveLookupParams({ order: "#1042" }).attempted).toBe(false);
    expect(resolveLookupParams({ email: "sarah@example.com" }).attempted).toBe(
      false,
    );
  });

  it("ignores whitespace-only input rather than treating it as an answer", () => {
    expect(resolveLookupParams({ q: "   " }).formStep).toEqual({
      step: "identify",
    });
    expect(
      resolveLookupParams({ q: "#1042", confirm: "   " }).attempted,
    ).toBe(false);
    expect(resolveLookupParams({ token: "  " }).attempted).toBe(false);
  });
});
