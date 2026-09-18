# Tracky

Multi-store post-purchase order tracking and last-mile delivery management for
Shopify, built for a merchant running their own drivers and delivery agency.

The whole application is in English. This README and `docs/admin-guide.md`
document how to install and operate it.

---

## The one rule everything else follows

**An order only ever moves forward on a real event.**

A stage transition can come from exactly two places:

| Source            | Written as         | Where it comes from                                   |
| ----------------- | ------------------ | ----------------------------------------------------- |
| Shopify webhook   | `shopify_webhook`  | `orders/create` places the order in the first stage    |
| Manual sync       | `shopify_sync`     | An owner pressed **Sync orders**; the order was pulled from the Admin API |
| Delivery agency   | `agency`           | A signed-in agency user updates the status             |
| Store owner       | `admin`            | A signed-in owner applies a manual override            |

There is no timer, cron or scheduler anywhere that advances an order, and no
tracking event is ever generated to fill a gap. Day-based delays exist only to
schedule **email**.

Fulfillment follows the same discipline: Shopify is only told an order is
fulfilled once the agency has declared the delivery — after the customer signed
a **paper** delivery note in person. There is no digital signature capture in
this app.

These rules are enforced in code (`lib/orders/transitions.ts`,
`lib/fulfillment/index.ts`) and pinned by tests in
`tests/event-driven-guardrails.test.ts`.

---

## Stack

| Concern        | Choice                                              |
| -------------- | --------------------------------------------------- |
| Framework      | Next.js 16 (App Router, TypeScript)                  |
| Hosting        | Vercel                                               |
| Database       | Neon (serverless Postgres)                           |
| ORM            | Drizzle ORM, Neon HTTP driver                        |
| Scheduling     | Upstash QStash (delayed sends + the 15-minute sweep), with a daily Vercel Cron backstop |
| Email          | Resend + React Email, shared platform sending domain |
| File storage   | Vercel Blob (logos, photos of signed delivery notes) |
| Auth           | Auth.js (NextAuth) v5, credentials + JWT sessions    |
| UI             | Tailwind CSS v4, mobile-first                        |

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill it in — every variable is documented
npm run db:migrate             # apply drizzle/0000_init.sql to your Neon database
npm run dev
```

Generate the two secrets with:

```bash
openssl rand -base64 32        # AUTH_SECRET
openssl rand -base64 32        # ENCRYPTION_KEY (must decode to exactly 32 bytes)
```

### Running the whole stack in Docker

If you would rather not install Postgres locally:

```bash
npm run docker:up        # Postgres + Neon HTTP proxy + the dev server
npm run docker:migrate   # apply drizzle/*.sql
npm run docker:seed      # demo store, owner + agency accounts, one order
```

The app is then on <http://localhost:3000>, Postgres on `localhost:5432`
(`tracky`/`tracky`/`tracky`), and the Neon HTTP proxy on `localhost:4444`.
Source is bind-mounted, while `node_modules` and `.next` stay inside the
container — the Linux-native binaries (Next's SWC, Tailwind's oxide, esbuild)
never clash with a Windows or macOS host.

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run docker:up`    | Build and start everything          |
| `npm run docker:logs`  | Follow the dev server output        |
| `npm run docker:psql`  | Open a psql shell on the database   |
| `npm run docker:down`  | Stop the stack, keep the data       |
| `npm run docker:restart` | Pick up source edits (see below)   |
| `npm run docker:reset` | Stop and delete the database volume |

**Edits need a restart.** Filesystem events do not cross a Docker Desktop
bind mount on Windows or macOS, and Turbopack has no polling fallback, so the
dev server in the container will happily serve the previous build after you
save a file. Run `npm run docker:restart` (about 20s). Webpack does poll, but
Next 16 cannot compile this app's edge middleware under webpack — it rejects
the `node:crypto` import — so Turbopack it is. Running `npm run dev` directly
on the host hot-reloads normally.

**Why a proxy and not just Postgres?** The app reaches the database through
`@neondatabase/serverless`, which speaks Neon's HTTP API rather than the
Postgres wire protocol, so it cannot connect to `postgres:5432` directly. The
`local-neon-http-proxy` container translates between the two, so the same
driver — and therefore the exact same application code — runs locally and on
Neon. `NEON_HTTP_ENDPOINT` in `.env.docker` switches it on; it is unset in
production. Migrations are the one exception: `drizzle-kit` connects over the
wire protocol with `pg`, straight to `localhost:5432` or to Neon.

**What is not emulated.** Resend, QStash and Vercel Blob have no local
stand-in. The app degrades instead of crashing: emails are recorded in
`email_sends` with `status = failed` and the reason, delayed sends stay
`scheduled` for the cron sweep, and uploads are refused. Paste real keys into
`.env.docker` to exercise those paths. Shopify OAuth and webhooks need a public
tunnel (`cloudflared`, `ngrok`) pointed at port 3000, with `APP_URL` updated to
match.

