# Admin guide

How to run your store's order tracking day to day. No developer needed for
anything in this document.

Sign in at `/login`. If you manage more than one store, use the store selector
in the top bar — everything you see and change applies to the store selected
there.

---

## 1. Dashboard

`/admin` is the operations view. Reading top to bottom:

**The four figures** — orders in progress, deliveries confirmed in the last 7
days (with the change against the 7 days before), orders still waiting on a
delivery confirmation, and new orders over the last fortnight with a small
trend line.

**Needs attention** — the list to work through, worst first. It covers the
problems that quietly stop the system: no stages, no stage marked as a
fulfillment trigger, no active templates or sequence, fulfillments Shopify
rejected, orders the agency confirmed but that were never fulfilled, emails
that failed, and orders with no update for more than three days. When there is
nothing wrong it says so.

> The stale-order warning matters more here than in most systems. Orders only
> move when a person or Shopify says so, so an order sitting untouched is the
> only signal that one has been forgotten — nothing will nudge it along on its
> own.

**Delivery pipeline** — how many open orders sit in each stage. Select a stage
to filter the order list to it.

**Recent activity** — the last events across the store, each showing whether it
came from Shopify, the agency, or a manual override, and who recorded it. These
are the same records that build the customer's timeline.

**Active deliveries, driver workload, store health** — the latest orders in
progress, how many open deliveries each driver is carrying, and a few
connection facts.

The left sidebar carries two live counts: the number of items needing attention
next to Dashboard, and the number of orders in progress next to Orders. They
update on every page, so a problem is visible from wherever you are.

---

## 2. Stages

`/admin/stages`

Stages are the steps a customer sees on the tracking page. Yours start as:
Order Placed → Confirmed → Processing → Out for Delivery → Delivered.

You can rename, recolour, reorder (drag the ⠿ handle, or use ↑ ↓), add and
delete them. Three switches change behaviour:

| Switch                    | Effect                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------ |
| **Terminal stage**        | The end of the journey. The agency's "Mark as delivered" button moves orders here.     |
| **Triggers fulfillment**  | Reaching this stage fulfils the order in Shopify — but only with a confirmed delivery. |
| **Locks address editing** | From this stage on, customers can no longer change their address.                      |

Two rules protect what customers already saw:

- A stage that already appears in an order's history cannot be deleted. Rename
  it instead.
- A stage that orders are currently sitting in cannot be deleted. Move those
  orders first.

Keep exactly one stage marked *Triggers fulfillment* — usually the same one
marked *Terminal*.

---

## 3. Orders

`/admin/orders`

Orders arrive automatically from Shopify. Search by order number, customer
name, email or driver; filter by stage, or by In progress / Completed.

### Sync orders

The **Sync orders** button at the top pulls recent orders straight from
Shopify. Normally you never need it — orders arrive the instant Shopify sends
a webhook. Reach for it when that did not happen:

- **orders placed before you installed the app.** Shopify never sends those,
  so a sync is the only way to bring them in.
- **a webhook that went missing** during an outage. Shopify retries for 48
  hours and then drops the event for good.
- **a store you have just reconnected** after it was uninstalled.

You can look back up to 60 days — Shopify does not return orders older than
that. Orders the app already has only get their Shopify details refreshed:
their stage, history, driver and delivery confirmation are never overwritten,
so syncing is always safe to repeat.

Imported orders appear in the history as **Manual sync**, so you can always
tell them apart from the ones Shopify pushed.

Open an order to see:

- **Order details** — customer, address, items, total, mirrored from Shopify.
- **Event history** — every recorded event with its source (Shopify, Delivery
  agency, or Manual override) and who did it.
- **Email log** — what was scheduled, sent, failed or skipped, with a
  *Send now* button for anything that failed.
- **Manual stage override** — move the order yourself. It is recorded as a
  manual override under your name, and the optional message is shown to the
  customer.
- **Driver** — the label your agency uses. Drivers have no account here.
- **Proof of delivery** — who declared the delivery, when, who signed, and the
  photo of the signed paper note if one was taken.
- **Shopify fulfillment** — the status, plus a *Retry fulfillment* button.

### Why an order will not fulfil

The retry button reports the reason. In practice it is always one of:

1. No proof of delivery yet — the agency has not confirmed the delivery.
2. The order is not in a stage marked *Triggers fulfillment*.
3. Auto-fulfillment is switched off in **Fulfillment** settings.
4. Shopify rejected it — the exact message is shown on the order.

