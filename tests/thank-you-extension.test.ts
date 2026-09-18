import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { APP_PROXY_PREFIX, APP_PROXY_SUBPATH, trackingPath } from "@/lib/tracking/links";
import { CUSTOMER_LOOKUP_MODE } from "@/lib/tracking/lookup";

/**
 * The checkout extension that puts "Track my order" on the thank-you page.
 *
 * It is bundled by the Shopify CLI for a different runtime, so it cannot
 * import from the Next app and holds its own copy of two facts: where the
 * tracking page lives, and which query parameter the lookup form reads. Both
 * are silent when wrong — the button simply lands on a 404, or on an empty
 * form — so they are checked here instead.
 */

const ROOT = process.cwd();
const SOURCE = readFileSync(
  path.join(ROOT, "extensions/track-order/src/ThankYou.tsx"),
  "utf8",
);
const MANIFEST = readFileSync(
  path.join(ROOT, "extensions/track-order/shopify.extension.toml"),
  "utf8",
);

describe("the extension agrees with the app it links to", () => {
  it("uses the App Proxy path the app actually serves", () => {
    expect(trackingPath()).toBe(`/${APP_PROXY_PREFIX}/${APP_PROXY_SUBPATH}`);

    const declared = SOURCE.match(/const TRACKING_PATH = "([^"]+)"/)?.[1];
    expect(declared, "TRACKING_PATH is not declared as a literal").toBeTruthy();
    expect(declared).toBe(trackingPath());
  });

  it("pre-fills the parameter the lookup form reads", () => {
    // The tracking form posts its single field as `q`, and the resolver reads
    // `q`. A button linking with any other name would open a blank form.
    expect(SOURCE).toContain("?q=");
    expect(SOURCE).toContain("encodeURIComponent(email)");
  });

  it("only pre-fills an email while the lookup asks for one", () => {
    // Pre-filling `q` with the buyer's email is right because the customer
    // surface is email-only. If that policy tightens to two-factor, the link
    // should stop claiming to identify the order on its own.
    expect(CUSTOMER_LOOKUP_MODE).toBe("email-only");
  });
});

describe("the extension manifest", () => {
  it("targets the thank-you block", () => {
    expect(MANIFEST).toContain('target = "purchase.thank-you.block.render"');
    expect(MANIFEST).toContain('module = "./src/ThankYou.tsx"');
    expect(MANIFEST).toContain('type = "ui_extension"');
  });

  it("declares every setting the component reads", () => {
    // A setting read but not declared is always undefined, so the component
    // silently uses its fallback and the merchant's edit does nothing.
    const read = [...SOURCE.matchAll(/^\s{4}(\w+)\?: string;$/gm)].map(
      (match) => match[1],
    );

    expect(read.length).toBeGreaterThan(0);
    for (const key of read) {
      expect(MANIFEST, `setting "${key}" is read but not declared`).toContain(
        `key = "${key}"`,
      );
    }
  });
});