### A demo store for local work

```bash
npm run seed -- --with-order
```

Creates `tracky-demo.myshopify.com` with its own stages, branding, templates and
sequence, plus two accounts:

| Role   | Email                 | Password      |
| ------ | --------------------- | ------------- |
| Owner  | `owner@tracky.com`   | `TrackyDemo1` |
| Agency | `agency@tracky.com`  | `TrackyDemo1` |

The seed refuses to run when `NODE_ENV=production`.

---

## The public site

`/`, `/about`, `/faq` and `/contact` are a small marketing site, served from
the same deployment. They are the **only** indexable pages: the root layout
marks everything `noindex`, and `app/(marketing)/layout.tsx` turns it back on
just for these four — the backoffice, dispatch and the customer tracking pages
all stay out of search results.

A signed-in visitor is not redirected away from them (they may have come to
read the FAQ); the header's call to action becomes **Open dashboard** instead,
pointing at `/admin` or `/agency` depending on the account.

The contact form delivers through Resend to `CONTACT_EMAIL`. With either
missing it says so on the page and refuses to pretend a message was sent.
Because it is the one endpoint an anonymous visitor can use to make the server
send mail, it uses a fixed `from` with the visitor's address as `reply-to`, a
honeypot field, a minimum fill time and hard length limits. It is **not** rate
limited — that needs shared state the public path does not have, so put a WAF
or Vercel's firewall in front of it if it starts attracting attention.

---

## Connecting a Shopify store

1. **Create a public app** in the Shopify Partner dashboard (or use
   `shopify.app.toml` in this repo as the source of truth and run
   `shopify app deploy`). Replace `APP_URL` in that file with your deployment
   origin.

2. **Scopes**: `read_orders`, `write_orders`, `read_fulfillments`,
   `write_fulfillments`.

3. **Redirect URL**: `https://<your-app>/api/shopify/callback`

4. **App Proxy** — this is what puts the tracking page on the merchant's own
   domain:

   | Field   | Value                                     |
   | ------- | ----------------------------------------- |
   | Prefix  | `apps`                                    |
   | Subpath | `track-order`                             |
   | URL     | `https://<your-app>/proxy/track-order`    |

   Customers then reach `https://<merchant-domain>/apps/track-order` and never
   leave the store's domain. Every proxied request is signature-verified before
   any order data is read.

5. **Install**: add the store in `/admin/stores` with that app's Client ID and
   secret, which sends you to Shopify to approve it. The callback verifies the
   HMAC and the state nonce, stores an **encrypted** access token, provisions
   that store's own defaults, and registers the webhooks. The installer is then
   asked to create the store's owner account.

   > **One deployment, many Shopify apps.** Credentials live on each store row,
   > not in the environment: `stores.api_key` and `stores.api_secret` (the
   > secret encrypted at rest), and every signature from a store is verified
   > with its own app's secret. A Shopify app is capped in how widely it can be
   > installed, so distributing to many stores means distributing across apps —
   > create as many as you like and pick one per store. The App URL, redirect
   > URL and App Proxy URL above are identical for every app, because each
   > request identifies its app from the shop domain it names. A store created
   > in its own Shopify admin under *Develop apps* is added the other way: paste
   > its Admin API access token and no OAuth happens at all.

Webhooks are registered automatically at install time:
`orders/create`, `orders/updated`, `orders/cancelled`, `fulfillments/create`,
`app/uninstalled` — all delivered to `/api/shopify/webhooks`.

---

## Deploying to Vercel

1. Import the repository and set every variable from `.env.example` in the
   Vercel project settings. Set `APP_URL` to the production origin.
2. `vercel.json` declares the fallback sweep (`/api/cron/sweep-emails`) once a
   day, which is all Vercel's Hobby plan allows. Set `CRON_SECRET` so the
   endpoint refuses unauthenticated calls.
3. Add the QStash signing keys so `/api/jobs/send-email` can verify callbacks.
4. Run `npm run qstash:setup` with `APP_URL` pointing at the deployment. That
   registers the **every 15 minutes** sweep with QStash — the part Hobby cannot
   run. Check it afterwards under Platform → System health → The sweep.
5. Run the migration against the production database:
   `DATABASE_URL=... npm run db:migrate`.

### The two customer tracking surfaces

| Route | Reached via | Authenticated by |
| --- | --- | --- |
| `/proxy/track-order` | `https://<merchant-domain>/apps/track-order` | Shopify App Proxy signature |
| `/track/<shop>.myshopify.com` | Tracky's own domain | The order's tracking token, or order number **+** email |

The App Proxy route is the canonical one and is what emails link to: the
customer never leaves the merchant's domain. The hosted route renders the same
page from the same `buildPublicOrderView`, for stores whose proxy is not set up
yet and for links sent from outside the storefront.

