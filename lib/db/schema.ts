import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const storeStatusEnum = pgEnum("store_status", [
  "active",
  "uninstalled",
  /**
   * Credentials were entered and the OAuth round trip has started, but the
   * merchant has not approved yet. The row exists only so the callback (and
   * the install route Shopify itself calls) can find out *which* Shopify app
   * this shop belongs to — see `auth_mode` below. It is invisible everywhere
   * else: `getMemberships` and `requireStoreById` both demand `active`.
   */
  "pending",
]);

/**
 * How this store's Admin API token was obtained.
 *
 * `oauth`  — a public/Partner app: we hold the client id and secret and the
 *            merchant approves the install, which mints the token.
 * `custom` — an app created inside the store under *Develop apps*: there is no
 *            OAuth flow at all, the Admin API token is pasted in by hand and
 *            the API secret key is only used to verify webhooks and App Proxy
 *            signatures.
 */
/**
 * How the public tracking page arranges itself.
 *
 * `center` is the default because the page now renders inside the merchant's
 * own theme, between their header and footer, where a centred column reads as
 * a section of their site rather than a panel bolted onto the side of it.
 */
export const contentAlignmentEnum = pgEnum("content_alignment", [
  "left",
  "center",
]);

export const shopifyAuthModeEnum = pgEnum("shopify_auth_mode", [
  "oauth",
  "custom",
]);

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "agency",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "revoked",
]);

/**
 * Where a stage transition came from. There is deliberately no `timer` or
 * `system` source: time never advances an order (see lib/orders/transitions).
 */
export const stageEventSourceEnum = pgEnum("stage_event_source", [
  "shopify_webhook",
  /**
   * An order pulled from the Shopify Admin API by an admin pressing "Sync
   * orders" — a backfill for orders placed before the app was installed, or
   * whose webhook never arrived.
   *
   * It gets its own source rather than borrowing `shopify_webhook` because
   * the timeline is an audit trail: "Shopify told us" and "we went and asked"
   * are different facts. It is still a real event about a real order.
   */
  "shopify_sync",
  "agency",
  "admin",
]);

export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "unfulfilled",
  "partial",
  "fulfilled",
  "failed",
]);

export const sequenceTriggerTypeEnum = pgEnum("sequence_trigger_type", [
  "on_stage",
  "delay_after_order",
  "delay_after_previous",
]);

export const emailSendStatusEnum = pgEnum("email_send_status", [
  "scheduled",
  "sent",
  "failed",
  "skipped",
]);

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// ---------------------------------------------------------------------------
// stores — one row per connected Shopify shop. Tenant root.
// ---------------------------------------------------------------------------

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopDomain: text("shop_domain").notNull(),
    /**
     * Customer-facing domain (`shop.primaryDomain`), used to build tracking
     * links that keep the customer on the merchant's own domain. Falls back to
     * `shop_domain` when Shopify has not reported one.
     */
    primaryDomain: text("primary_domain"),
    /** Store display name pulled from the Shopify shop record. */
    name: text("name"),
    /** Default currency, used when an order payload omits one. */
    currency: text("currency").notNull().default("AUD"),
    /** AES-256-GCM ciphertext of the Shopify Admin API access token. */
    accessToken: text("access_token"),
    scope: text("scope"),

    // --- Shopify app credentials, per store ---------------------------------
    //
    // The application used to hold exactly one set of app credentials, in
    // SHOPIFY_API_KEY / SHOPIFY_API_SECRET, which capped the whole platform at
    // a single Shopify app. Every store now carries its own, so any number of
    // apps created in the Partner dashboard can be spread across stores
    // without a redeploy. The environment variables remain as a fallback for
    // stores connected before this change.
    authMode: shopifyAuthModeEnum("auth_mode").notNull().default("oauth"),
    /** Client ID (OAuth app) or API key (custom app). Not a secret. */
    apiKey: text("api_key"),
    /**
     * AES-256-GCM ciphertext of the app's client secret / API secret key.
     * This is the value every Shopify signature on this store is verified
     * with: webhook HMAC, OAuth callback HMAC and App Proxy signature.
     */
    apiSecret: text("api_secret"),
    /** Scopes requested at install. Null falls back to SHOPIFY_SCOPES. */
    scopes: text("scopes"),
    /** Admin API version. Null falls back to SHOPIFY_API_VERSION. */
    apiVersion: text("api_version"),
    status: storeStatusEnum("status").notNull().default("active"),
    installedAt: timestamp("installed_at", { withTimezone: true }),
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
    /**
     * Suspended by a platform operator — non-payment, abuse, a support hold.
     *
     * Distinct from `status = uninstalled`, which is Shopify's doing: a
     * suspended store is still connected and still receives webhooks (so no
     * orders are lost), but nobody can open its backoffice or dispatch screens
     * until it is resumed.
     */
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    /** Free-text note only platform operators ever see. */
    internalNote: text("internal_note"),
    ...timestamps,
  },
  (table) => [uniqueIndex("stores_shop_domain_key").on(table.shopDomain)],
);

