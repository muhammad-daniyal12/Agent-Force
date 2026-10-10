import { ID, Query } from "node-appwrite";
import { resourceId } from "../src/lib/server/validation";
import { scriptEnvironment, reportScriptFailure } from "./environment";

const products = [
  ["MOUSE-WL-01", "Wireless Mouse", "Mice", 2499, 120, 10],
  ["MOUSE-ERG-01", "Ergonomic Mouse", "Mice", 3999, 30, 5],
  ["KEY-MECH-01", "Mechanical Keyboard", "Keyboards", 12999, 25, 5],
  ["KEY-WL-01", "Wireless Keyboard", "Keyboards", 7499, 40, 5],
  ["MON-24-01", "24 Inch Monitor", "Monitors", 52999, 20, 3],
  ["MON-27-01", "27 Inch Monitor", "Monitors", 74999, 2, 3],
  ["HUB-USBC-01", "USB-C Hub", "Hubs", 6499, 18, 5],
  ["DOCK-USBC-01", "USB-C Docking Station", "Hubs", 18999, 8, 3],
  ["HEADSET-01", "Office Headset", "Audio", 4999, 25, 5],
  ["WEBCAM-HD-01", "HD Webcam", "Webcams", 4999, 3, 5],
  ["STAND-LAP-01", "Laptop Stand", "Accessories", 3499, 35, 5],
  ["CABLE-USBC-01", "USB-C Cable", "Cables", 999, 100, 15],
  ["CABLE-HDMI-01", "HDMI Cable", "Cables", 899, 80, 10],
  ["SPEAKER-01", "Desktop Speakers", "Audio", 7499, 0, 3],
  ["POWER-01", "Surge Protector", "Accessories", 2499, 4, 5],
] as const;

async function main() {
  const { config, db } = scriptEnvironment();
  const ownerId = resourceId.parse(process.env.SEED_OWNER_USER_ID);
  let added = 0;
  for (const [
    sku,
    name,
    category,
    price,
    stock,
    lowStockThreshold,
  ] of products) {
    const args = { databaseId: config.databaseId, tableId: config.products };
    const existing = await db.listRows({
      ...args,
      queries: [
        Query.equal("owner_user_id", ownerId),
        Query.equal("sku", sku),
        Query.limit(1),
      ],
    });
    if (existing.rows.length) continue; // Never reset live stock or overwrite edited products.
    const transaction = await db.createTransaction({ ttl: 60 });
    try {
      const productId = ID.unique();
      await db.createRow({
        ...args,
        rowId: productId,
        data: {
          owner_user_id: ownerId,
          sku,
          name,
          category,
          price,
          stock,
          lowStockThreshold,
        },
        permissions: [],
        transactionId: transaction.$id,
      });
      await db.createRow({
        databaseId: config.databaseId,
        tableId: config.activity,
        rowId: ID.unique(),
        data: {
          owner_user_id: ownerId,
          actor: "Admin",
          action: "Seeded demo product",
          target: productId,
        },
        permissions: [],
        transactionId: transaction.$id,
      });
      await db.updateTransaction({
        transactionId: transaction.$id,
        commit: true,
      });
      added++;
    } catch (error) {
      try {
        await db.updateTransaction({
          transactionId: transaction.$id,
          rollback: true,
        });
      } catch {}
      throw error;
    }
  }

  // Seed two illustrative suppliers only when missing, without replacing
  // owner-created dealers or changing existing catalog/stock data.
  const dealers = [
    {
      name: "Ali Traders",
      phone: "03001112233",
      email: "orders@alitraders.pk",
      categories: ["Mice", "Keyboards", "Hubs", "Cables", "Accessories"],
    },
    {
      name: "Hafeez Centre Wholesale",
      phone: "03214445566",
      email: "sales@hafeezwholesale.pk",
      categories: ["Monitors", "Audio", "Webcams"],
    },
  ];
  let dealersAdded = 0;
  for (const dealer of dealers) {
    const existing = await db.listRows({
      databaseId: config.databaseId,
      tableId: config.dealers,
      queries: [
        Query.equal("owner_user_id", ownerId),
        Query.limit(100),
      ],
      total: false,
      ttl: 0,
    });
    if (existing.rows.some((row) => row.name === dealer.name)) continue;
    await db.createRow({
      databaseId: config.databaseId,
      tableId: config.dealers,
      rowId: ID.unique(),
      data: { ...dealer, owner_user_id: ownerId },
      permissions: [],
    });
    dealersAdded++;
  }
  console.log("Dealers seed: " + dealersAdded + " added, " + (dealers.length - dealersAdded) + " already existed.");
  console.log(
    `Seed complete: ${added} added, ${products.length - added} already existed. Existing inventory preserved.`,
  );
}

main().catch(reportScriptFailure);
