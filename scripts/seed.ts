/**
 * Local development seed.
 *
 * Creates one demo store with its own default stages, branding, templates and
 * sequence, plus an owner and an agency account so both interfaces can be
 * opened immediately. Optionally adds a demo order, imported through exactly
 * the same code path a real `orders/create` webhook uses.
 *
 * It never runs against a store that already has data, and refuses to run when
 * NODE_ENV is production.
 *
 *   npm run seed
 *   npm run seed -- --with-order
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production environment.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  if (!process.env.ENCRYPTION_KEY) {
    // Not used by the seed itself, but the app will need it immediately after.
    console.warn("! ENCRYPTION_KEY is not set; set it before connecting Shopify.");
  }

  const { db, orders, storeMemberships, stores, users } = await import("@/lib/db");
  const { TenantDb } = await import("@/lib/db/tenant");
  const { hashPassword } = await import("@/lib/auth/password");
  const { provisionStoreDefaults } = await import("@/lib/stores/provision");
  const { getFirstStage } = await import("@/lib/orders/stages");
  const { placeOrderInFirstStage } = await import("@/lib/orders/transitions");
  const { randomToken } = await import("@/lib/crypto/secrets");

  const shopDomain = "tracky-demo.myshopify.com";

  const [store] = await db
    .insert(stores)
    .values({
      shopDomain,
      name: "Tracky Demo Store",
      primaryDomain: "tracky-demo.myshopify.com",
      currency: "AUD",
      status: "active",
      installedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: stores.shopDomain,
      set: { status: "active", updatedAt: new Date() },
    })
    .returning();

  console.log(`✓ store ${store.shopDomain}`);

  await provisionStoreDefaults(store.id);
  console.log("✓ default stages, branding, templates, sequence, fulfillment rules");

  const accounts = [
    { email: "owner@tracky.com", name: "Christian", role: "owner" as const },
    { email: "agency@tracky.com", name: "Dispatch Desk", role: "agency" as const },
  ];

  const password = "TrackyDemo1";
  const passwordHash = await hashPassword(password);

  for (const account of accounts) {
    const [user] = await db
      .insert(users)
      .values({ email: account.email, name: account.name, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: account.name, passwordHash, updatedAt: new Date() },
      })
      .returning();

    await db
      .insert(storeMemberships)
      .values({
        storeId: store.id,
        userId: user.id,
        role: account.role,
        status: "active",
        acceptedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [storeMemberships.storeId, storeMemberships.userId],
        set: { role: account.role, status: "active", updatedAt: new Date() },
      });

    console.log(`✓ ${account.role} ${account.email} / ${password}`);
  }

  if (process.argv.includes("--with-order")) {
    const tdb = new TenantDb(store.id);
    const existing = await tdb.findFirst(orders, {
      where: eq(orders.shopifyOrderId, "demo-1"),
    });

    if (existing) {
      console.log("• demo orders already present");
    } else {
      const firstStage = await getFirstStage(tdb);
      if (!firstStage) throw new Error("Store has no stages.");

      const { proofOfDelivery, stages } = await import("@/lib/db");
      const { recordStageTransition } = await import("@/lib/orders/transitions");
      const stageByKey = new Map(
        (await tdb.findMany(stages)).map((stage) => [stage.key, stage]),
      );
      const hour = 60 * 60 * 1000;

      // --- An order mid-journey -------------------------------------------
      const inFlight = await tdb.insertOne(orders, {
        shopifyOrderId: "demo-1",
        orderNumber: "#1042",
        customerName: "Sarah Jenkins",
        customerEmail: "sarah@example.com",
        customerPhone: "+61400000000",
        shippingAddress: {
          name: "Sarah Jenkins",
          address1: "12 Bourke Street",
          city: "Melbourne",
          province: "Victoria",
          provinceCode: "VIC",
          zip: "3000",
          country: "Australia",
          countryCode: "AU",
        },
        lineItems: [
          { title: "Cedar Side Table", quantity: 1, price: "249.00" },
          { title: "Linen Cushion Cover", variantTitle: "Sand", quantity: 2, price: "39.00" },
        ],
        orderDate: new Date(Date.now() - 78 * hour),
        total: "327.00",
        currency: "AUD",
        trackingToken: randomToken(18),
      });

      // Same path a real orders/create webhook takes — the resulting timeline
      // event is a genuine record of this import, not a fabricated update.
      await placeOrderInFirstStage({ tdb, order: inFlight, firstStage });

      // Then a few agency updates, so the tracking page has a real history to
      // show rather than a single lonely row.
      const progress: Array<[string, string, number]> = [
        ["confirmed", "Your order has been confirmed and is queued for packing.", 70],
        ["processing", "Your items have been picked and packed, ready for our driver.", 40],
        [
          "out-for-delivery",
          "The package is on its way today. Our driver will ask you to sign the paper delivery note.",
          6,
        ],
      ];
      for (const [key, note, hoursAgo] of progress) {
        const stage = stageByKey.get(key);
        if (!stage) continue;
        await recordStageTransition({
          tdb,
          order: inFlight,
          stageId: stage.id,
          source: "agency",
          note,
          userId: null,
          occurredAt: new Date(Date.now() - hoursAgo * hour),
        });
      }
      console.log(`✓ demo order ${inFlight.orderNumber} — out for delivery`);

      // --- A completed order, with its proof of delivery -------------------
      const delivered = await tdb.insertOne(orders, {
        shopifyOrderId: "demo-2",
        orderNumber: "#1043",
        customerName: "Vic Smith",
        customerEmail: "vic@example.com",
        shippingAddress: {
          name: "Vic Smith",
          address1: "8 Harbour Road",
          city: "Sydney",
          province: "New South Wales",
          provinceCode: "NSW",
          zip: "2000",
          country: "Australia",
          countryCode: "AU",
        },
        lineItems: [{ title: "Walnut Shelf", quantity: 1, price: "180.00" }],
        orderDate: new Date(Date.now() - 96 * hour),
        total: "180.00",
        currency: "AUD",
        assignedDriverName: "Dave M.",
        trackingToken: randomToken(18),
      });

      await placeOrderInFirstStage({ tdb, order: delivered, firstStage });

      for (const [key, note, hoursAgo] of [
        ["confirmed", "Confirmed and queued for packing.", 90],
        ["processing", "Picked and packed.", 60],
        ["out-for-delivery", "On board with our driver.", 30],
      ] as Array<[string, string, number]>) {
        const stage = stageByKey.get(key);
        if (!stage) continue;
        await recordStageTransition({
          tdb,
          order: delivered,
          stageId: stage.id,
          source: "agency",
          note,
          userId: null,
          occurredAt: new Date(Date.now() - hoursAgo * hour),
        });
      }

      // The proof comes first, exactly as the agency form does it, so the
      // terminal transition can see it.
      const deliveredAt = new Date(Date.now() - 4 * hour);
      await tdb.insertOne(proofOfDelivery, {
        orderId: delivered.id,
        markedDeliveredByUserId: null,
        deliveredAt,
        recipientName: "Vic Smith",
        driverName: "Dave M.",
      });

      const terminal = stageByKey.get("delivered");
      if (terminal) {
        await recordStageTransition({
          tdb,
          order: delivered,
          stageId: terminal.id,
          source: "agency",
          note: "Delivered and signed for at the front door.",
          userId: null,
          occurredAt: deliveredAt,
        });
      }
      console.log(`✓ demo order ${delivered.orderNumber} — delivered`);
    }
  }

  console.log("\nSign in at http://localhost:3000/login");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exit(1);
  });
