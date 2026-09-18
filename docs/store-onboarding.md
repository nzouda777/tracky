# Onboarding a store

Everything between "a merchant wants Tracky" and "their customers can track an
order", in order.

This is the runbook for **each new store**. It assumes the platform itself is
already deployed — that is [`deployment.md`](deployment.md), done once. What a
store owner does afterwards, day to day, is [`admin-guide.md`](admin-guide.md).

Throughout, `<app>` is your deployment's origin, e.g.
`https://tracky-ordertrack.site`, and `<shop>` is a store's myshopify host,
e.g. `md09z6-1w.myshopify.com`.

---

## What repeats, and what does not

This is the thing that catches people out. Tracky runs **many Shopify apps at
once**, because one app is capped in how widely it can be installed. So some
work is per app, some is per store, and some is never repeated.

| Task | How often |
| --- | --- |
| Deploy Tracky, database, email, scheduling | **Once**, ever |
| Create a Shopify app in the Partner dashboard | **Per app** — when the current one nears its install ceiling |
| Set the app's URLs, scopes and App Proxy | **Per app**, once each |
| Deploy the thank-you extension | **Per app**, and again whenever the extension changes |
| Add the store in Tracky with that app's keys | **Per store** |
| Approve the install in Shopify | **Per store** |
| Add the thank-you block in the checkout editor | **Per store** |
| Stages, branding, emails, fulfillment rules | **Per store** — each store owns its own |

A store records which app it belongs to, in `stores.api_key` /
`stores.api_secret`. Nothing about apps lives in environment variables any
more, so adding one never needs a redeploy.

---

## Before you start

- Shopify Partner account with access to the app you will use.
- Admin access to the store, or the merchant on hand to approve the install.
- The Shopify CLI, if you are deploying the checkout extension: `shopify --version`.

---

## 1. The Shopify app

Skip to step 2 if you are reusing an app that still has room.

