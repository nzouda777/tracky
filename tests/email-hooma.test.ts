import { describe, expect, it } from "vitest";

import {
  HOOMA_DEFAULT_OPTIONS,
  HOOMA_TEMPLATE_SET,
  readHoomaOptionsForm,
  resolveHoomaOptions,
} from "@/lib/email/designs/hooma-options";
import { sampleMergeContext } from "@/lib/email/merge";
import { SAMPLE_ORDER_FACTS } from "@/lib/email/order-facts";
import { renderEmail } from "@/lib/email/render";

const store = { name: "Northside Supply", shopDomain: "northside.myshopify.com" };

function render(options: Record<string, unknown>, body = "<p>Hello.</p>") {
  return renderEmail({
    subject: "Order {{order_number}}",
    body,
    design: "hooma",
    designOptions: options,
    order: SAMPLE_ORDER_FACTS,
    context: sampleMergeContext(store.name),
    branding: null,
    store,
  });
}

describe("Hooma design options", () => {
  it("fills anything missing or malformed with the defaults", () => {
    expect(resolveHoomaOptions(null)).toEqual(HOOMA_DEFAULT_OPTIONS);
    const resolved = resolveHoomaOptions({ theme: "neon", heroTitle: 42, showItems: true });
    expect(resolved.theme).toBe(HOOMA_DEFAULT_OPTIONS.theme);
    expect(resolved.heroTitle).toBe(HOOMA_DEFAULT_OPTIONS.heroTitle);
    expect(resolved.showItems).toBe(true);
  });

  it("reads the editor's form, unchecked boxes meaning off", () => {
    const form = new FormData();
    form.set("hooma.theme", "green");
    form.set("hooma.heroTitle", "  Thank you!  ");
    form.set("hooma.showItems", "on");
    const options = readHoomaOptionsForm(form);
    expect(options.theme).toBe("green");
    expect(options.heroTitle).toBe("Thank you!");
    expect(options.showItems).toBe(true);
    expect(options.showAddress).toBe(false);
  });
});

describe("Hooma rendering", () => {
  it("renders every text setting, with merge variables applied", async () => {
    const { html } = await render({
      ...HOOMA_DEFAULT_OPTIONS,
      heroTitle: "Hello {{customer_first_name}}",
      nextUpdate: "Next update: tomorrow",
      buttonLabel: "Follow {{order_number}}",
    });
    expect(html).toContain("Hello Sarah");
    expect(html).toContain("Next update: tomorrow");
    expect(html).toContain("Follow #1042");
    expect(html).toContain("AUD 158.00");
  });

  it("hides the sections that are switched off", async () => {
    const { html } = await render({
      ...HOOMA_DEFAULT_OPTIONS,
      nextUpdate: "",
      showOrderCard: false,
      showAddress: false,
      showItems: false,
      buttonLabel: "",
    });
    expect(html).not.toContain("Next update");
    expect(html).not.toContain("Order Number");
    expect(html).not.toContain("Delivery Address");
    expect(html).not.toContain("Linen Throw Blanket");
    expect(html).not.toContain("Track your order");
  });

  it("renders every template of the ready-made set", async () => {
    for (const template of HOOMA_TEMPLATE_SET) {
      const { html } = await render(template.options, template.body);
      expect(html).toContain(template.options.heroTitle.replace("'", "&#x27;"));
    }
  });
});