// ---------------------------------------------------------------------------
// users — login identities (email + password hash)
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    passwordHash: text("password_hash"),
    /**
     * Platform operator: sees and manages every store from /platform.
     *
     * The one role that deliberately crosses tenant boundaries, and never
     * self-service — it can only be granted by an existing operator (every
     * grant lands in `platform_audit_log`) or by listing the address in
     * PLATFORM_ADMIN_EMAILS. A store owner cannot promote themselves.
     */
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    /**
     * Locked out by a platform operator. Checked both at sign-in and on every
     * session resolution, so disabling takes effect on the next request rather
     * than whenever the existing JWT happens to expire.
     */
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    disabledReason: text("disabled_reason"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

// ---------------------------------------------------------------------------
// store_memberships — which user may act on which store, and as what
// ---------------------------------------------------------------------------

export const storeMemberships = pgTable(
  "store_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    status: membershipStatusEnum("status").notNull().default("active"),
    /** Single-use token emailed to an invited agency user. */
    inviteToken: text("invite_token"),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    invitedByUserId: uuid("invited_by_user_id"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("store_memberships_store_user_key").on(
      table.storeId,
      table.userId,
    ),
    uniqueIndex("store_memberships_invite_token_key").on(table.inviteToken),
    index("store_memberships_user_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// branding_settings — per-store look & feel of the public tracking page
// ---------------------------------------------------------------------------

export const brandingSettings = pgTable(
  "branding_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),

    primaryColor: text("primary_color").notNull().default("#1B2B44"),
    secondaryColor: text("secondary_color").notNull().default("#F5A524"),
    backgroundColor: text("background_color").notNull().default("#FFFFFF"),
    textColor: text("text_color").notNull().default("#131A24"),
    accentColor: text("accent_color").notNull().default("#1B2B44"),

    logoUrl: text("logo_url"),
    fontFamily: text("font_family")
      .notNull()
      .default(
        "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
      ),
    baseFontSize: integer("base_font_size").notNull().default(16),
    /**
     * The page's anchor. Large by default: embedded in a theme this heading is
     * what tells a customer they are on the tracking page and not still on the
     * product they came from.
     */
    headingFontSize: integer("heading_font_size").notNull().default(42),

    /** Customer-facing copy on the tracking page. English by default. */
    pageTitle: text("page_title").notNull().default("Track your order"),
    pageSubtitle: text("page_subtitle")
      .notNull()
      .default("Enter your details to see the latest delivery update."),
    helpBannerText: text("help_banner_text")
      .notNull()
      .default("Need help with your order? Contact our support team."),
    helpBannerUrl: text("help_banner_url"),
    footerText: text("footer_text").notNull().default(""),
    /** [{ question, answer }] rendered as an accordion. */
    faq: jsonb("faq")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<Array<{ question: string; answer: string }>>(),
    showOrderSummary: boolean("show_order_summary").notNull().default(true),
    showAddressEditing: boolean("show_address_editing").notNull().default(true),

    // --- Layout -------------------------------------------------------------
    //
    // These exist because the page stopped being a page. Served inside a
    // Shopify theme it is one band among the merchant's own sections, and the
    // things that make it sit there properly — where the column sits, how wide
    // it runs, how round its corners are, whether it repeats a brand the theme
    // header already shows — are decisions per store, not constants.
    contentAlignment: contentAlignmentEnum("content_alignment")
      .notNull()
      .default("center"),
    /**
     * Repeat the store name or logo above the tracking form.
     *
     * Off by default: the theme's own header is directly above this, and two
     * wordmarks in a row is the clearest sign of an app bolted on.
     */
    showStoreName: boolean("show_store_name").notNull().default(false),
    /** Width of the content column, in px. */
    contentWidth: integer("content_width").notNull().default(640),
    /** Corner radius of panels and cards, in px. */
    cardRadius: integer("card_radius").notNull().default(14),
    /** Corner radius of buttons and inputs, in px. */
    buttonRadius: integer("button_radius").notNull().default(10),
    /** A button that fills its column reads as the page's one action. */
    buttonFullWidth: boolean("button_full_width").notNull().default(true),
    /**
     * The band behind the tracking card, when it should differ from the page.
     * Null means the page background, with no band at all.
     */
    sectionBackground: text("section_background").default("#F4F5F3"),

    // --- The lookup form ----------------------------------------------------
    //
    // The form is the whole page until an order is found, so its wording is
    // not a detail: it is what tells a customer, in the store's own voice,
    // which single detail to reach for. Blank falls back to copy derived from
    // the lookup policy, so a store that never touches these still gets a
    // prompt that matches what the page actually accepts.
    formPrompt: text("form_prompt").notNull().default(""),
    formPlaceholder: text("form_placeholder").notNull().default(""),
    formButtonLabel: text("form_button_label").notNull().default(""),
    /** A small mark above the prompt, so the card reads as a thing to use. */
    showFormIcon: boolean("show_form_icon").notNull().default(true),
    /** The arrow on the button: motion, for the one action on the page. */
    showButtonArrow: boolean("show_button_arrow").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("branding_settings_store_key").on(table.storeId)],
);

// ---------------------------------------------------------------------------
// stages — the fully admin-configurable tracking steps
// ---------------------------------------------------------------------------

export const stages = pgTable(
  "stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Stable slug, safe to reference from templates and code. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** Customer-facing description shown under the stage on the timeline. */
    description: text("description").notNull().default(""),
    position: integer("position").notNull(),
    icon: text("icon").notNull().default("circle"),
    color: text("color").notNull().default("#2563eb"),
    /** Final stage of the journey, e.g. "Delivered". */
    isTerminal: boolean("is_terminal").notNull().default(false),
    /** Reaching this stage pushes a Shopify fulfillment (with proof). */
    triggersFulfillment: boolean("triggers_fulfillment")
      .notNull()
      .default(false),
    /** From this stage on, customers may no longer edit the address. */
    locksAddressEditing: boolean("locks_address_editing")
      .notNull()
      .default(false),
    /**
     * Shopify reporting the order as paid advances it to this stage.
     *
     * The one automatic transition in the product, and it is still driven by a
     * real event: Shopify says the money arrived. Nothing here moves an order
     * because time passed — delivery progress remains something a person
     * records. A store marks at most one stage with this; the first by
     * position wins if more are set.
     */
    advancesOnPayment: boolean("advances_on_payment").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("stages_store_key_key").on(table.storeId, table.key),
    index("stages_store_position_idx").on(table.storeId, table.position),
  ],
);

// ---------------------------------------------------------------------------
// orders — mirrored Shopify orders
// ---------------------------------------------------------------------------

export type ShippingAddress = {
  name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  provinceCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  zip?: string | null;
  phone?: string | null;
};

export type LineItem = {
  id?: string | number | null;
  title: string;
  variantTitle?: string | null;
  quantity: number;
  price?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
};

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    shopifyOrderId: text("shopify_order_id").notNull(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddress>(),
    lineItems: jsonb("line_items")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<LineItem[]>(),
    orderDate: timestamp("order_date", { withTimezone: true }).notNull(),
    total: numeric("total", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("AUD"),

    currentStageId: uuid("current_stage_id").references(() => stages.id, {
      onDelete: "set null",
    }),
    fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status")
      .notNull()
      .default("unfulfilled"),
    /** Shopify fulfillment GID, set once we successfully fulfil. */
    shopifyFulfillmentId: text("shopify_fulfillment_id"),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    fulfillmentError: text("fulfillment_error"),

    /** Plain label, not an account: drivers never log in. */
    assignedDriverName: text("assigned_driver_name"),
    /** Opaque token so a customer can be deep-linked to their own timeline. */
    trackingToken: text("tracking_token").notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_store_shopify_order_key").on(
      table.storeId,
      table.shopifyOrderId,
    ),
    uniqueIndex("orders_tracking_token_key").on(table.trackingToken),
    index("orders_store_created_idx").on(table.storeId, table.createdAt),
    index("orders_store_stage_idx").on(table.storeId, table.currentStageId),
    index("orders_store_email_idx").on(table.storeId, table.customerEmail),
    index("orders_store_number_idx").on(table.storeId, table.orderNumber),
  ],
);

// ---------------------------------------------------------------------------
// order_stage_history — the append-only feed behind the public timeline
// ---------------------------------------------------------------------------

export const orderStageHistory = pgTable(
  "order_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "restrict" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Optional message surfaced to the customer on the tracking page. */
    note: text("note"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    source: stageEventSourceEnum("source").notNull(),
    ...timestamps,
  },
  (table) => [
    index("order_stage_history_order_idx").on(table.orderId, table.occurredAt),
    index("order_stage_history_store_idx").on(table.storeId),
  ],
);

// ---------------------------------------------------------------------------
// proof_of_delivery — the agency's declaration that delivery really happened
// ---------------------------------------------------------------------------

export const proofOfDelivery = pgTable(
  "proof_of_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** The agency user who declared the delivery. */
    markedDeliveredByUserId: uuid("marked_delivered_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull(),
    recipientName: text("recipient_name"),
    /**
     * Optional photo of the PAPER delivery note the customer signed by hand.
     * There is no digital signature capture anywhere in this application.
     */
    paperSignaturePhotoUrl: text("paper_signature_photo_url"),
    driverName: text("driver_name"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("proof_of_delivery_order_key").on(table.orderId),
    index("proof_of_delivery_store_idx").on(table.storeId),
  ],
);

// ---------------------------------------------------------------------------
// email_templates
// ---------------------------------------------------------------------------

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    key: text("key"),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    /** Rich text / HTML with {{merge_variables}}. Rendered by React Email. */
    body: text("body").notNull(),
    previewText: text("preview_text").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("email_templates_store_idx").on(table.storeId),
    uniqueIndex("email_templates_store_key_key").on(table.storeId, table.key),
  ],
);

