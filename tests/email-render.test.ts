import { describe, expect, it } from "vitest";

import { sampleMergeContext } from "@/lib/email/merge";
import { renderEmail } from "@/lib/email/render";

/**
 * Renders a template through the real React Email pipeline.
 *
 * This exists because a rendering failure is invisible until an email is
 * actually sent: `dispatchEmailSend` catches it and records the send as
 * failed, so the customer simply never hears from the store. Exercising the
 * renderer here turns that into a build failure instead.
 */
const store = { name: "Northside Supply", shopDomain: "northside.myshopify.com" };

const BODY = [
  "<p>Hi {{customer_name}},</p>",
  "<p>Order <strong>{{order_number}}</strong> is on its way to {{shipping_address}}.</p>",
  '<p><a href="{{tracking_link}}">Track your order</a></p>',
].join("\n");

describe("email rendering", () => {
  it("renders an admin-authored body into a branded HTML email", async () => {
    const rendered = await renderEmail({
      subject: "Order {{order_number}} is on the way",
      body: BODY,
      previewText: "Your order is out for delivery",
      context: sampleMergeContext(store.name),
      branding: null,
      store,
    });

    expect(rendered.subject).toBe("Order #1042 is on the way");
    expect(rendered.html).toContain("<html");
    // The body survived into the output, merged.
    expect(rendered.html).toContain("Sarah Jenkins");
    expect(rendered.html).toContain("<strong>#1042</strong>");
    // The store name is the fallback masthead when there is no logo.
    expect(rendered.html).toContain("Northside Supply");
  });

  it("produces a plain-text alternative", async () => {
    const rendered = await renderEmail({
      subject: "Order {{order_number}}",
      body: BODY,
      context: sampleMergeContext(store.name),
      branding: null,
      store,
    });

    expect(rendered.text).toContain("Sarah Jenkins");
    expect(rendered.text).not.toContain("<strong>");
  });

  it("does not let a hostile customer name inject markup", async () => {
    const context = sampleMergeContext(store.name);
    const rendered = await renderEmail({
      subject: "Hello",
      body: "<p>Hi {{customer_name}}</p>",
      context: { ...context, customer_name: "<img src=x onerror=alert(1)>" },
      branding: null,
      store,
    });

    // The angle brackets are escaped, so no element is created: the payload
    // survives only as inert text. That, not the absence of the substring, is
    // the property that matters.
    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("applies the store's branding colours and font", async () => {
    const rendered = await renderEmail({
      subject: "Hello",
      body: "<p>Hi</p>",
      context: sampleMergeContext(store.name),
      // Only the fields the layout reads; the rest is irrelevant here.
      branding: {
        primaryColor: "#ff0000",
        backgroundColor: "#fefefe",
        textColor: "#123456",
        accentColor: "#00ff00",
        fontFamily: "Georgia, serif",
        baseFontSize: 18,
        logoUrl: null,
        footerText: "Custom footer line",
        helpBannerUrl: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      store,
    });

    expect(rendered.html).toContain("#fefefe");
    expect(rendered.html).toContain("Georgia");
    expect(rendered.html).toContain("Custom footer line");
  });
});
