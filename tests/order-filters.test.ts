import { describe, expect, it } from "vitest";

import {
  countActiveFilters,
  parseOrderFilters,
  presetRange,
} from "@/lib/orders/filters";
import { ORDER_SORTS, isOrderSort } from "@/lib/orders/queries";

/**
 * The orders list filters.
 *
 * Everything here arrives in the query string, which anyone can type, so the
 * contract worth pinning down is: a value is either recognised and applied, or
 * ignored entirely. Nothing in between, and nothing reaches a SQL clause that
 * was not on a list.
 */

describe("parsing the query string", () => {
  it("reads a date range as inclusive whole days", () => {
    const filters = parseOrderFilters({ from: "2026-03-01", to: "2026-03-31" });

    expect(filters.placedFrom?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    // The last instant of the 31st, so an order placed that evening is in.
    expect(filters.placedTo?.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("swaps a backwards range instead of matching nothing", () => {
    const filters = parseOrderFilters({ from: "2026-03-31", to: "2026-03-01" });

    expect(filters.placedFrom?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(filters.placedTo?.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("accepts one end of the range on its own", () => {
    expect(parseOrderFilters({ from: "2026-03-01" }).placedTo).toBeUndefined();
    expect(parseOrderFilters({ to: "2026-03-01" }).placedFrom).toBeUndefined();
  });

  it("ignores a date that is not a date", () => {
    for (const from of ["yesterday", "2026-3-1", "2026-13-40x", "", "0000"]) {
      expect(parseOrderFilters({ from }).placedFrom).toBeUndefined();
    }
  });

  it("maps each status to exactly one flag", () => {
    expect(parseOrderFilters({ status: "active" })).toMatchObject({
      onlyActive: true,
      onlyCompleted: false,
      onlyCancelled: false,
    });
    expect(parseOrderFilters({ status: "completed" })).toMatchObject({
      onlyActive: false,
      onlyCompleted: true,
      onlyCancelled: false,
    });
    expect(parseOrderFilters({ status: "cancelled" })).toMatchObject({
      onlyActive: false,
      onlyCompleted: false,
      onlyCancelled: true,
    });
    expect(parseOrderFilters({ status: "nonsense" })).toMatchObject({
      onlyActive: false,
      onlyCompleted: false,
      onlyCancelled: false,
    });
  });

  it("only accepts fulfillment values the column can hold", () => {
    expect(parseOrderFilters({ fulfillment: "failed" }).fulfillment).toBe(
      "failed",
    );
    expect(
      parseOrderFilters({ fulfillment: "'; drop table orders; --" }).fulfillment,
    ).toBeUndefined();
  });

  it("treats the delivery filter as three states, not two", () => {
    expect(parseOrderFilters({ proof: "yes" }).hasProof).toBe(true);
    expect(parseOrderFilters({ proof: "no" }).hasProof).toBe(false);
    // Absent must stay undefined: `false` would silently hide every confirmed
    // delivery from the unfiltered list.
    expect(parseOrderFilters({}).hasProof).toBeUndefined();
    expect(parseOrderFilters({ proof: "maybe" }).hasProof).toBeUndefined();
  });

  it("only accepts a sort it knows how to apply", () => {
    expect(parseOrderFilters({ sort: "oldest" }).sort).toBe("oldest");
    expect(parseOrderFilters({ sort: "total; --" }).sort).toBeUndefined();
    for (const key of Object.keys(ORDER_SORTS)) {
      expect(isOrderSort(key)).toBe(true);
    }
    expect(isOrderSort("createdAt")).toBe(false);
    expect(isOrderSort(undefined)).toBe(false);
  });

  it("only accepts an offered page size", () => {
    expect(parseOrderFilters({ per: "100" }).perPage).toBe(100);
    // Not on the list: fall back rather than let a page size of 10000 through.
    expect(parseOrderFilters({ per: "10000" }).perPage).toBeUndefined();
    expect(parseOrderFilters({ per: "abc" }).perPage).toBeUndefined();
  });

  it("never returns a page below 1", () => {
    expect(parseOrderFilters({ page: "0" }).page).toBe(1);
    expect(parseOrderFilters({ page: "-5" }).page).toBe(1);
    expect(parseOrderFilters({ page: "abc" }).page).toBe(1);
    expect(parseOrderFilters({ page: "3" }).page).toBe(3);
  });

  it("drops blank and whitespace-only text", () => {
    expect(parseOrderFilters({ q: "   " }).search).toBeUndefined();
    expect(parseOrderFilters({ q: "  #1042 " }).search).toBe("#1042");
    expect(parseOrderFilters({ driver: "  " }).driver).toBeUndefined();
  });
});

describe("counting what is narrowing the list", () => {
  it("counts only filters, not presentation", () => {
    // Sort, page size and page number change how the same set is shown, so
    // offering to "clear" them would be a lie about what is being hidden.
    expect(countActiveFilters({ sort: "oldest", per: "100", page: "4" })).toBe(0);
    expect(countActiveFilters({ q: "acme", status: "active" })).toBe(2);
    expect(countActiveFilters({ from: "2026-03-01", to: "2026-03-31" })).toBe(2);
    expect(countActiveFilters({})).toBe(0);
  });

  it("does not count an empty search box", () => {
    expect(countActiveFilters({ q: "   " })).toBe(0);
  });
});

describe("date presets", () => {
  it("produces a range the date inputs accept", () => {
    const range = presetRange(7);
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.from <= range.to).toBe(true);
  });

  it("counts today as day one, so 7 days spans 7 days", () => {
    const { from, to } = presetRange(7);
    const days =
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000;
    expect(days).toBe(6);

    expect(presetRange(1).from).toBe(presetRange(1).to);
  });

  it("round-trips through the parser", () => {
    const filters = parseOrderFilters(presetRange(30));
    expect(filters.placedFrom).toBeInstanceOf(Date);
    expect(filters.placedTo).toBeInstanceOf(Date);
    expect(filters.placedFrom!.getTime()).toBeLessThan(
      filters.placedTo!.getTime(),
    );
  });
});
