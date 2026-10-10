import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { appwriteFixture } from "./appwrite-fixture";
import type { Dealer } from "../dealers";
import type { RestockOrder } from "../restock-orders";
import * as dealers from "../../../app/api/dealers/route";
import * as dealer from "../../../app/api/dealers/[id]/route";
import * as restock from "../../../app/api/restock-orders/route";
import * as sent from "../../../app/api/restock-orders/mark-sent/route";

let fixture: Awaited<ReturnType<typeof appwriteFixture>>;
before(async () => {
  fixture = await appwriteFixture();
  Object.assign(process.env, {
    NODE_ENV: "test",
    APPWRITE_ENDPOINT: fixture.endpoint,
    APPWRITE_PROJECT_ID: "test-project",
    APPWRITE_API_KEY: "test-server-key",
    APP_ORIGIN: "http://localhost:3000",
  });
});
beforeEach(() => {
  fixture.reset();
  fixture.insert("products", "mouse", {
    owner_user_id: "owner-one", sku: "MOUSE", name: "Wireless Mouse",
    category: "Mice", price: 2499, stock: 3, lowStockThreshold: 10,
  });
  fixture.insert("products", "camera", {
    owner_user_id: "owner-one", sku: "CAM", name: "HD Webcam",
    category: "Webcams", price: 4999, stock: 0, lowStockThreshold: 3,
  });
  fixture.insert("products", "healthy", {
    owner_user_id: "owner-one", sku: "HEALTHY", name: "Healthy Product",
    category: "Accessories", price: 1000, stock: 11, lowStockThreshold: 10,
  });
  fixture.insert("products", "foreign-product", {
    owner_user_id: "owner-two", sku: "FOREIGN", name: "Private Product",
    category: "Private", price: 1000, stock: 0, lowStockThreshold: 10,
  });
});
after(async () => fixture.close());

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function req(
  path: string,
  method = "GET",
  value?: unknown,
  owner: string | null = "owner-one",
  origin = "http://localhost:3000",
) {
  return new Request("http://localhost:3000" + path, {
    method,
    headers: {
      ...(owner ? { Cookie: "agentforce_session=" + owner + "-session" } : {}),
      ...(method !== "GET" ? { Origin: origin } : {}),
      ...(value !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
  });
}
async function json<T>(res: Response, status = 200): Promise<T> {
  assert.equal(res.status, status, await res.clone().text());
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  return res.json() as Promise<T>;
}
const input = {
  name: "Ali Traders",
  phone: "+92 (300) 111-2233",
  email: "orders@example.pk",
  categories: ["Mice", "Cables"],
};
async function add() {
  return json<Dealer>(await dealers.POST(req("/api/dealers", "POST", input)), 201);
}

test("dealers and orders require sessions and authorize write Origin", async () => {
  for (const r of [
    await dealers.GET(req("/api/dealers", "GET", undefined, null)),
    await dealers.POST(req("/api/dealers", "POST", input, null)),
    await dealer.PATCH(req("/api/dealers/dealer1", "PATCH", { name: "Bad" }, null), ctx("dealer1")),
    await dealer.DELETE(req("/api/dealers/dealer1", "DELETE", undefined, null), ctx("dealer1")),
    await restock.GET(req("/api/restock-orders", "GET", undefined, null)),
    await sent.POST(req("/api/restock-orders/mark-sent", "POST", { dealerId: "dealer1", productIds: ["mouse"] }, null)),
  ]) await json(r, 401);
  await json(await dealers.POST(req("/api/dealers", "POST", input, "owner-one", "https://bad.example")), 403);
  await json(await sent.POST(req("/api/restock-orders/mark-sent", "POST", { dealerId: "dealer1", productIds: ["mouse"] }, "owner-one", "https://bad.example")), 403);
  assert.equal([...fixture.rows.keys()].filter((key) => key.startsWith("dealers/") || key.startsWith("restock_orders/")).length, 0);
});

test("dealers CRUD preserves array categories and only exposes own rows", async () => {
  const created = await add();
  assert.equal(created.name, "Ali Traders");
  assert.equal(created.phone, "923001112233");
  assert.deepEqual(created.categories, ["Mice", "Cables"]);
  assert.equal(created.email, "orders@example.pk");
  assert.equal(typeof created.createdAt, "string");
  assert.equal(typeof created.updatedAt, "string");
  assert.equal(fixture.rows.get("dealers/" + created.id)?.owner_user_id, "owner-one");
  assert.deepEqual(fixture.rows.get("dealers/" + created.id)?.$permissions, []);
  assert.deepEqual(await json<Dealer[]>(await dealers.GET(req("/api/dealers"))), [created]);
  const updated = await json<Dealer>(await dealer.PATCH(
    req("/api/dealers/" + created.id, "PATCH", { name: "  New Supplier ", categories: [] }),
    ctx(created.id),
  ));
  assert.equal(updated.name, "New Supplier");
  assert.deepEqual(updated.categories, []);
  assert.equal(updated.phone, created.phone);
  assert.deepEqual(await json<Dealer[]>(await dealers.GET(req("/api/dealers", "GET", undefined, "owner-two")), []);
  await json(await dealer.PATCH(
    req("/api/dealers/" + created.id, "PATCH", { name: "Attack" }, "owner-two"), ctx(created.id),
  ), 404);
  await json(await dealer.DELETE(
    req("/api/dealers/" + created.id, "DELETE", undefined, "owner-two"), ctx(created.id),
  ), 404);
  assert.deepEqual(await json(await dealer.DELETE(
    req("/api/dealers/" + created.id, "DELETE"), ctx(created.id),
  )), { ok: true });
  await json(await dealer.DELETE(req("/api/dealers/" + created.id, "DELETE"), ctx(created.id)), 404);
  assert.equal(fixture.rows.has("dealers/" + created.id), false);
});

test("dealer validation rejects invalid phone, email, categories and owner injection", async () => {
  const invalid = [
    { ...input, name: "" },
    { ...input, phone: "123" },
    { ...input, phone: "1234567890123456" },
    { ...input, phone: "12345hello678" },
    { ...input, email: "bad-email" },
    { ...input, categories: ["Mice", "mice"] },
    { ...input, categories: ["x".repeat(101)] },
    { ...input, owner_user_id: "owner-two" },
  ];
  for (const entry of invalid) await json(await dealers.POST(req("/api/dealers", "POST", entry)), 422);
  assert.equal([...fixture.rows.keys()].filter((key) => key.startsWith("dealers/")).length, 0);
  const created = await add();
  await json(await dealer.PATCH(req("/api/dealers/" + created.id, "PATCH", {}), ctx(created.id)), 422);
  await json(await dealer.PATCH(req("/api/dealers/" + created.id, "PATCH", { owner_user_id: "owner-two" }), ctx(created.id)), 422);
});

test("mark-sent stores correct reorder quantities and an audited record", async () => {
  const d = await add();
  const result = await json<{ ok: boolean }>(await sent.POST(req("/api/restock-orders/mark-sent", "POST", {
    dealerId: d.id, productIds: ["mouse", "camera"],
  })));
  assert.deepEqual(result, { ok: true });
  const orders = await json<RestockOrder[]>(await restock.GET(req("/api/restock-orders?status=sent")));
  assert.equal(orders.length, 1);
  assert.equal(orders[0].dealerId, d.id);
  assert.equal(orders[0].status, "sent");
  assert.deepEqual(orders[0].items, [
    { productId: "mouse", quantity: 40 },
    { productId: "camera", quantity: 15 },
  ]);
  assert.ok(orders[0].sentAt);
  assert.equal(fixture.rows.get("restock_orders/" + orders[0].id)?.owner_user_id, "owner-one");
  assert.deepEqual(fixture.rows.get("restock_orders/" + orders[0].id)?.$permissions, []);
  const log = [...fixture.rows].find(([k, v]) => k.startsWith("activity_logs/") && v.action === "Admin sent restock order to Ali Traders");
  assert.ok(log);
  assert.equal(fixture.rows.get("products/mouse")?.stock, 3, "mark-sent must NOT receive or deduct stock");
  assert.equal(fixture.rows.get("products/camera")?.stock, 0);
  const old = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const future = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal((await json<RestockOrder[]>(await restock.GET(req("/api/restock-orders?status=sent&since=" + encodeURIComponent(old))))).length, 1);
  assert.equal((await json<RestockOrder[]>(await restock.GET(req("/api/restock-orders?status=sent&since=" + encodeURIComponent(future))))).length, 0);
  assert.deepEqual(await json(await restock.GET(req("/api/restock-orders?status=draft"))), []);
  assert.deepEqual(await json(await restock.GET(req("/api/restock-orders", "GET", undefined, "owner-two"))), []);
});

test("restock mark-sent rejects other owner's resources, malformed and healthy products", async () => {
  const dealerOne = await add();
  const foreign = await json<Dealer>(await dealers.POST(req("/api/dealers", "POST", {
    name: "Private Supplier", phone: "03001234567",
  }, "owner-two")), 201);
  for (const bad of [
    { dealerId: foreign.id, productIds: ["mouse"] },
    { dealerId: dealerOne.id, productIds: ["foreign-product"] },
    { dealerId: dealerOne.id, productIds: ["mouse", "foreign-product"] },
    { dealerId: dealerOne.id, productIds: ["healthy"] },
    { dealerId: dealerOne.id, productIds: ["mouse", "mouse"] },
    { dealerId: dealerOne.id, productIds: [] },
  ]) {
    const res = await sent.POST(req("/api/restock-orders/mark-sent", "POST", bad));
    await json(res, (bad.dealerId === foreign.id || bad.productIds.includes("foreign-product") ? 404 : 422));
  }
  assert.equal([...fixture.rows.keys()].filter((key) => key.startsWith("restock_orders/")).length, 0);
});

test("restock query rejects unsupported filters and invalid ISO dates", async () => {
  await json(await restock.GET(req("/api/restock-orders?owner_user_id=owner-two")), 400);
  await json(await restock.GET(req("/api/restock-orders?status=something")), 422);
  await json(await restock.GET(req("/api/restock-orders?since=tomorrow")), 422);
});