// ---------------------------------------------------------------------------
// email_sequence_steps — when each template goes out
// ---------------------------------------------------------------------------

export const emailSequenceSteps = pgTable(
  "email_sequence_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "cascade" }),
    triggerType: sequenceTriggerTypeEnum("trigger_type").notNull(),
    /** Required when triggerType = on_stage. */
    stageId: uuid("stage_id").references(() => stages.id, {
      onDelete: "cascade",
    }),
    /** Required for the two delay triggers. Delays only ever send email. */
    delayDays: integer("delay_days"),
    position: integer("position").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("email_sequence_steps_store_position_idx").on(
      table.storeId,
      table.position,
    ),
    index("email_sequence_steps_stage_idx").on(table.stageId),
  ],
);

// ---------------------------------------------------------------------------
// email_sends — one row per attempted/scheduled email
// ---------------------------------------------------------------------------

export const emailSends = pgTable(
  "email_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Null for a manual one-off / bulk send that is not part of a sequence. */
    sequenceStepId: uuid("sequence_step_id").references(
      () => emailSequenceSteps.id,
      { onDelete: "set null" },
    ),
    templateId: uuid("template_id").references(() => emailTemplates.id, {
      onDelete: "set null",
    }),
    toEmail: text("to_email").notNull(),
    subject: text("subject"),
    status: emailSendStatusEnum("status").notNull().default("scheduled"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    qstashMessageId: text("qstash_message_id"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    /** Set for manual sends so the UI can tell them apart. */
    triggeredByUserId: uuid("triggered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("email_sends_due_idx").on(table.status, table.scheduledFor),
    index("email_sends_order_idx").on(table.orderId),
    index("email_sends_store_idx").on(table.storeId),
    // A sequence step fires at most once per order: makes scheduling idempotent.
    uniqueIndex("email_sends_order_step_key").on(
      table.orderId,
      table.sequenceStepId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// fulfillment_rules
// ---------------------------------------------------------------------------

export const fulfillmentRules = pgTable(
  "fulfillment_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    /**
     * True by default and the whole point of the product: fulfillment waits
     * for the agency's delivery declaration, never for a delay.
     */
    requireDeliveryConfirmation: boolean("require_delivery_confirmation")
      .notNull()
      .default(true),
    /** Ask Shopify to email its own shipping confirmation. Off by default. */
    notifyCustomerOnFulfillment: boolean("notify_customer_on_fulfillment")
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("fulfillment_rules_store_key").on(table.storeId)],
);

// ---------------------------------------------------------------------------
// webhook_events — idempotency ledger for Shopify webhooks
// ---------------------------------------------------------------------------

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopifyEventId: text("shopify_event_id").notNull(),
    shopDomain: text("shop_domain"),
    topic: text("topic").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => [
    uniqueIndex("webhook_events_event_id_key").on(table.shopifyEventId),
    index("webhook_events_topic_idx").on(table.topic),
  ],
);

// ---------------------------------------------------------------------------
// platform_audit_log — every write a platform operator makes
// ---------------------------------------------------------------------------

export const platformActionEnum = pgEnum("platform_action", [
  "store.suspend",
  "store.resume",
  "store.disconnect",
  "store.note",
  /** An operator replaced the Shopify app credentials a store runs on. */
  "store.credentials",
  "user.disable",
  "user.enable",
  "user.grant_platform_admin",
  "user.revoke_platform_admin",
  "membership.revoke",
  "membership.role_change",
]);

/**
 * The price of letting an operator act across tenants.
 *
 * Nothing in `/platform` writes without landing a row here first: who did it,
 * to what, and why. It is append-only — no update or delete path exists in the
 * application — because an audit trail an operator can edit is not one.
 *
 * `actorEmail` and `targetLabel` are denormalised on purpose: the whole point
 * is to still be readable after the user or store in question is gone.
 */
export const platformAuditLog = pgTable(
  "platform_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email").notNull(),
    action: platformActionEnum("action").notNull(),
    /** The store or user acted on, when there is one. */
    targetStoreId: uuid("target_store_id").references(() => stores.id, {
      onDelete: "set null",
    }),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Human label frozen at the time of the action. */
    targetLabel: text("target_label").notNull(),
    reason: text("reason"),
    /** Small structured payload, e.g. { from: "agency", to: "owner" }. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("platform_audit_log_created_idx").on(table.createdAt),
    index("platform_audit_log_store_idx").on(table.targetStoreId),
    index("platform_audit_log_user_idx").on(table.targetUserId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const storesRelations = relations(stores, ({ many, one }) => ({
  memberships: many(storeMemberships),
  stages: many(stages),
  orders: many(orders),
  branding: one(brandingSettings),
  fulfillmentRules: one(fulfillmentRules),
  emailTemplates: many(emailTemplates),
  emailSequenceSteps: many(emailSequenceSteps),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(storeMemberships),
}));

export const storeMembershipsRelations = relations(
  storeMemberships,
  ({ one }) => ({
    store: one(stores, {
      fields: [storeMemberships.storeId],
      references: [stores.id],
    }),
    user: one(users, {
      fields: [storeMemberships.userId],
      references: [users.id],
    }),
  }),
);

export const stagesRelations = relations(stages, ({ one, many }) => ({
  store: one(stores, { fields: [stages.storeId], references: [stores.id] }),
  history: many(orderStageHistory),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  currentStage: one(stages, {
    fields: [orders.currentStageId],
    references: [stages.id],
  }),
  history: many(orderStageHistory),
  proofOfDelivery: one(proofOfDelivery),
  emailSends: many(emailSends),
}));

export const orderStageHistoryRelations = relations(
  orderStageHistory,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderStageHistory.orderId],
      references: [orders.id],
    }),
    stage: one(stages, {
      fields: [orderStageHistory.stageId],
      references: [stages.id],
    }),
    createdBy: one(users, {
      fields: [orderStageHistory.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const proofOfDeliveryRelations = relations(
  proofOfDelivery,
  ({ one }) => ({
    order: one(orders, {
      fields: [proofOfDelivery.orderId],
      references: [orders.id],
    }),
    markedDeliveredBy: one(users, {
      fields: [proofOfDelivery.markedDeliveredByUserId],
      references: [users.id],
    }),
  }),
);

export const emailTemplatesRelations = relations(
  emailTemplates,
  ({ one, many }) => ({
    store: one(stores, {
      fields: [emailTemplates.storeId],
      references: [stores.id],
    }),
    steps: many(emailSequenceSteps),
  }),
);

export const emailSequenceStepsRelations = relations(
  emailSequenceSteps,
  ({ one }) => ({
    store: one(stores, {
      fields: [emailSequenceSteps.storeId],
      references: [stores.id],
    }),
    template: one(emailTemplates, {
      fields: [emailSequenceSteps.templateId],
      references: [emailTemplates.id],
    }),
    stage: one(stages, {
      fields: [emailSequenceSteps.stageId],
      references: [stages.id],
    }),
  }),
);

export const emailSendsRelations = relations(emailSends, ({ one }) => ({
  order: one(orders, { fields: [emailSends.orderId], references: [orders.id] }),
  template: one(emailTemplates, {
    fields: [emailSends.templateId],
    references: [emailTemplates.id],
  }),
  step: one(emailSequenceSteps, {
    fields: [emailSends.sequenceStepId],
    references: [emailSequenceSteps.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Store = typeof stores.$inferSelect;
export type User = typeof users.$inferSelect;
export type StoreMembership = typeof storeMemberships.$inferSelect;
export type BrandingSettings = typeof brandingSettings.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderStageHistory = typeof orderStageHistory.$inferSelect;
export type ProofOfDelivery = typeof proofOfDelivery.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type EmailSequenceStep = typeof emailSequenceSteps.$inferSelect;
export type EmailSend = typeof emailSends.$inferSelect;
export type FulfillmentRules = typeof fulfillmentRules.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type PlatformAuditEntry = typeof platformAuditLog.$inferSelect;
export type PlatformAction = (typeof platformActionEnum.enumValues)[number];
export type ShopifyAuthMode = (typeof shopifyAuthModeEnum.enumValues)[number];
export type ContentAlignment = (typeof contentAlignmentEnum.enumValues)[number];
export type StoreStatus = (typeof storeStatusEnum.enumValues)[number];
export type MembershipRole = (typeof membershipRoleEnum.enumValues)[number];
export type StageEventSource = (typeof stageEventSourceEnum.enumValues)[number];