---

## 4. Email templates

`/admin/emails/templates`

Each template has a name (internal), a subject, preview text and a body. The
body is HTML; your branding — colours, logo, font, footer — is applied
automatically when it is sent.

Type merge variables anywhere in the subject or body:

`{{customer_name}}` `{{order_number}}` `{{order_date}}` `{{tracking_link}}`
`{{current_stage}}` `{{store_name}}` `{{shipping_address}}`

Open a template to edit it. The panel on the right previews it with example
data, rendered by exactly the same engine that sends the real email — what you
approve is what the customer gets. A misspelled variable is flagged rather than
silently dropped.

**Inactive** templates are never sent, by a sequence or by hand. Deactivating is
the safe way to retire a template that a sequence still points at.

---

## 5. Email sequence

`/admin/emails/sequence`

A sequence step says *which template* goes out and *when*. Three triggers:

- **When the order reaches a stage** — sent immediately on that transition.
- **A number of days after the order was placed** — counted from the real
  Shopify order date.
- **A number of days after the previous delayed step** — chains off the step
  above it, which is why order matters here.

Pause a step to stop future sends without deleting it. Emails already sent stay
in the log.

> A delay only ever schedules an email. It never moves an order to another
> stage. Delivery progress comes from your agency or from Shopify, never from
> the clock.

---

## 6. Branding

`/admin/branding`

Grouped into five sections, with a live preview of the real tracking page
beside them. Nothing is saved until you press **Save branding**, and switching
between sections never loses what you have typed.

- **Theme** — colours and typography. Start from one of the four presets
  (Classic, Warm, Forest, Midnight) and adjust from there. If your text colour
  would be hard to read on your background, a warning appears with the measured
  contrast ratio; anything under 4.5:1 will be a struggle for customers reading
  on a phone in daylight.
- **Identity** — your logo. Without one, your store name is used.
- **Page copy** — page title, subtitle, help banner and footer.
- **FAQ** — questions shown as an accordion under the timeline.
- **Sections** — whether to show the order summary, and whether customers may
  edit their own address.

**Reset to defaults** puts the colours and copy back to how they shipped.

Your branding is applied to the tracking page and to every email you send.

---

## 7. Fulfillment

`/admin/settings/fulfillment`

- **Fulfil orders in Shopify automatically** — turn off to keep tracking here
  without touching Shopify.
- **Require a confirmed delivery before fulfilling** — leave this **on**. It is
  what stops an order being marked fulfilled before anyone has actually handed
  the parcel over.
- **Let Shopify email its own shipping confirmation** — off by default, because
  this app already emails the customer at each stage.

---

## 8. Users

`/admin/settings/users`

- **Owner** — everything in this guide.
- **Agency** — the dispatch screens only: active orders, assign a driver,
  update a stage, confirm a delivery. No branding, templates or settings.

Invite someone by email; they get a one-time link (valid 7 days) and choose
their own password. Revoke access at any time — the account survives, the
access does not. A store always keeps at least one owner, and you cannot revoke
your own access.

**Drivers are not users.** They deliver, get the paper note signed and hand it
back. In this app a driver is only a name you attach to an order so dispatch
knows who has it.

---

## 9. Sending email by hand

On `/admin/orders`, tick one or more orders, pick a template in the bar above
the table and press **Send email**. One order or two hundred use the same
action, and every send is written to that order's email log with your name
against it.

Orders with no email address, or that were cancelled in Shopify, are skipped and
listed back to you.

---

## 10. What the delivery agency does

`/agency` on a phone browser. No app to install.

1. **Active deliveries** — every order still in progress, searchable and
   filterable by stage and driver.
2. Open an order to see the address (tap the phone number to call), the items
   and the current status.
3. **Assign a driver** — a name, for their own dispatch.
4. **Update status** — moves the order to the chosen stage. The optional message
   appears on the customer's tracking page.
5. **Mark as delivered** — used *after* the parcel is handed over and the
   customer has signed the paper delivery note. It records who declared the
   delivery, when, who signed, an optional photo of the signed note, and moves
   the order to the terminal stage. If fulfillment is enabled, this is the
   moment Shopify is told the order is fulfilled.

The agency cannot skip step 5 by choosing the delivered stage in step 4 — the
app asks them to use **Mark as delivered** so the proof is always recorded.

---

## 11. Adding another store