The hosted route has no Shopify signature, so the lookup rules *are* its
protection, and they are unchanged: an order number on its own never resolves —
the matching email is always required — and an unknown or disconnected store
404s exactly like one that never existed. `tests/permissions.test.ts` pins both
properties.

### Local development without a Shopify tunnel

The tracking page normally requires a valid App Proxy signature. To open it
directly while developing, set `ALLOW_UNSIGNED_APP_PROXY=1` in `.env.local` and
visit `http://localhost:3000/proxy/track-order?shop=tracky-demo.myshopify.com`.
This escape hatch is ignored in production builds — it requires
`NODE_ENV !== "production"` — but do not set it on a deployed environment.

---

## How the pieces fit

```
Shopify ──orders/create──▶ /api/shopify/webhooks
                            │  verify HMAC → claim X-Shopify-Event-Id → after()
                            ▼
                          create order, place in first stage,
                          schedule delayed emails (QStash)

Agency (phone) ──▶ /agency ──▶ update stage ─────▶ order_stage_history (agency)
                            └▶ mark delivered ──▶ proof_of_delivery
                                                   └▶ fulfillmentCreateV2 → Shopify

Customer ──▶ <shop>/apps/track-order ──proxy──▶ /proxy/track-order
                            verify App Proxy signature → branded timeline
```

### Directory map

| Path                       | What lives there                                        |
| -------------------------- | ------------------------------------------------------- |
| `lib/db/schema.ts`         | All 13 tables, enums and relations                       |
| `lib/db/tenant.ts`         | Tenant-scoped data access — injects `store_id` for you   |
| `lib/auth/session.ts`      | Server-side role guards, active-store resolution         |
| `lib/orders/transitions.ts`| The single writer for order progress                     |
| `lib/fulfillment/`         | Auto-fulfillment and its guards                          |
| `lib/email/`               | Merge fields, React Email rendering, QStash scheduling   |
| `lib/shopify/`             | HMAC/signature verification, OAuth, Admin API, handlers  |
| `app/(marketing)/`        | Public site: landing, about, FAQ, contact                |
| `app/admin/`               | Backoffice (owner)                                        |
| `app/agency/`              | Dispatch UI (agency), mobile-first                       |
| `app/proxy/track-order/`   | Public tracking page behind the App Proxy                |
| `app/track/[shop]/`        | The same page on Tracky's own domain (token or number+email) |
| `components/admin/`        | Dashboard shell, stat tiles, funnel, attention panel     |

---

## Recovering missed orders

Orders arrive by webhook. Webhooks are not guaranteed, so **Sync orders** on
the Orders screen pulls recent orders straight from the Shopify Admin API. It
covers the three cases a webhook cannot:

- orders placed **before** the app was installed — Shopify never sends those;
- a delivery missed during an outage (Shopify retries for 48 hours, then drops
  the event permanently);
- a store reconnected after a period of being uninstalled.

Note that neither scheduler syncs orders — both only sweep scheduled email that
QStash failed to deliver. Nothing polls Shopify on a schedule, by design.

An order the app already holds only has its Shopify-owned fields refreshed
(number, customer, address, line items, total, cancellation). Its stage,
history, driver, proof of delivery and fulfillment state are owned by real
events and the agency, and a re-sync never touches them —
`tests/event-driven-guardrails.test.ts` pins that.

---

## The platform panel

`/platform` is the operator console across **every** store: totals, per-store
health, cross-store activity, accounts, webhook and integration health, plus
the commands to run the platform.

| Section | What it does |
| --- | --- |
| Overview | KPIs, stores needing attention, busiest stores, recent activity, recent operator actions |
| Stores | Every store with health and counts; drill down for connection, configuration, members and commands |
| Accounts | Every account; drill down for store access and account commands |
| System health | Which integrations are configured, webhook delivery, the email queue |
| Audit log | Every operator action, append-only |

**Operator commands.** Suspend or resume a store, disconnect it from Shopify,
leave an internal note, disable or re-enable an account, grant or revoke
platform access, change or revoke someone's role on a store.

It is the single sanctioned exception to tenant scoping, so it is constrained
by design — and the constraints are pinned by `tests/permissions.test.ts`:

- **Reads and commands are separate modules.** `lib/platform/queries.ts` and
  `lib/platform/detail.ts` contain no insert, update or delete; every write
  lives in `lib/actions/platform.ts`. "Can the panel change this?" is answered
  by which module a function is in.
- **Every command is audited.** Each one writes a `platform_audit_log` row —
  operator, target, reason — before it takes effect. The log is append-only:
  no update or delete path exists anywhere in the application.
- **Every command is confirmed.** Destructive ones require a typed
  confirmation of the target and a reason for the log.
