# Deployment guide

How to take Tracky from this repository to a production deployment serving real
Shopify stores.

Read it once end to end before starting: a few decisions (the app URL, the
encryption key) are awkward to change later.

- [1. What you are deploying](#1-what-you-are-deploying)
- [2. Before you start](#2-before-you-start)
- [3. Database — Neon](#3-database--neon)
- [4. Secrets](#4-secrets)
- [5. Email — Resend](#5-email--resend)
- [6. Scheduling — Upstash QStash](#6-scheduling--upstash-qstash)
- [7. File storage — Vercel Blob](#7-file-storage--vercel-blob)
- [8. Deploy to Vercel](#8-deploy-to-vercel)
- [9. Environment variables](#9-environment-variables)
- [10. Run the migrations](#10-run-the-migrations)
- [11. Create the Shopify app](#11-create-the-shopify-app)
- [12. Install on a store](#12-install-on-a-store)
- [13. Verify the deployment](#13-verify-the-deployment)
- [14. Day-two operations](#14-day-two-operations)
- [15. Troubleshooting](#15-troubleshooting)
- [16. Rolling back](#16-rolling-back)
- [Appendix A — Deploying somewhere other than Vercel](#appendix-a--deploying-somewhere-other-than-vercel)
- [Appendix B — Deployment checklist](#appendix-b--deployment-checklist)

---

## 1. What you are deploying

```
                     ┌──────────────────────────────┐
   Shopify  ────────▶│ /api/shopify/webhooks        │──▶ Neon (Postgres)
   webhooks          │  HMAC + event-id dedupe      │
                     ├──────────────────────────────┤
   Merchant ────────▶│ /api/shopify/install         │
   installs          │ /api/shopify/callback        │──▶ registers webhooks,
                     │  OAuth, encrypted token      │    provisions defaults
                     ├──────────────────────────────┤
   Customer ────────▶│ /proxy/track-order           │──▶ branded timeline
   via <shop>/apps/  │  App Proxy signature check   │
   track-order       ├──────────────────────────────┤
                     │ /admin  (owner)              │
   Staff    ────────▶│ /agency (dispatch, mobile)   │
                     ├──────────────────────────────┤
   QStash   ────────▶│ /api/jobs/send-email         │──▶ Resend
   Vercel Cron ─────▶│ /api/cron/sweep-emails       │
                     └──────────────────────────────┘
```

Five managed services, none optional in production:

| Service          | Used for                                          |
| ---------------- | ------------------------------------------------- |
| **Vercel**       | Hosting, cron                                     |
| **Neon**         | Postgres                                          |
| **Resend**       | Transactional email                               |
| **Upstash QStash** | Delayed email scheduling                        |
| **Vercel Blob**  | Store logos, photos of signed delivery notes      |

Plus a **Shopify Partner account** for the app itself.

---

## 2. Before you start

### Accounts

Create these first; several steps below need credentials from them.

- [Vercel](https://vercel.com) — Pro recommended, see the cron note in step 8
- [Neon](https://neon.tech)
- [Resend](https://resend.com)
- [Upstash](https://upstash.com) (QStash)
- [Shopify Partners](https://partners.shopify.com)

### Decide your app URL now

Everything hangs off one origin — OAuth redirect, webhook callbacks, the App
Proxy target, QStash callbacks. Changing it later means editing the Shopify app
config **and** re-registering webhooks on every installed store.

Use a stable custom domain (`https://tracky.yourcompany.com`), not the
auto-generated `*.vercel.app` preview URL.

### Decide your sending domain

v1 sends all email from one shared platform domain (`RESEND_FROM_EMAIL`), not
per-merchant domains. Pick something neutral you control, e.g.
`notifications@tracky-mail.com`. The merchant's brand carries through the
`From` display name and the email body, not the domain.

### Tooling

```bash
node --version     # 20.9 or newer; 22 or 24 recommended
npm --version
npx vercel --version
```

---

## 3. Database — Neon

1. Create a project. Pick the region **closest to your Vercel functions**
   (see step 8) — every page render makes several round trips.
2. From the dashboard, copy **two** connection strings:

   | Which                       | Looks like                              | Used by                        |
   | --------------------------- | --------------------------------------- | ------------------------------ |
   | Pooled                      | `...-pooler.region.aws.neon.tech/...`   | the app (`DATABASE_URL`)       |
   | Direct / unpooled           | `...region.aws.neon.tech/...`           | migrations only                |

   Both must end in `?sslmode=require`.

3. Keep the direct string for step 10. Migrations run DDL and take advisory
   locks, which a transaction-mode pooler can break; the app itself only ever
   issues normal queries and is happy on the pooled endpoint.

> **Preview deployments.** If you enable Vercel preview builds, create a
> separate Neon **branch** and point the Preview environment at it. Previews
> sharing the production database is the fastest way to corrupt real orders.

---

## 4. Secrets

Generate two independent 32-byte secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY
```

On Windows without OpenSSL:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**`ENCRYPTION_KEY` must decode to exactly 32 bytes.** It encrypts Shopify
access tokens at rest with AES-256-GCM. A wrong-length key does not fail at
boot — it throws `ENCRYPTION_KEY must be 32 bytes encoded as base64` the first
time a token is read or written, i.e. during the next store installation. Get
it right before you install anything.

> **This key is not rotatable in place.** Existing tokens are encrypted with
> it; change it and every connected store's token becomes undecryptable, and
> each merchant has to reinstall the app. Store it in a password manager
> alongside the Vercel project. Rotating `AUTH_SECRET` is far cheaper — it only
> signs out every user.

---

## 5. Email — Resend

1. **Add and verify your sending domain** (Domains → Add Domain). Resend gives
   you DKIM, SPF and return-path DNS records. Add all of them; verification
   usually completes within an hour.
2. Create an API key with **Sending access** → `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL` to an address on that verified domain, and
   `RESEND_FROM_NAME` to your platform name.

The app sends as `"<store name>" <RESEND_FROM_EMAIL>`, so a customer sees the
merchant's name in their inbox while the domain stays yours.

> Until the domain is verified, sends fail and are recorded in `email_sends`
> with `status = failed` and the provider's message. The app never crashes on
> a failed send.

---

## 6. Scheduling — Upstash QStash

QStash delivers each delayed email at its exact due time by calling back into
`/api/jobs/send-email`.

1. Create a QStash instance.
2. Copy three values from the console:
   - `QSTASH_TOKEN` — used to publish messages
   - `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` — used by the
     callback route to verify that a request really came from QStash

All three are required. Without the signing keys the callback route returns
`503` and refuses to send anything, by design — an unauthenticated endpoint
that sends mail on demand is not something to leave open.

---

## 7. File storage — Vercel Blob

1. In the Vercel dashboard: **Storage → Create → Blob**.
2. Connect the store to your project. Vercel injects `BLOB_READ_WRITE_TOKEN`
   automatically; if you are deploying with the CLI, copy it manually.

Used for two things: store logos, and photos of the signed paper delivery
notes. Blob URLs are public but unguessable, and the app only ever links to
delivery-note photos from the authenticated backoffice — never from the
customer tracking page.

---

## 8. Deploy to Vercel

The repository is not a git repository yet. Either path works.

### Option A — Git integration (recommended)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<you>/tracky.git
git push -u origin main
```

Then in Vercel: **Add New → Project → Import** the repository. Framework
preset is detected as Next.js; leave the build settings alone.

### Option B — CLI, no git

```bash
npx vercel link
npx vercel --prod
```

### Project settings

| Setting            | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| Framework          | Next.js (auto-detected)                                    |
| Build command      | default (`next build`)                                     |
| Node.js version    | 22.x or 24.x                                               |
| Function region    | the same region as your Neon project                       |
| Custom domain      | the origin you chose in step 2                             |

### Scheduling: Vercel does what it can, QStash does the rest

**Vercel's Hobby plan runs a cron job at most once per day.** A `vercel.json`
asking for anything more is rejected at deploy time:

> Hobby accounts are limited to daily cron jobs. This cron expression
> (`*/15 * * * *`) would run more than once per day.

So the recurring work is split, and Hobby is enough for all of it:

| | Schedule | Set up by | Authenticated by |
| --- | --- | --- | --- |
| **Vercel Cron** | `0 3 * * *` — once a day, the plan maximum | `vercel.json`, nothing to run | `Authorization: Bearer $CRON_SECRET`, which Vercel sends automatically |
| **QStash schedule** | `*/15 * * * *` — the real safety net | `npm run qstash:setup` | its Upstash signature (and the same bearer token) |

Both call `POST`/`GET /api/cron/sweep-emails`. The sweep skips any row that is
no longer `scheduled`, so the two firing at the same minute is harmless.

Register the QStash half once, after your first deploy:

```bash
npm run qstash:setup     # create or update the schedule
npm run qstash:list      # show what QStash currently has
npm run qstash:remove    # delete it
```

It reads `QSTASH_TOKEN`, `CRON_SECRET` and `APP_URL` from your local `.env`, so
point `APP_URL` at the **deployed** origin — QStash calls in over the internet
and cannot reach `localhost`. The script refuses rather than registering a
schedule that can never fire. It is safe to re-run: the schedule has a fixed
id, so a second run updates it instead of adding a duplicate.

Confirm it afterwards in **Platform → System health → The sweep**, which reads
the live schedule back from QStash.

Set `QSTASH_SWEEP_CRON` to override `*/15 * * * *` and re-run `qstash:setup`.

**If you upgrade to Vercel Pro**, change `vercel.json` to `*/15 * * * *` and
run `npm run qstash:remove`. Nothing else changes — the endpoint is the same.
`tests/scheduling.test.ts` pins the Hobby-safe expression, so loosen that test
in the same commit.

Note that none of this affects *when customers get their email*. Each send is
handed to QStash at the moment it is scheduled; the sweep only exists to catch
sends QStash never delivered.

The route declares `maxDuration = 60` and processes at most 50 due emails per
run, which fits inside every plan's limit.

---

## 9. Environment variables

Set these in **Vercel → Settings → Environment Variables**, scoped to
**Production** (and to Preview, pointing at a separate Neon branch, if you use
previews).

### Required

| Variable | Value | Notes |
| --- | --- | --- |
| `APP_URL` | `https://tracky.yourcompany.com` | No trailing slash. Must match the Shopify app config exactly. |
| `DATABASE_URL` | Neon **pooled** string | Must include `?sslmode=require`. |
| `AUTH_SECRET` | 32-byte base64 | From step 4. |
| `AUTH_TRUST_HOST` | `true` | Required behind Vercel's proxy. |
| `ENCRYPTION_KEY` | 32-byte base64 | From step 4. Not rotatable — see the warning there. |
| `SHOPIFY_API_KEY` | Shopify app client ID | From step 11. |
| `SHOPIFY_API_SECRET` | Shopify app client secret | Signs webhooks, OAuth and App Proxy. |
| `RESEND_API_KEY` | `re_…` | |
| `RESEND_FROM_EMAIL` | `notifications@your-domain` | Must be on a verified domain. |
| `QSTASH_TOKEN` | Upstash publish token | Also used by `npm run qstash:setup`. |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash signing key | |
| `QSTASH_NEXT_SIGNING_KEY` | Upstash next signing key | |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_…` | Injected automatically if you connected the store to the project. |
| `CRON_SECRET` | any long random string | Vercel sends it to cron routes as `Authorization: Bearer …`; the QStash schedule sends it too. |

### Optional

| Variable | Default | Notes |
| --- | --- | --- |
| `PLATFORM_NAME` | `Tracky` | Fallback display name. |
| `RESEND_FROM_NAME` | `Tracky` | Fallback `From` name. |
| `SHOPIFY_SCOPES` | `read_orders,write_orders,read_fulfillments,write_fulfillments` | Keep in sync with the Partner dashboard. |
| `SHOPIFY_API_VERSION` | `2025-07` | See the note in step 14 before changing. |
| `QSTASH_SWEEP_CRON` | `*/15 * * * *` | How often the QStash sweep runs. Re-run `npm run qstash:setup` after changing it. |

### Must NOT be set in production

| Variable | Why |
| --- | --- |
| `NEON_HTTP_ENDPOINT` | Routes the database driver at the local Docker proxy. Setting it in production breaks every query. |
| `ALLOW_UNSIGNED_APP_PROXY` | Disables the App Proxy signature check. It is ignored when `NODE_ENV=production`, but do not set it — anyone reading the config should be able to see the control is on. |

---

## 10. Run the migrations

Migrations connect over the Postgres wire protocol with `pg`, so run them from
your machine (or CI) against the **direct** Neon endpoint.

```bash
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" \
  npm run db:migrate
```

Expected output:

```
Using 'pg' driver for database querying
[✓] migrations applied successfully!
```

Verify:

```bash
psql "$DATABASE_URL" -c "\dt"
```

You should see 13 tables: `branding_settings`, `email_sends`,
`email_sequence_steps`, `email_templates`, `fulfillment_rules`,
`order_stage_history`, `orders`, `proof_of_delivery`, `stages`,
`store_memberships`, `stores`, `users`, `webhook_events`.

### Check the database matches the code

```bash
npm run db:check
```

It prints which database it is looking at (never the password), compares the
migrations on disk with the ones that database has applied, and exits non-zero
when they disagree:

```
Migrations on disk:     2
Applied in database:    1

✗ 1 migration(s) have not been applied:
    0001_sync_source_and_platform_admin
```

Worth running after every migrate and as a post-deploy smoke check. The
failure it catches is nasty precisely because it is quiet: code that expects a
column the database does not have does not fail at boot, it fails on the first
request that touches it — as a 500 on a page, reading
`column "…" does not exist`, which looks like an application bug rather than a
missing migration.

> Migrations are **not** run automatically on deploy. That is deliberate:
> a schema change should be a decision, not a side effect of a redeploy. If you
> want it automated, add `npm run db:migrate &&` to the Vercel build command
> and set `DATABASE_URL` (direct endpoint) as a build-time variable — but be
> aware that concurrent builds will then race on the same database.

---

## 11. Create the Shopify app

In the [Partner dashboard](https://partners.shopify.com): **Apps → Create app
→ Create app manually**.

> **It has to be a Partner dashboard app.** Shopify also lets you create an app
> from inside a single store, under *Settings → Apps and sales channels →
> Develop apps*. That kind is installed by pressing **Install**, is used with an
> Admin API access token (`shpat_…`), and **has no "Allowed redirection URL(s)"
> field at all** — so the OAuth flow this app uses can never succeed with it.
> Every attempt ends at Shopify with:
>
> ```
> Oauth error invalid_request: The redirect_uri is not whitelisted
> ```
>
> The tell is the secret: a store-admin app issues one beginning `shpss_`.
> `npm run shopify:check` flags it.

### Distribution

- **Custom distribution** if you are serving a known set of stores (the usual
  case here). Pick this and you can install immediately, no app review.
- **Public distribution** if you intend to list on the Shopify App Store. That
  requires review; everything below is identical either way.

### Configuration

| Field | Value |
| --- | --- |
| App URL | `https://tracky.yourcompany.com` |
| Allowed redirection URL | `https://tracky.yourcompany.com/api/shopify/callback` |
| Embedded in Shopify admin | **No** |

Copy the **Client ID** into `SHOPIFY_API_KEY` and the **Client secret** into
`SHOPIFY_API_SECRET`, then redeploy so the new values take effect.

The redirection URL is matched **character for character**, including the
scheme, the port and the absence of a trailing slash. Run
`npm run shopify:check` to print the exact string this deployment will send,
and paste that — do not retype it.

### Developing against a local server

`APP_URL=http://localhost:3000` is enough for OAuth, because it is your own
browser that follows the redirect. Add
`http://localhost:3000/api/shopify/callback` to the same allowlist and the
install will complete.

It is **not** enough for anything Shopify has to reach on its own: webhooks are
never delivered and the App Proxy page will not load on the storefront. For
those, put a tunnel in front:

```bash
cloudflared tunnel --url http://localhost:3000
```

Then set `APP_URL` to the tunnel origin, restart the dev server, and add that
origin's `/api/shopify/callback` to the allowlist as well. The allowlist holds
several URLs, so the localhost and tunnel entries can both stay.

### Scopes

```
read_orders, write_orders, read_fulfillments, write_fulfillments
```

`write_orders` is what lets a customer change their delivery address from the
tracking page. `write_fulfillments` is what lets the app fulfil an order once
the agency confirms delivery.

> Orders older than 60 days need the protected scope `read_all_orders`, which
> requires Shopify approval. The app does not request it: it tracks orders from
> installation onwards, which is what a post-purchase tracker needs.

### App Proxy

This is what puts the tracking page on the merchant's own domain. **Apps →
your app → Configuration → App proxy**:

| Field | Value |
| --- | --- |
| Subpath prefix | `apps` |
| Subpath | `track-order` |
| Proxy URL | `https://tracky.yourcompany.com/proxy/track-order` |

Customers then reach `https://<merchant-domain>/apps/track-order`. Shopify
signs every forwarded request; `lib/shopify/app-proxy.ts` verifies that
signature before reading a single order field.

### Or use the checked-in config

`shopify.app.toml` at the repo root already contains all of the above. Replace
`APP_URL` and `client_id`, then:

```bash
npm install -g @shopify/cli
shopify app deploy
```

### Webhooks

Do **not** register webhooks by hand. The app registers all five
(`orders/create`, `orders/updated`, `orders/cancelled`, `fulfillments/create`,
`app/uninstalled`) during OAuth, pointing at
`https://<APP_URL>/api/shopify/webhooks`, and it is idempotent — reinstalling
never produces duplicate subscriptions.

---

## 12. Install on a store

1. Open:

   ```
   https://tracky.yourcompany.com/api/shopify/install?shop=<store>.myshopify.com
   ```

2. Approve the scopes in Shopify. The callback then, in order:
   - verifies the OAuth HMAC and the state nonce;
   - exchanges the code and stores the **encrypted** access token;
   - provisions that store's own stages, branding, email templates, sequence
     and fulfillment rules;
   - registers the webhooks;
   - issues a signed, 30-minute claim cookie and redirects to `/claim`.

3. On `/claim`, create the owner account (email + password). Completing the
   OAuth flow requires Shopify admin rights on that shop, which is what
   authorises the claim.

4. You land on `/admin`. Hand `docs/admin-guide.md` to whoever will run the
   store day to day.

Repeat for each additional store — no redeploy, no configuration change. Each
store gets its own independent stages, branding, templates and rules.

---

## 13. Verify the deployment

Run these against production before you tell anyone it is live.

### Reachability and auth

```bash
APP=https://tracky.yourcompany.com

curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" $APP/            # 307 -> /login
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" $APP/admin       # 307 -> /login?next=/admin
curl -s -o /dev/null -w "%{http_code}\n"                    $APP/login       # 200
```

### The webhook endpoint rejects forgeries

An unsigned request must be refused **without writing anything**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST $APP/api/shopify/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Event-Id: probe-1" \
  -H "X-Shopify-Shop-Domain: <store>.myshopify.com" \
  -d '{"id":1}'
# expect 401
```

Then confirm nothing was recorded:

```sql
select count(*) from webhook_events where shopify_event_id = 'probe-1';  -- 0
```

### The cron sweep rejects unauthenticated callers

```bash
curl -s -o /dev/null -w "%{http_code}\n" $APP/api/cron/sweep-emails                        # 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST $APP/api/cron/sweep-emails                # 401
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $CRON_SECRET" \
  $APP/api/cron/sweep-emails                                                                # 200
```

The unsigned `POST` is refused too: that is the door the QStash schedule comes
through, and only a valid Upstash signature or the bearer token opens it.

### The tracking page refuses direct hits

```bash
curl -s "$APP/proxy/track-order?shop=<store>.myshopify.com" | grep -c "Order tracking unavailable"
# expect 1 — no valid App Proxy signature
```

### End to end, with a real order

1. Place a test order in the Shopify store.
2. It appears in `/admin/orders` within a few seconds, in the first stage.
3. Open `/admin/orders/<id>` → **Event history** shows one event,
   source **Shopify**, timestamped with the real order date.
4. **Email log** shows the order-confirmation send as `sent`. Check the inbox.
5. Visit `https://<merchant-domain>/apps/track-order`, look the order up by
   number + email, and confirm the timeline and branding render.
6. Sign in as an agency user, open the order, **Mark as delivered**.
7. Back in `/admin/orders/<id>`: proof of delivery recorded, fulfillment status
   **Fulfilled**, and the order shows as fulfilled in the Shopify admin.

That last step exercises the whole promise of the product: no fulfillment
without a real, attributed delivery confirmation.

---

## 14. Day-two operations

### Changing the schema

```bash
# 1. Edit lib/db/schema.ts
npm run db:generate                 # writes drizzle/NNNN_name.sql
# 2. Read the generated SQL. Always.
DATABASE_URL="<direct neon url>" npm run db:migrate
# 3. Deploy the code that depends on it
```

Migrate before deploying for additive changes, after for removals. Never edit
a migration that has already been applied.

### Adding a store

Nothing to deploy. Send the merchant to
`/api/shopify/install?shop=<store>.myshopify.com` and follow step 12.

### Rotating secrets

| Secret | Effect of rotating | Procedure |
| --- | --- | --- |
| `AUTH_SECRET` | Everyone is signed out | Change it, redeploy |
| `CRON_SECRET` | None | Change it, redeploy |
| `RESEND_API_KEY` | None | Change it, redeploy |
| `QSTASH_*` | In-flight messages may fail their signature check | Rotate the signing keys in Upstash first; keep both current and next set |
| `SHOPIFY_API_SECRET` | **Breaks every webhook, OAuth flow and App Proxy request** | Rotate in the Partner dashboard, update the variable, redeploy immediately |
| `ENCRYPTION_KEY` | **Every stored Shopify token becomes undecryptable** | Avoid. If unavoidable, every merchant must reinstall |

### Changing `APP_URL`

1. Update the App URL, redirect URL and App Proxy URL in the Partner dashboard.
2. Update `APP_URL` in Vercel and redeploy.
3. **Re-register webhooks on every installed store** — they still point at the
   old origin. The simplest route is for each merchant to reinstall the app;
   registration is idempotent, so nothing is duplicated.

### Bumping the Shopify API version

Set `SHOPIFY_API_VERSION` and redeploy. Before you do, check whether
`fulfillmentCreateV2` still exists in the target version — it has been renamed
to `fulfillmentCreate` with an identical input. If it is gone, change
`FULFILLMENT_MUTATION_NAME` in `lib/fulfillment/index.ts` and the
`FulfillmentV2Input` type name in the mutation next to it.

### What to keep an eye on

| Signal | Where | Means |
| --- | --- | --- |
| `webhook_events` rows with a non-null `error` | database | A webhook was received but could not be processed |
| `orders` with `fulfillment_status = 'failed'` | `/admin/orders`, filter Fulfillment | Shopify rejected a fulfillment |
| `email_sends` with `status = 'failed'` | `/admin/orders/<id>` email log | Provider or template problem |
| `email_sends` stuck at `scheduled` past their time | database | QStash is not delivering; the cron sweep should catch them |
| Function errors on `/api/shopify/webhooks` | Vercel logs | Shopify will retry for 48 hours, then drop the event |

Useful query:

```sql
select topic, count(*) filter (where error is not null) as failed, count(*) as total
from webhook_events
where received_at > now() - interval '24 hours'
group by topic;
```

---

## 15. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Shopify shows `Oauth error invalid_request: The redirect_uri is not whitelisted` | The app's allowlist does not contain the URL this deployment sends — or the app is a store-admin "Develop apps" one, which has no allowlist at all | Run `npm run shopify:check`, paste the printed redirection URL into the Partner dashboard. A `shpss_` secret means the wrong kind of app; see step 11 |
| Install redirects to `/install-failed` | OAuth HMAC or state mismatch | The message on the page names the cause. HMAC failures mean `SHOPIFY_API_SECRET` does not match the app |
| Webhooks return 401 | `SHOPIFY_API_SECRET` differs from the app's client secret | Copy it again; redeploy |
| Webhooks return 200 but no orders appear | The store has no stages | `/admin/stages` → **Restore the default stages** |
| Tracking page shows "Order tracking unavailable" | App Proxy URL wrong, or the request did not come through the storefront | Check the App Proxy config; the URL is `/proxy/track-order`, not `/api/proxy/...` |
| Tracking page 404s on the storefront | Prefix/subpath mismatch | They must be `apps` and `track-order` |
| "Missing environment variable ENCRYPTION_KEY" | Not set, or scoped to the wrong environment | Vercel scopes variables per environment; check Production is ticked |
| "ENCRYPTION_KEY must be 32 bytes" | Key is not 32 bytes of base64 | Regenerate with `openssl rand -base64 32` |
| Every email `failed` with a provider message | Resend domain not verified, or `RESEND_FROM_EMAIL` is not on it | Finish DNS verification |
| Delayed emails never arrive | QStash cannot reach `APP_URL`, or the signing keys are wrong | Check the QStash logs; the cron sweep is the backstop |
| Orders never fulfil | No proof of delivery yet, no stage marked *Triggers fulfillment*, or fulfillment disabled | The **Retry fulfillment** button on the order states the exact reason |
| Sessions drop on every request | `AUTH_TRUST_HOST` not set | Set it to `true` |
| Database connection errors under load | Using the direct endpoint for the app | `DATABASE_URL` must be the **pooled** string |

---

## 16. Rolling back

**Code.** Vercel → Deployments → the last good one → **Promote to Production**.
Instant, no rebuild.

**Schema.** Drizzle does not generate down-migrations. Roll a schema change
back by writing a new forward migration that reverses it. For anything
destructive, take a Neon branch as a snapshot before migrating:

```bash
# Neon dashboard → Branches → Create branch from production
```

Neon's point-in-time restore covers the window your plan retains.

**A store in a bad state.** Uninstalling the app from Shopify sends
`app/uninstalled`, which marks the store uninstalled and destroys its access
token. Its data is retained; reinstalling reconnects it without losing orders
or configuration.

---

## Appendix A — Deploying somewhere other than Vercel

The stack assumes Vercel, but nothing is unportable. If you self-host:

| Vercel feature | What you need instead |
| --- | --- |
| `vercel.json` crons | Nothing — the QStash schedule already carries the frequent sweep, and it does not care where the app is hosted. Drop the file, or keep any scheduler hitting `/api/cron/sweep-emails` with `Authorization: Bearer $CRON_SECRET` |
| Vercel Blob | An S3-compatible bucket; rewrite `app/api/blob/upload/route.ts` and the two `upload()` call sites in `components/agency/mark-delivered-form.tsx` and `app/admin/branding/branding-editor.tsx` |
| `after()` | Works in any Node deployment of Next 16 |
| Neon | Any Postgres — but `@neondatabase/serverless` speaks Neon's HTTP protocol, so either put a Neon HTTP proxy in front of it (see `docker-compose.yml`) or switch `lib/db/index.ts` to `drizzle-orm/node-postgres`, which is a five-line change |

The `docker-compose.yml` in this repo is a **development** stack, not a
production one: it runs `next dev`, mounts the source read-write and ships
throwaway secrets in `.env.docker`. A production image would need a
multi-stage build using `next build` with `output: "standalone"`.

---

## Appendix B — Deployment checklist

```
[ ] Custom domain chosen and DNS pointed at Vercel
[ ] Neon project created in the same region as the Vercel functions
[ ] Pooled and direct connection strings recorded
[ ] AUTH_SECRET and ENCRYPTION_KEY generated and stored in a password manager
[ ] Resend domain verified (DKIM + SPF + return-path)
[ ] QStash token and both signing keys recorded
[ ] Blob store connected to the Vercel project
[ ] All required environment variables set on Production
[ ] NEON_HTTP_ENDPOINT and ALLOW_UNSIGNED_APP_PROXY confirmed NOT set
[ ] npm run qstash:setup run against the deployed APP_URL
[ ] Platform → System health → The sweep shows the QStash schedule active
[ ] Migrations applied; 13 tables present
[ ] npm run db:check reports the database in step with the code
[ ] Shopify app created; client id and secret in Vercel; redeployed
[ ] Scopes, redirect URL and App Proxy configured
[ ] App installed on the first store; owner account claimed
[ ] Verification in section 13 passed, including the end-to-end order
[ ] docs/admin-guide.md handed to the store owner
```