`/admin/stores`

Paste the store's address into **Connect a store** and press *Connect with
Shopify*. Any of these work — the field shows you which store it resolved
before you submit:

- `acme-supply`
- `acme-supply.myshopify.com`
- `https://acme-supply.myshopify.com/admin/products`
- `https://admin.shopify.com/store/acme-supply/orders/1234`

You are sent to Shopify to approve the app. Approving needs admin rights on
that store, which is what proves it is yours.

The new store arrives with **its own** stages, branding, templates, sequence
and fulfillment rules, completely independent of your existing stores. Nothing
needs redeploying. Orders placed before the install are not imported.

The same page lists every store you manage, with how many orders each has
synced and when the last one arrived, plus quick links to its storefront, its
Shopify admin and its tracking page. Use **Open** to switch to a store, or the
selector in the top bar.

**Reconnect** re-runs the same approval flow. Use it if a store shows as
disconnected — that means Tracky was uninstalled from Shopify, so nothing is
syncing — or after you change the app's permissions. The store's orders and
settings are kept while it is disconnected.

## 12. The customer tracking page

Customers can follow their order in two places. Both show exactly the same
thing, because both are built from the same records.

**On your own domain** (the main one): `https://yourstore.com/apps/track-order`.
This is the link used in your emails, and the customer never leaves your store.

**On Tracky's domain**: `/track/<your-store>.myshopify.com`. Useful before your
App Proxy is set up, or when you want to link tracking from somewhere other
than your storefront — a support reply, a receipt, an SMS. You will find the
link on the Stores page under **Hosted tracking**.

**The personal link in your emails** opens the customer's order directly on
either page, with nothing to type. It is always the best link to give them.

Without that link, the two pages ask for different things — deliberately.

| | On your own domain (App Proxy) | On Tracky's domain |
| --- | --- | --- |
| What the customer types | Order number, then the email used at checkout | Order number only |
| Why | Shopify signs every request to this page, and it is the one your customers reach from your storefront, so it keeps the stricter rule | A visitor arriving cold often has neither the email to hand nor the patience for a second question |

Because an order number can be guessed, an order opened with the number alone
shows **only the delivery progress**: the stage timeline, the updates your
agency left, the items and the total, the customer's first name and last
initial, and the delivery city and country. The full name, the street address
and the *Edit address* form stay hidden behind a **Confirm your email address**
link on that page, which asks for the email on the order.

A customer who arrives by their email link, or who confirms their email, sees
everything — including changing their own address, until the order reaches the
stage you marked as *Locks address editing*. Everything is styled from your
Branding settings.

---

## 13. The platform panel (operators only)

If your account is a platform operator, a **Platform** badge appears in the
top bar. It opens the operator console over *every* store on the
installation — not just yours.

| Section | What it shows |
| --- | --- |
| Overview | Headline numbers, stores needing attention, busiest stores, activity and recent operator actions |
| Stores | Every store with its health and counts. Open one for its connection, configuration, members and commands |
| Accounts | Every account. Open one for its store access and account commands |
| System health | Which integrations are configured, webhook delivery, the email queue |
| Audit log | Every action an operator has taken |

### What you can do

| Command | Effect |
| --- | --- |
| Suspend / resume a store | Its owner and agency lose access. Webhooks keep arriving, so no orders are lost during the hold |
| Disconnect from Shopify | Destroys the access token. Data is kept; the merchant recovers by reinstalling |
| Internal note | A note on a store only operators see |
| Disable / re-enable an account | Locks someone out of every store, from their next request |
| Grant / revoke platform access | Who else can open this console |
| Change or remove a role | Owner ↔ agency, or remove access to one store |

### The rules it enforces

- **Everything is recorded.** Each command writes to the audit log with your
  name, the target and the reason you gave, before it takes effect. The log
  cannot be edited or deleted by anyone, including you.
- **Nothing fires on one click.** Every command opens a confirmation panel;
  the destructive ones also make you type the store domain or email address.
- **You cannot lock the platform out of itself.** Disabling your own account,
  revoking your own access, removing the last operator, or leaving a store
  with no owner are all refused.
- **It never shows customer data.** Counts, health and event summaries — never
  an address, an order's contents, or a photo of a signed delivery note.
- **There is no delete.** A store's orders are a merchant's records and its
  history is what their customers were shown.
- To anyone who is not an operator, `/platform` returns a 404 — it does not
  announce that it exists.
