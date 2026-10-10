import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { appwriteFixture } from "./appwrite-fixture";
import type { OperationRun, Quotation } from "../contracts";
import * as operations from "../../../app/api/operations/run/route";
import * as approve from "../../../app/api/quotations/[id]/approve/route";
import * as quotation from "../../../app/api/quotations/[id]/route";
import * as publicQuote from "../../../app/api/public/quotes/[token]/route";
import * as accept from "../../../app/api/public/quotes/[token]/accept/route";

let fixture: Awaited<ReturnType<typeof appwriteFixture>>;
before(async () => {
  fixture = await appwriteFixture();
  Object.assign(process.env, {
    NODE_ENV: "test",
    APPWRITE_ENDPOINT: fixture.endpoint,
    APPWRITE_PROJECT_ID: "test-project",
    APPWRITE_API_KEY: "test-server-key",
    APP_ORIGIN: "http://localhost:3000",
    LLM_PROVIDER: "none",
    TAX_RATE: "0.18",
    AGENT_RUN_TIMEOUT_MS: "24000",
  });
  delete process.env.TRUST_PROXY_IP_HEADERS;
});
beforeEach(() => {
  fixture.reset();
  fixture.insert("products", "mouse", {
    owner_user_id: "owner-one", sku: "MOUSE", name: "Wireless Mouse",
    category: "Mice", price: 2499, stock: 120, lowStockThreshold: 10,
  });
  fixture.insert("products", "hub", {
    owner_user_id: "owner-one", sku: "HUB", name: "USB-C Hub",
    category: "Hubs", price: 6499, stock: 30, lowStockThreshold: 10,
  });
});
after(async () => fixture.close());

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const tctx = (token: string) => ({ params: Promise.resolve({ token }) });

