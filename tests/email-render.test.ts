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
    // The body survived into the output, merged. The tag is matched loosely
    // because the layout inlines typography onto it — asserting the exact
    // spelling would break on styling rather than on anything going wrong.
    expect(rendered.html).toContain("Sarah Jenkins");
    expect(rendered.html).toMatch(/<strong[^>]*>#1042<\/strong>/);
    // The store name is the fallback masthead when there is no logo.
    expect(rendered.html).toContain("Northside Supply");
  });

  /**
   * Every rule has to survive the trip.
   *
   * A `<style>` block is the first thing Outlook and Gmail discard, so the
   * typography applied to the owner's own HTML is inlined onto each tag. Left
   * to the client, bare `<p>` tags pick up Outlook's own margins and links
   * render in default browser blue — the loudest way an otherwise careful
   * email announces that nobody styled it.
   */
  it("inlines typography onto the body the owner wrote", async () => {
    const rendered = await renderEmail({
      subject: "Order {{order_number}}",
      body: BODY,
      context: sampleMergeContext(store.name),
      branding: null,
      store,
    });

    // Paragraphs carry their own margin and line height.
    expect(rendered.html).toMatch(/<p style="margin:0[^"]*line-height:\d+px/);
    // The author's link is brand-coloured, not left to the client's default.
    expect(rendered.html).toMatch(
      /<a href="[^"]*track-order[^"]*" style="color:#[0-9A-Fa-f]{6}/,
    );
    // No bare tag escapes the pass.
    expect(rendered.html).not.toContain("<p>");
    expect(rendered.html).not.toMatch(/<a href="[^"]*"\s*>/);
  });

  /**
   * The shell renders the call to action, so a body that carries its own link
   * is the author's choice rather than the layout duplicating itself. The
   * shipped defaults therefore contain neither a tracking link nor the
   * delivery address — both already have a place in the layout.
   */
  it("ships defaults that do not duplicate what the layout renders", async () => {
    const { DEFAULT_EMAIL_TEMPLATES } = await import(
      "@/lib/email/templates/defaults"
    );

    for (const template of DEFAULT_EMAIL_TEMPLATES) {
      expect(template.body, `${template.key} embeds the tracking link`).not.toContain(
        "{{tracking_link}}",
      );
      expect(
        template.body,
        `${template.key} repeats the delivery address`,
      ).not.toContain("{{shipping_address}}");
      expect(
        template.body,
        `${template.key} repeats the stage the headline already shows`,
      ).not.toContain("{{current_stage}}");
    }
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

/**
 * The sender's postal address.
 *
 * Not decoration: anti-spam law requires a commercial message to carry a real
 * address, and a classifier that cannot find one has been handed a free reason
 * to file the message as bulk. The store's own emails were landing in Gmail's
 * spam folder with an empty footer, which is what put this here.
 *
 * It has to reach both parts. Some filters score the plain-text alternative
 * rather than the HTML, so an address present only in the markup is an address
 * half the graders never see.
 */
describe("the postal address in the footer", () => {
  function branding(postalAddress: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { footerText: "", helpBannerUrl: null, postalAddress } as any;
  }

  it("prints the address in both the HTML and the text alternative", async () => {
    const address = "12 Rue Example, 75001 Paris, France";
    const rendered = await renderEmail({
      subject: "Hello",
      body: "<p>Hi</p>",
      context: sampleMergeContext(store.name),
      branding: branding(address),
      store,
    });

    expect(rendered.html).toContain(address);
    expect(rendered.text).toContain(address);
  });

  it("renders nothing at all when the store has not set one", async () => {
    // An unconfigured store must never be shown an address that is not its
    // own, nor the blank line where one would have gone.
    //
    // Asserting the address is absent would pass even if the block never
    // rendered at all, so this compares the empty string against the field
    // being missing entirely: the two have to produce the same bytes. The
    // renderer is deterministic, which is what makes that comparison legal.
    const html = (postalAddress?: string) =>
      renderEmail({
        subject: "Hello",
        body: "<p>Hi</p>",
        context: sampleMergeContext(store.name),
        branding:
          postalAddress === undefined
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ({ footerText: "", helpBannerUrl: null } as any)
            : branding(postalAddress),
        store,
      }).then((r) => r.html);

    expect(await html("")).toBe(await html(undefined));
    // And the guard is not vacuous: an address does change the output.
    expect(await html("12 Rue Example, 75001 Paris")).not.toBe(await html(""));
  });
});