- **The platform cannot lock itself out.** You cannot disable your own account
  or revoke your own platform access, the last operator cannot be removed, and
  a store can never be left without an owner.
- **Not self-service.** Only an existing operator can grant the role. A store
  owner has no route to it.
- **Aggregates, not customer data.** Counts, health and event summaries — never
  a customer's address, order contents, or a delivery-note photo.
- **404, not 403.** To anyone who is not an operator, `/platform` does not
  exist.

**Suspension vs. disconnection.** A *suspended* store is still connected and
still receives webhooks, so orders placed during the hold arrive normally and
nothing needs back-filling on resume — it simply cannot be opened by its owner
or agency. A *disconnected* store has had its Shopify token destroyed, exactly
as `app/uninstalled` does; its data is kept and reinstalling reconnects it.

There is no delete. A store's orders are a merchant's records and its history
is what their customers were shown; removing them is a deliberate database
operation, outside this panel.

Bootstrap the first operator with:

```sql
update users set is_platform_admin = true where email = 'you@example.com';
```

or by listing the address in `PLATFORM_ADMIN_EMAILS`, which also serves as the
way back in if the last database-flagged operator is ever removed.

---

## Multi-tenancy

Every store-owned table carries `store_id`, and application code reaches those
tables through `TenantDb` (`lib/db/tenant.ts`), which:

- adds `store_id = <current store>` to every read, update and delete;
- stamps `store_id` on every insert, overwriting whatever the caller passed;
- strips `store_id` from update payloads, so a row can never be moved between
  stores.

The active store comes from a cookie that is **always** re-checked against the
signed-in user's memberships, so a tampered cookie cannot cross a tenant
boundary. `tests/tenant-isolation.test.ts` asserts all of this on the generated
SQL.

Adding a store needs no deploy: installation provisions that store's own
stages, branding, templates, sequence and fulfillment rules.

---

## Security notes

- Shopify access tokens are encrypted at rest with AES-256-GCM
  (`lib/crypto/secrets.ts`) and destroyed on `app/uninstalled`.
- Webhooks verify the HMAC over the **raw** body and deduplicate on
  `X-Shopify-Event-Id` via a unique index before doing any work.
- The App Proxy signature is verified on both the tracking page and the address
  update endpoint.
- The public order lookup on the App Proxy page requires either the per-order
  token or **both** the order number and the email address. The hosted page
  (`/track/<shop>`) also accepts the order number alone, for a one-field
  customer flow — `findPublicOrder` only allows that when the caller passes
  `allowOrderNumberOnly`, and the resulting `access: "order-number"` makes the
  page withhold the full name, the street address and the address-change form
  (which carries the order's token) until the email is confirmed.
- Passwords are hashed with bcrypt (cost 12); a missing account and a wrong
  password take the same time to reject.
- Every server action starts with a role check; `tests/permissions.test.ts`
  fails the build if a new one does not.
- Photos of signed delivery notes live in Vercel Blob at unguessable public
  URLs and are only ever linked from the authenticated backoffice, never from
  the customer tracking page.

---

## Scripts

| Command               | What it does                                    |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Development server                              |
| `npm run build`       | Production build                                |
| `npm run typecheck`   | `tsc --noEmit`                                  |
| `npm run lint`        | ESLint                                          |
| `npm test`            | Vitest suite                                    |
| `npm run db:generate` | Generate a migration from the Drizzle schema    |
| `npm run db:migrate`  | Apply migrations                                |
| `npm run db:check`    | Verify the database schema matches this checkout |
| `npm run db:studio`   | Drizzle Studio                                  |
| `npm run seed`        | Seed a local demo store (`-- --with-order`)     |

---

## Known limitations

- `fulfillmentCreateV2` is the mutation named in the specification and is what
  `lib/fulfillment/index.ts` calls. Shopify has since renamed it to
  `fulfillmentCreate` with an identical input; switch by changing
  `FULFILLMENT_MUTATION_NAME` in that file if you move to an API version where
  the V2 name is gone.
- v1 sends all email from the shared platform domain configured in
  `RESEND_FROM_EMAIL`. Per-store sending domains are not implemented.
- Verified against the Docker stack: migrations apply to a real Postgres, the
  app serves, orders are created by a signed `orders/create` webhook (a
  tampered body is rejected, a replayed event id is deduplicated), email
  scheduling and tenant isolation behave as specified. **Not** yet verified
  against Neon itself, a real Shopify store, Resend, QStash or Vercel Blob.

## Documentation

| Document | Audience |
| --- | --- |
| [`docs/deployment.md`](docs/deployment.md) | Whoever deploys and operates the platform |
| [`docs/store-onboarding.md`](docs/store-onboarding.md) | Whoever connects a new store, start to finish |
| [`docs/admin-guide.md`](docs/admin-guide.md) | The store owner running day-to-day operations |
