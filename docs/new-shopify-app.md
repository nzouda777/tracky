# Creating a new Shopify app

Companion to [`store-onboarding.md`](./store-onboarding.md). That document
covers adding a **store**. This one covers adding an **app** — the work that
has to happen before, or the store will be connected but half-wired.

## Why there is more than one app

A single Shopify app is capped in how many stores it can be installed on. So
Tracky runs several apps at once, and each store records which one it belongs
to in `stores.api_key` / `stores.api_secret`. Nothing about apps lives in
environment variables, so adding one never needs a redeploy.

The consequence is the thing that catches people out:

> Two capabilities belong to the **app**, not to the store — the **App Proxy**
> that serves the tracking page, and the **thank-you extension**. A store
> connected to a brand-new app inherits neither until that app has been
> configured and deployed to.

The symptoms are unhelpful. The checkout editor simply shows no "Track my
order" block to add, and `/apps/track-order` returns the theme's 404. Neither
says anything about apps.

## Start by looking

```bash
npm run apps:inventory
```

For every store it prints which app it runs on, whether this repo has a
configuration for that app, and whether the tracking page actually answers.
A store reported as `NO LOCAL CONFIG` has almost certainly never received the
extension.

```
Disillusion  (wppt0y-iu.myshopify.com)
  status        active
  app           1d2081f00658b4a171161e190b5083db  → NO LOCAL CONFIG
  tracking page ok
```

That store has a working App Proxy but no extension — exactly the state this
document exists to get you out of.

---

## 1. Create the app

In the Shopify **Partner dashboard** → Apps → Create app → Create app manually.
Name it something you can tell apart later (`Tracky 2`, `Tracky 3`).

Then open **Client credentials** and keep the page: you need the **Client ID**
and **Client secret** in step 4.

## 2. Configure it

Every new app must match the working one. Use
[`shopify.app.tracky.toml`](../shopify.app.tracky.toml) as the reference — it
is the live configuration of the app that works.

### URLs

| Field | Value |
| --- | --- |
| App URL | `https://tracky-ordertrack.site/` |
| Allowed redirection URL | `https://tracky-ordertrack.site/api/shopify/callback` |
| Embedded | yes |

### App Proxy — do not skip this

Without it the tracking page has no address on the merchant's domain, the
thank-you button leads to a 404, and every link in every email is dead.

| Field | Value |
| --- | --- |
| Subpath prefix | `apps` |
| Subpath | `track-order` |
| Proxy URL | `https://tracky-ordertrack.site/proxy/track-order` |

No trailing slash on the proxy URL. A trailing slash makes our own router issue
a 308 redirect that Shopify resolves against the wrong origin, and the customer
lands on a Shopify 404.

### Scopes

```
read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,read_custom_fulfillment_services,write_custom_fulfillment_services,write_draft_orders,read_draft_orders,read_fulfillment_constraint_rules,write_fulfillment_constraint_rules,read_fulfillments,write_fulfillments,read_inventory_purchase_orders,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders,read_orders,write_orders,read_third_party_fulfillment_orders,write_third_party_fulfillment_orders,customer_read_draft_orders,customer_read_orders,customer_write_orders
```

### Protected customer data

Under **API access → Protected customer data**, request access and declare a
reason for **name**, **email**, **phone** and **address**. Without it the
Admin API returns orders with those fields blanked, so the tracking page cannot
match a customer and the emails have nobody to go to.

### Webhooks

API version `2026-07`, to match the reference config.

## 3. Link the configuration locally

```bash
shopify app config link          # pick the new app; writes shopify.app.<name>.toml
```

> ⚠️ Never deploy from the repo-root `shopify.app.toml`. It is a template full
> of placeholders (`REPLACE_WITH_THIS_APP_CLIENT_ID`, `https://APP_URL`), and
> `shopify app deploy` publishes **the configuration as well as the extension**
> — deploying from it would overwrite a live app's URLs and App Proxy.

`config link` pulls what is actually in the dashboard, so the deploy in the
next step sends that same configuration back unchanged and only the extension
is new. Commit the resulting `shopify.app.<name>.toml`: `apps:inventory` reads
these files to tell which apps have been set up.

## 4. Deploy the thank-you extension

```bash
shopify app deploy -c <name>
```

Or without linking first:

```bash
shopify app deploy --client-id <the new app's client id>
```

This is **per app**, and again whenever the extension itself changes. The
extension bundle lives on Shopify, not on Vercel, so a Vercel deploy never
carries it.

Nothing in the extension is per-store: it derives the tracking URL from
`useShop()` at runtime, so one deploy covers every store on that app.

## 5. Add the store in Tracky

Now follow [`store-onboarding.md` § 2](./store-onboarding.md), pasting **this
app's** Client ID and Client secret. Tracky stores the secret encrypted and
uses it to verify that app's webhooks and App Proxy signatures.

## 6. Add the block — per store

In the store's admin:

**Settings → Checkout → Customize → Thank you page → Add app block → Track my
order.**

The block does not place itself. Its heading, supporting line and button label
are editable there, without redeploying.

---

## Verify

```bash
npm run apps:inventory
```

- [ ] The new app appears with `app_proxy ✓`
- [ ] The store resolves to a `shopify.app.<name>.toml`, not `NO LOCAL CONFIG`
- [ ] `tracking page ok`

Then, in the store:

- [ ] The thank-you page shows the **Track my order** block after a test order
- [ ] The button lands on the tracking page inside the theme, email pre-filled

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| No "Track my order" block to add in the checkout editor | The extension was never deployed under this store's app | `shopify app config link`, then `shopify app deploy -c <name>` |
| `/apps/track-order` returns the theme's 404 | This app has no App Proxy, or its URL has a trailing slash | Step 2, App Proxy |
| Deploy fails with `Could not resolve "react-reconciler"` | The extension's own dependencies are not installed | `cd extensions/track-order && npm install` — it pins its own React 18 |
| Tracking page renders but finds no order | Protected customer data not granted, so names and emails come back blank | Step 2, protected customer data |
| Webhooks arrive but fail verification | The store was saved with another app's secret | Re-enter the keys on the Stores screen |

## Reference

| Command | What it does |
| --- | --- |
| `npm run apps:inventory` | Which app each store is on, and whether it is fully wired |
| `shopify app config link` | Pulls a dashboard app's config into `shopify.app.<name>.toml` |
| `shopify app deploy -c <name>` | Deploys the extension under one app |
| `npm run shopify:diagnose` | Per-store connection diagnosis |
