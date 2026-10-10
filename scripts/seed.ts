import { ID, Query } from "node-appwrite";
import { resourceId } from "../src/lib/server/validation";
import { scriptEnvironment, reportScriptFailure } from "./environment";

const products = [
  ["MOUSE-WL-01", "Wireless Mouse", "Mice", 29.99, 120, 10],
  ["MOUSE-ERG-01", "Ergonomic Mouse", "Mice", 49.99, 30, 5],
  ["KEY-MECH-01", "Mechanical Keyboard", "Keyboards", 89.99, 25, 5],
  ["KEY-WL-01", "Wireless Keyboard", "Keyboards", 59.99, 40, 5],
  ["MON-24-01", "24 Inch Monitor", "Monitors", 179.99, 20, 3],
  ["MON-27-01", "27 Inch Monitor", "Monitors", 279.99, 2, 3],
  ["HUB-USBC-01", "USB-C Hub", "Hubs", 79.99, 18, 5],
  ["DOCK-USBC-01", "USB-C Docking Station", "Hubs", 149.99, 8, 3],
  ["HEADSET-01", "Office Headset", "Audio", 69.99, 25, 5],
  ["WEBCAM-HD-01", "HD Webcam", "Webcams", 49.99, 3, 5],
  ["STAND-LAP-01", "Laptop Stand", "Accessories", 39.99, 35, 5],
  ["CABLE-USBC-01", "USB-C Cable", "Cables", 12.99, 100, 15],
  ["CABLE-HDMI-01", "HDMI Cable", "Cables", 9.99, 80, 10],
  ["SPEAKER-01", "Desktop Speakers", "Audio", 59.99, 0, 3],
  ["POWER-01", "Surge Protector", "Accessories", 24.99, 4, 5],
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
    const transaction = await db.createTransaction({ ttl: 30 });
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
  console.log(
    `Seed complete: ${added} added, ${products.length - added} already existed. Existing inventory preserved.`,
  );
}

main().catch(reportScriptFailure);