In the [Partner dashboard](https://partners.shopify.com): **Apps → Create app
→ Create app manually**.

### Configuration

Every app you create gets the same three values. They are identical across apps
because each request identifies its own app from the shop domain it names.

| Field | Value |
| --- | --- |
| App URL | `<app>` |
| Allowed redirection URL | `<app>/api/shopify/callback` |
| Embedded in Shopify admin | **No** |

### Scopes

```
read_orders, write_orders, read_fulfillments, write_fulfillments
```

`write_orders` is what lets a customer change their delivery address from the
tracking page. `write_fulfillments` is what lets Tracky fulfil an order once
the agency confirms delivery.

> Orders older than 60 days need the protected scope `read_all_orders`, which
> requires Shopify approval. Tracky does not request it: it tracks orders from
> installation onwards, which is what a post-purchase tracker needs.

### App Proxy — do not skip this

This is what puts the tracking page on the merchant's own domain, inside their
theme. **Configuration → App proxy:**

| Field | Value |
| --- | --- |
| Subpath prefix | `apps` |
| Subpath | `track-order` |
| Proxy URL | `<app>/proxy/track-order` |

**No trailing slash on the proxy URL.** A trailing slash used to make the page
404 on the storefront; `skipTrailingSlashRedirect` in `next.config.ts` now
absorbs it, but type it correctly anyway.

Customers then reach `https://<merchant-domain>/apps/track-order`. Every
proxied request is signature-verified before any order data is read.

### Protected customer data

**API access → Protected customer data access.** Request it. Without it the
thank-you button cannot pre-fill the customer's email, and the tracking form
asks them to type it. Everything else still works.

### Preflight

Before adding a store, check the app answers:

```bash
npm run shopify:check -- <shop> <client-id> <client-secret>
```

---

## 2. Add the store in Tracky

`/admin/stores` → **Connect a store**.

Paste the store address — `acme-supply`, `acme-supply.myshopify.com`, an admin
URL, all work. The field shows you which store it resolved before you submit.

Then choose how the store connects.

### Partner app (the usual case)

Enter the app's **Client ID** and **Client secret**, press **Connect with
Shopify**, and approve the install. Approving needs admin rights on that store,
which is what proves the store is theirs.

Tracky writes the keys onto the store row before redirecting, because the two
requests that follow — Shopify's call to the install route, then the OAuth
callback — arrive naming only the shop domain. That row is how either one knows
which app to use.

### Custom app (created inside the store)

For an app made under *Settings → Apps and sales channels → Develop apps*.
There is no OAuth flow: enter the **API key**, **API secret key** and **Admin
API access token**, and the store connects immediately. The token is checked
against Shopify before anything is saved, so a mistyped one is refused on the
spot.

> Custom apps do not support App Proxies. Their tracking page is served at
> `<app>/track/<shop>` instead of on the merchant's domain.

### Owner account

After approving, the installer is taken to `/claim` to create or link the
store's owner account. If they were already signed in as an owner of that
store, they land straight in `/admin`.

---

## 3. The thank-you button

Shopify shows no tracking button until an order is fulfilled — and Tracky
fulfils only once a delivery is confirmed. So right after checkout there is
nothing, which is exactly when the customer wants to look. The checkout
extension fills that gap.

### Deploy it — per app

> ⚠️ `shopify app deploy` publishes **the app's configuration too**, not just
> the extension. The `shopify.app.toml` at the repo root is a *template* full
> of placeholders: deploying from it would overwrite your live App URL,
> redirect URL and App Proxy. Never deploy from it.

Pull the real configuration first, then deploy:

```bash
shopify app config link          # pick the app; writes shopify.app.<name>.toml
shopify app deploy -c <name>
```

`config link` fetches what is currently in the dashboard, so the deploy sends
that configuration back unchanged and only the extension is new.

Repeat for every app. `shopify app deploy --client-id <id>` works too, if you
prefer to script it.

### Add the block — per store

In the store: **Settings → Checkout → Customize → Thank you page → Add app
block → Track my order.**

The block does not appear on its own; someone has to place it. Its heading,
supporting line and button label are editable there, without redeploying.

---

## 4. Configure the store

A newly connected store already has its own stages, branding, email templates,
sequence and fulfillment rules — provisioned automatically, independent of
every other store. These are the ones worth reviewing before launch.

| Where | What to check |
| --- | --- |
| `/admin/stages` | The five default steps fit this operation. Which stage triggers fulfillment, and which locks address editing |
| `/admin/branding` | Colours, logo, page title and intro. **The heading names the store** — make sure you are editing the right one |
| `/admin/emails/templates` | Wording of the five default emails |
| `/admin/emails/sequence` | When each one goes out |
| `/admin/settings/fulfillment` | Whether fulfillment waits for a confirmed delivery (it does by default) |
| `/admin/settings/users` | Invite the delivery agency |

The default stages are `order-placed`, `confirmed`, `processing`,
`out-for-delivery`, `delivered`.

### Existing orders

Orders placed before the install are never sent by webhook. Pull them in with
**Sync orders** on `/admin/orders`. It reaches back 60 days — as far as Shopify
returns without `read_all_orders`.

---

## 5. Verify

One command answers most of it. It reads the store's own keys and makes the
same calls the app makes, reporting what Shopify said. Read-only.

```bash
npm run shopify:diagnose -- <shop>
```

It reports, in order: whether the token works, which scopes were actually
granted, how many orders exist per time window, where the webhooks point,
whether the App Proxy is configured, and whether the page still serves
relative assets.

Then by hand:

- [ ] `https://<merchant-domain>/apps/track-order` renders inside the theme, with the store's header and footer
- [ ] The tracking form accepts a real customer's email and opens their order
- [ ] A test order arrives in `/admin/orders` within seconds of being placed
- [ ] The order confirmation email arrives, and its **Track your order** button opens the tracking page
- [ ] The thank-you page shows the **Track my order** block after checkout

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Install ends on `/install-failed` saying it could not be verified | The secret stored for that store does not match the app it is installing from | Re-enter the keys under **Stores → Shopify app keys** |
| Install ends on `/install-failed` saying no app is configured | The shop was never added, so nothing records which app it belongs to | Add it in `/admin/stores` with its app's keys first |
| Shopify: `redirect_uri is not whitelisted` | That app's allowlist is missing the callback URL — or it is a store-admin app, which has none | Add `<app>/api/shopify/callback` to that app. A `shpss_` secret means it is a custom app: use the Custom app option instead |
| `/apps/track-order` 404s on the storefront | That app has no App Proxy configured | Add it — see step 1. Each app needs its own |
| Tracking page renders unstyled | Assets are loading relative, so the browser asks the merchant's domain for them | `APP_URL` must be set at build time; see `next.config.ts` |
| Webhooks return 401 | The stored secret differs from that app's client secret | Paste it again under **Stores → Shopify app keys**. No redeploy |
| Orders arrive but the page shows none | The store has no stages | `/admin/stages` → **Restore the default stages** |
| "Sync orders" finds nothing, but the store has orders | They are older than 60 days | Shopify does not return those without `read_all_orders` |
| Branding changes appear to do nothing | You are editing a different store | The branding page names the store it is editing, and links to its live page |
| `shopify app deploy` fails bundling the extension | Extension dependencies not installed | `cd extensions/track-order && npm install` — it pins its own React 18 |

---

## Reference

| Thing | Value |
| --- | --- |
| Callback URL | `<app>/api/shopify/callback` |
| App Proxy URL | `<app>/proxy/track-order` |
| Storefront path | `https://<merchant-domain>/apps/track-order` |
| Hosted fallback page | `<app>/track/<shop>` |
| Webhook endpoint | `<app>/api/shopify/webhooks` |
| Topics registered | `orders/create`, `orders/updated`, `orders/cancelled`, `fulfillments/create`, `app/uninstalled` |
| Scopes | `read_orders,write_orders,read_fulfillments,write_fulfillments` |

| Command | What it does |
| --- | --- |
| `npm run shopify:check -- <shop> <id> <secret>` | Preflights an app before you add a store to it |
| `npm run shopify:diagnose -- <shop>` | Asks Shopify why a connected store is misbehaving |
| `npm run db:check` | Confirms the database matches the code |
| `npm run db:migrate` | Applies pending migrations |
| `shopify app deploy -c <name>` | Deploys the checkout extension to one app |