function ownerRequest(path: string, body: unknown) {
  return new Request("http://localhost:3000" + path, {
    method: "POST",
    headers: {
      Cookie: "agentforce_session=owner-one-session",
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function publicRequest(token: string, method: "GET" | "POST" = "GET", origin?: string) {
  return new Request("http://localhost:3000/api/public/quotes/" + token, {
    method,
    headers: origin !== undefined ? { Origin: origin } : {},
  });
}
async function json<T>(response: Response, status = 200): Promise<T> {
  assert.equal(response.status, status, await response.clone().text());
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return response.json() as Promise<T>;
}
async function approved() {
  const run = await json<OperationRun>(await operations.POST(ownerRequest("/api/operations/run", {
    customerName: "Ali",
    customerEmail: "ali@example.com",
    customerPhone: "+92 300 1234567",
    request: "I need 10 wireless mice and 5 USB-C hubs, my name is Ali, ali@example.com",
  })));
  assert.ok(run.quotation);
  const id = run.quotation.id;
  assert.equal(Object.hasOwn(run.quotation, "shareToken"), false);
  const reviewed = await json<Quotation>(await approve.POST(ownerRequest(
    "/api/quotations/" + id + "/approve", {},
  ), ctx(id)));
  assert.equal(reviewed.status, "approved");
  assert.ok(reviewed.shareToken);
  assert.match(reviewed.shareToken, /^[A-Za-z0-9_-]{64}$/);
  return reviewed;
}

test("approval creates a long random token only for approved quotations", async () => {
  const q = await approved();
  assert.equal(q.customerResponse, null);
  assert.equal(q.respondedAt, undefined);
  assert.equal(fixture.rows.get("quotations/" + q.id)?.shareToken, q.shareToken);
  assert.equal(fixture.rows.get("products/mouse")?.stock, 110);
  assert.equal(fixture.rows.get("products/hub")?.stock, 25);
  await json(await approve.POST(ownerRequest(
    "/api/quotations/" + q.id + "/approve", {},
  ), ctx(q.id)), 409);
  assert.equal(fixture.rows.get("quotations/" + q.id)?.shareToken, q.shareToken);
  const another = await approved();
  assert.notEqual(q.shareToken, another.shareToken);
});

test("unauthenticated public view exposes only safe approved quotation fields", async () => {
  const q = await approved();
  fixture.insert("business_settings", "owner-one", {
    owner_user_id: "owner-one",
    name: "Nova Tech",
    city: "Lahore",
    phone: "+92 300 1234567",
    email: "private-owner@example.com",
  });
  const res = await publicQuote.GET(publicRequest(q.shareToken!), tctx(q.shareToken!));
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
  const view = await json<Record<string, unknown>>(res);
  assert.deepEqual(Object.keys(view).sort(), [
    "businessName", "businessCity", "businessPhone", "quotationNumber",
    "customerName", "items", "subtotal", "discount", "tax", "total",
    "status", "customerResponse", "createdAt",
  ].sort());
  assert.equal(view.businessName, "Nova Tech");
  assert.equal(view.businessCity, "Lahore");
  assert.equal(view.businessPhone, "+92 300 1234567");
  assert.equal(view.customerName, "Ali");
  assert.equal(view.status, "approved");
  assert.equal(view.customerResponse, null);
  assert.equal(view.quotationNumber, "QUO-" + q.id.slice(-6).toUpperCase());
  assert.deepEqual(view.items, q.items.map((item) => ({
    name: item.name, quantity: item.quantity,
    unitPrice: item.unitPrice, total: item.total,
  })));
  const text = JSON.stringify(view);
  for (const secret of [
    "owner_user_id", "owner-one", "private-owner@example.com", q.customerEmail,
    q.customerPhone!, q.shareToken!, "reviewerNote", "productId",
  ]) assert(!text.includes(secret), "public view exposed " + secret);
});

test("accept is same-origin and idempotent; owner DTO and public view reflect acceptance", async () => {
  const q = await approved();
  const token = q.shareToken!;
  await json(await accept.POST(publicRequest(token, "POST"), tctx(token)), 403);
  await json(await accept.POST(publicRequest(token, "POST", "https://bad.example"), tctx(token)), 403);
  assert.equal(fixture.rows.get("quotations/" + q.id)?.respondedAt, undefined);
  const one = await json<{ customerResponse: string; respondedAt: string }>(
    await accept.POST(publicRequest(token, "POST", "http://localhost:3000"), tctx(token)),
  );
  assert.equal(one.customerResponse, "accepted");
  assert.ok(!Number.isNaN(Date.parse(one.respondedAt)));
  const two = await json<typeof one>(
    await accept.POST(publicRequest(token, "POST", "http://localhost:3000"), tctx(token)),
  );
  assert.deepEqual(two, one);
  assert.equal([...fixture.rows].filter(([key, row]) =>
    key.startsWith("activity_logs/") &&
    row.action === "Customer accepted QUO-" + q.id.slice(-6).toUpperCase(),
  ).length, 1);
  const owner = await json<Quotation>(await quotation.GET(
    new Request("http://localhost:3000/api/quotations/" + q.id, {
      headers: { Cookie: "agentforce_session=owner-one-session" },
    }), ctx(q.id),
  ));
  assert.equal(owner.customerResponse, "accepted");
  assert.equal(owner.respondedAt, one.respondedAt);
  const view = await json<Record<string, unknown>>(
    await publicQuote.GET(publicRequest(token), tctx(token)),
  );
  assert.equal(view.customerResponse, "accepted");
});

test("invalid and unknown links are rejected without leaking private details", async () => {
  for (const token of ["short", "x".repeat(64)]) {
    const r = await json<{ error: string }>(
      await publicQuote.GET(publicRequest(token), tctx(token)), 404,
    );
    assert.equal(typeof r.error, "string");
    assert(!JSON.stringify(r).includes("owner_user_id"));
  }
});

test("only approved share tokens can be publicly accepted", async () => {
  const token = "a".repeat(64);
  fixture.insert("quotations", "not-approved", {
    owner_user_id: "owner-one",
    customerName: "Sara",
    customerEmail: "sara@example.com",
    request: "A monitor",
    itemsJson: JSON.stringify([{
      productId: "mouse", name: "Wireless Mouse", quantity: 1,
      unitPrice: 2499, total: 2499, inStock: true,
    }]),
    subtotal: 2499, discount: 0, tax: 450, total: 2949,
    status: "pending", demo_tax_rate: 0.18, shareToken: token,
  });
  await json(await publicQuote.GET(publicRequest(token), tctx(token)), 404);
  await json(await accept.POST(
    publicRequest(token, "POST", "http://localhost:3000"), tctx(token),
  ), 409);
  assert.equal(fixture.rows.get("quotations/not-approved")?.customerResponse, undefined);
  assert.equal([...fixture.rows].filter(([key]) => key.startsWith("activity_logs/")).length, 0);
});

test("public token requests are independently rate limited even without a user session", async () => {
  const q = await approved();
  for (let i = 0; i < 30; i++) {
    await json(await publicQuote.GET(publicRequest(q.shareToken!), tctx(q.shareToken!)));
  }
  await json(await publicQuote.GET(publicRequest(q.shareToken!), tctx(q.shareToken!)), 429);
});
