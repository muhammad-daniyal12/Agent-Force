import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { appwriteFixture } from "./appwrite-fixture";
import type {
  Agent,
  ActivityLog,
  DashboardStats,
  Product,
  OperationRun,
  Quotation,
} from "../contracts";
import * as products from "../../../app/api/products/route";
import * as product from "../../../app/api/products/[id]/route";
import * as quotations from "../../../app/api/quotations/route";
import * as quotation from "../../../app/api/quotations/[id]/route";
import * as approve from "../../../app/api/quotations/[id]/approve/route";
import * as reject from "../../../app/api/quotations/[id]/reject/route";
import * as operations from "../../../app/api/operations/run/route";
import * as activity from "../../../app/api/activity/route";
import * as dashboard from "../../../app/api/dashboard/route";
import * as agents from "../../../app/api/agents/route";
import * as login from "../../../app/api/auth/login/route";
import * as logout from "../../../app/api/auth/logout/route";
import * as me from "../../../app/api/auth/me/route";

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
    TAX_RATE: "0.08",
    AGENT_RUN_TIMEOUT_MS: "24000",
  });
});
beforeEach(() => {
  fixture.reset();
  fixture.insert("products", "mouse", {
    owner_user_id: "owner-one",
    sku: "MOUSE-WL-01",
    name: "Wireless Mouse",
    category: "Mice",
    price: 29.99,
    stock: 120,
    lowStockThreshold: 10,
  });
  fixture.insert("products", "hub", {
    owner_user_id: "owner-one",
    sku: "HUB-USBC-01",
    name: "USB-C Hub",
    category: "Hubs",
    price: 79.99,
    stock: 18,
    lowStockThreshold: 5,
  });
  fixture.insert("products", "foreign", {
    owner_user_id: "owner-two",
    sku: "PRIVATE",
    name: "Private Product",
    category: "Private",
    price: 1,
    stock: 30,
    lowStockThreshold: 2,
  });
});
after(async () => {
  await fixture.close();
});

const context = (id: string) => ({ params: Promise.resolve({ id }) });
function request(
  path: string,
  method = "GET",
  body?: unknown,
  owner: string | null = "owner-one",
  extra: Record<string, string> = {},
) {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: {
      ...(owner ? { Cookie: `agentforce_session=${owner}-session` } : {}),
      ...(method !== "GET" ? { Origin: "http://localhost:3000" } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function body<T>(response: Response, status = 200): Promise<T> {
  assert.equal(response.status, status, await response.clone().text());
  assert.match(response.headers.get("content-type")!, /application\/json/);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  return response.json() as Promise<T>;
}
const demo = {
  customerName: "Ali",
  customerEmail: "ali@example.com",
  request:
    "I need 10 wireless mice and 5 USB-C hubs, my name is Ali, ali@example.com",
};
async function run(key?: string) {
  return body<OperationRun>(
    await operations.POST(
      request(
        "/api/operations/run",
        "POST",
        demo,
        "owner-one",
        key ? { "Idempotency-Key": key } : {},
      ),
    ),
  );
}

test("all protected endpoints reject anonymous requests with JSON 401", async () => {
  const calls = [
    products.GET(request("/api/products", "GET", undefined, null)),
    products.POST(request("/api/products", "POST", {}, null)),
    product.PATCH(
      request("/api/products/mouse", "PATCH", {}, null),
      context("mouse"),
    ),
    product.DELETE(
      request("/api/products/mouse", "DELETE", undefined, null),
      context("mouse"),
    ),
    quotations.GET(request("/api/quotations", "GET", undefined, null)),
    quotation.GET(
      request("/api/quotations/unknown", "GET", undefined, null),
      context("unknown"),
    ),
    approve.POST(
      request("/api/quotations/unknown/approve", "POST", {}, null),
      context("unknown"),
    ),
    reject.POST(
      request("/api/quotations/unknown/reject", "POST", {}, null),
      context("unknown"),
    ),
    operations.POST(request("/api/operations/run", "POST", demo, null)),
    activity.GET(request("/api/activity", "GET", undefined, null)),
    dashboard.GET(request("/api/dashboard", "GET", undefined, null)),
    agents.GET(request("/api/agents", "GET", undefined, null)),
    me.GET(request("/api/auth/me", "GET", undefined, null)),
  ];
  for (const response of await Promise.all(calls))
    assert.equal(
      typeof (await body<{ error: string }>(response, 401)).error,
      "string",
    );
  assert.equal(fixture.calls.length, 0);
});

test("the full fallback demo respects DTOs, approval, stock, dashboard and activity", async () => {
  const listed = await body<Product[]>(
    await products.GET(request("/api/products?q=wireless")),
  );
  assert.deepEqual(
    listed.map((value) => value.id),
    ["mouse"],
  );
  assert.deepEqual(
    Object.keys(listed[0]).sort(),
    [
      "id",
      "sku",
      "name",
      "category",
      "price",
      "stock",
      "lowStockThreshold",
      "updatedAt",
    ].sort(),
  );
  const operation = await run();
  assert.equal(operation.steps.length, 3);
  assert(
    operation.steps.every(
      (step) => step.title.includes("(fallback)") && step.status === "done",
    ),
  );
  const quote = operation.quotation!;
  assert.equal(quote.status, "pending");
  assert.deepEqual(
    quote.items.map((item) => [item.productId, item.quantity]),
    [
      ["mouse", 10],
      ["hub", 5],
    ],
  );
  assert.equal(quote.subtotal, 700);
  assert.equal(quote.discount, 0);
  assert.equal(quote.tax, 56);
  assert.equal(quote.total, 756);
  assert.equal(fixture.rows.get("products/mouse")!.stock, 120);
  assert.deepEqual(
    Object.keys(operation).sort(),
    ["id", "steps", "quotation", "summary"].sort(),
  );
  const pending = await body<Quotation[]>(
    await quotations.GET(request("/api/quotations?status=pending")),
  );
  assert.equal(pending.length, 1);
  assert.equal(
    (
      await body<Quotation>(
        await quotation.GET(
          request(`/api/quotations/${quote.id}`),
          context(quote.id),
        ),
      )
    ).id,
    quote.id,
  );
  const reviewed = await body<Quotation>(
    await approve.POST(
      request(`/api/quotations/${quote.id}/approve`, "POST", {
        note: "Approved by owner",
      }),
      context(quote.id),
    ),
  );
  assert.equal(reviewed.status, "approved");
  assert.equal(reviewed.reviewerNote, "Approved by owner");
  assert.equal(fixture.rows.get("products/mouse")!.stock, 110);
  assert.equal(fixture.rows.get("products/hub")!.stock, 13);
  await body(
    await approve.POST(
      request(`/api/quotations/${quote.id}/approve`, "POST", {}),
      context(quote.id),
    ),
    409,
  );
  assert.equal(fixture.rows.get("products/mouse")!.stock, 110);
  const stats = await body<DashboardStats>(
    await dashboard.GET(request("/api/dashboard")),
  );
  assert.deepEqual(stats, {
    totalQuotations: 1,
    pendingApprovals: 0,
    approvedValue: 756,
    lowStockCount: 0,
    activeAgents: 3,
  });
  const employees = await body<Agent[]>(
    await agents.GET(request("/api/agents")),
  );
  assert.deepEqual(
    employees.map((agent) => agent.tasksCompleted),
    [1, 1, 1],
  );
  const logs = await body<ActivityLog[]>(
    await activity.GET(request("/api/activity?limit=20")),
  );
  assert(
    logs.some(
      (log) => log.action === "Approved quotation" && log.actor === "Admin",
    ),
  );
  assert(logs.some((log) => log.actor === "Support Agent"));
  assert(!JSON.stringify({ operation, logs, stats }).includes("owner_user_id"));
  for (const row of fixture.rows.values())
    assert.deepEqual(row.$permissions, []);
  const authCalls = fixture.calls.filter((call) => call.path === "/account");
  assert(
    authCalls.every(
      (call) => !call.key && call.session === "owner-one-session",
    ),
  );
});

test("products CRUD is owner scoped, audited, and rejects ownership injection", async () => {
  const input = {
    sku: "test-keyboard",
    name: "Test Keyboard",
    category: "Keyboards",
    price: 39.99,
    stock: 20,
    lowStockThreshold: 3,
  };
  const created = await body<Product>(
    await products.POST(request("/api/products", "POST", input)),
    201,
  );
  assert.equal(created.sku, "TEST-KEYBOARD");
  const changed = await body<Product>(
    await product.PATCH(
      request(`/api/products/${created.id}`, "PATCH", { stock: 15 }),
      context(created.id),
    ),
  );
  assert.equal(changed.stock, 15);
  await body(
    await product.PATCH(
      request(`/api/products/${created.id}`, "PATCH", {
        owner_user_id: "owner-two",
      }),
      context(created.id),
    ),
    422,
  );
  await body(
    await product.PATCH(
      request("/api/products/foreign", "PATCH", { stock: 0 }),
      context("foreign"),
    ),
    404,
  );
  await body(
    await product.DELETE(
      request("/api/products/foreign", "DELETE"),
      context("foreign"),
    ),
    404,
  );
  assert.equal(fixture.rows.get("products/foreign")!.stock, 30);
  await body(await products.POST(request("/api/products", "POST", input)), 409);
  assert.deepEqual(
    await body(
      await product.DELETE(
        request(`/api/products/${created.id}`, "DELETE"),
        context(created.id),
      ),
    ),
    { ok: true },
  );
  assert(!fixture.rows.has(`products/${created.id}`));
  const logs = await body<ActivityLog[]>(
    await activity.GET(request("/api/activity")),
  );
  assert.equal(logs.length, 3);
});

test("a second authenticated owner cannot read or decide the first owner's quote", async () => {
  const quote = (await run()).quotation!;
  assert.deepEqual(
    await body(
      await quotations.GET(
        request("/api/quotations", "GET", undefined, "owner-two"),
      ),
    ),
    [],
  );
  for (const handler of [approve.POST, reject.POST])
    await body(
      await handler(
        request(`/api/quotations/${quote.id}/approve`, "POST", {}, "owner-two"),
        context(quote.id),
      ),
      404,
    );
  await body(
    await quotation.GET(
      request(`/api/quotations/${quote.id}`, "GET", undefined, "owner-two"),
      context(quote.id),
    ),
    404,
  );
  assert.equal(fixture.rows.get(`quotations/${quote.id}`)!.status, "pending");
  assert.equal(fixture.rows.get("products/mouse")!.stock, 120);
});

test("rejection stores its note without deducting stock", async () => {
  const quote = (await run()).quotation!;
  const result = await body<Quotation>(
    await reject.POST(
      request(`/api/quotations/${quote.id}/reject`, "POST", {
        note: "Customer needs another model",
      }),
      context(quote.id),
    ),
  );
  assert.equal(result.status, "rejected");
  assert.equal(result.reviewerNote, "Customer needs another model");
  assert.equal(fixture.rows.get("products/mouse")!.stock, 120);
  await body(
    await approve.POST(
      request(`/api/quotations/${quote.id}/approve`, "POST", {}),
      context(quote.id),
    ),
    409,
  );
});

test("simultaneous approvals deduct once; a competing review returns 409", async () => {
  const quote = (await run()).quotation!;
  const results = await Promise.all([
    approve.POST(
      request(`/api/quotations/${quote.id}/approve`, "POST", {}),
      context(quote.id),
    ),
    approve.POST(
      request(`/api/quotations/${quote.id}/approve`, "POST", {}),
      context(quote.id),
    ),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(fixture.rows.get("products/mouse")!.stock, 110);
  const logs = [...fixture.rows].filter(
    ([key, row]) =>
      key.startsWith("activity_logs/") && row.action === "Approved quotation",
  );
  assert.equal(logs.length, 1);
});

test("insufficient live stock rolls back the decision and every audit change", async () => {
  const quote = (await run()).quotation!;
  fixture.insert("products", "hub", {
    ...fixture.rows.get("products/hub"),
    stock: 4,
  });
  const count = [...fixture.rows.keys()].filter((key) =>
    key.startsWith("activity_logs/"),
  ).length;
  await body(
    await approve.POST(
      request(`/api/quotations/${quote.id}/approve`, "POST", {}),
      context(quote.id),
    ),
    409,
  );
  assert.equal(fixture.rows.get(`quotations/${quote.id}`)!.status, "pending");
  assert.equal(fixture.rows.get("products/mouse")!.stock, 120);
  assert.equal(fixture.rows.get("products/hub")!.stock, 4);
  assert.equal(
    [...fixture.rows.keys()].filter((key) => key.startsWith("activity_logs/"))
      .length,
    count,
  );
});

test("idempotent workflow replay preserves one run/quote and detects changed input", async () => {
  const first = await run("demo-retry");
  const replay = await run("demo-retry");
  assert.equal(first.id, replay.id);
  assert.equal(first.quotation!.id, replay.quotation!.id);
  await body(
    await operations.POST(
      request(
        "/api/operations/run",
        "POST",
        { ...demo, request: "I need 2 mice" },
        "owner-one",
        { "Idempotency-Key": "demo-retry" },
      ),
    ),
    409,
  );
  assert.equal(
    [...fixture.rows.keys()].filter((key) => key.startsWith("quotations/"))
      .length,
    1,
  );
});

test("unsupported requests and unmatched products return friendly runs without quotes", async () => {
  for (const message of [
    "My mouse is broken, I want a refund",
    "I need 2 unicorn computers",
  ]) {
    const result = await body<OperationRun>(
      await operations.POST(
        request("/api/operations/run", "POST", { ...demo, request: message }),
      ),
    );
    assert.equal(result.quotation, null);
    assert(result.summary.length > 10);
  }
  assert.equal(
    [...fixture.rows.keys()].filter((key) => key.startsWith("quotations/"))
      .length,
    0,
  );
});

test("malformed inputs, CSRF, unsupported methods and spoofed server keys stay safe", async () => {
  await body(
    await products.POST(
      request("/api/products", "POST", {}, "owner-one", {
        Origin: "https://attacker.example",
      }),
    ),
    403,
  );
  await body(
    await products.GET(request("/api/products?owner_user_id=owner-two")),
    400,
  );
  await body(await activity.GET(request("/api/activity?limit=101")), 422);
  const invalid = new Request("http://localhost:3000/api/products", {
    method: "POST",
    headers: {
      Cookie: "agentforce_session=owner-one-session",
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: "{",
  });
  await body(await products.POST(invalid), 400);
  const oversized = new Request("http://localhost:3000/api/products", {
    method: "POST",
    headers: {
      Cookie: "agentforce_session=owner-one-session",
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "x".repeat(33000) }),
  });
  await body(await products.POST(oversized), 413);
  await body(
    await products.GET(
      request("/api/products", "GET", undefined, "owner-one", {
        "x-appwrite-key": "attacker-key",
      }),
    ),
  );
  assert(!fixture.calls.some((call) => call.key === "attacker-key"));
  const unsupported = products.DELETE();
  assert.equal(unsupported.status, 405);
  assert.equal(typeof (await unsupported.json()).error, "string");
});

test("login creates an HTTP-only session, me verifies it, and logout revokes it", async () => {
  const response = await login.POST(
    request(
      "/api/auth/login",
      "POST",
      { email: "owner-one@example.com", password: "demo-password" },
      null,
    ),
  );
  const data = await body<{ data: { user: { id: string } } }>(response);
  assert.equal(data.data.user.id, "owner-one");
  const cookie = response.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert(!JSON.stringify(data).includes("owner-one-session"));
  await body(await me.GET(request("/api/auth/me")));
  await body(await logout.POST(request("/api/auth/logout", "POST")));
  await body(await me.GET(request("/api/auth/me")), 401);
  await body(
    await login.POST(
      request(
        "/api/auth/login",
        "POST",
        { email: "owner-one@example.com", password: "wrong-password" },
        null,
      ),
    ),
    401,
  );
});

test("Appwrite Sites uses the injected regional configuration and per-request key", async () => {
  Object.assign(process.env, {
    APPWRITE_SITE_ID: "test-site",
    APPWRITE_SITE_API_ENDPOINT: fixture.endpoint,
    APPWRITE_SITE_PROJECT_ID: "test-project",
    APPWRITE_API_KEY: "",
  });
  try {
    const result = await body<Product[]>(
      await products.GET(
        request("/api/products", "GET", undefined, "owner-one", {
          "x-appwrite-key": "test-server-key",
        }),
      ),
    );
    assert.equal(result.length, 2);
    assert(!JSON.stringify(result).includes("test-server-key"));
  } finally {
    delete process.env.APPWRITE_SITE_ID;
    delete process.env.APPWRITE_SITE_API_ENDPOINT;
    delete process.env.APPWRITE_SITE_PROJECT_ID;
    process.env.APPWRITE_API_KEY = "test-server-key";
  }
});

test("optional customerPhone persists through operation, owner quote views and approval", async () => {
  const operation = await body<OperationRun>(
    await operations.POST(request("/api/operations/run", "POST", {
      ...demo, customerPhone: "+92 (300) 123-4567",
    })),
  );
  const quote = operation.quotation!;
  assert.equal(quote.customerPhone, "923001234567");
  assert.equal(fixture.rows.get(`quotations/${quote.id}`)?.customerPhone, "923001234567");
  const list = await body<Quotation[]>(await quotations.GET(request("/api/quotations")));
  assert.equal(list[0].customerPhone, "923001234567");
  const fetched = await body<Quotation>(
    await quotation.GET(request(`/api/quotations/${quote.id}`), context(quote.id)),
  );
  assert.equal(fetched.customerPhone, "923001234567");
  const approved = await body<Quotation>(
    await approve.POST(request(`/api/quotations/${quote.id}/approve`, "POST", {}), context(quote.id)),
  );
  assert.equal(approved.customerPhone, "923001234567");
  await body(
    await quotation.GET(
      request(`/api/quotations/${quote.id}`, "GET", undefined, "owner-two"),
      context(quote.id),
    ),
    404,
  );
});

test("legacy and no-phone quotations keep the original DTO shape", async () => {
  const quote = (await run()).quotation!;
  assert.equal(Object.hasOwn(quote, "customerPhone"), false);
  const rejected = await body<Quotation>(
    await reject.POST(request(`/api/quotations/${quote.id}/reject`, "POST", {}), context(quote.id)),
  );
  assert.equal(Object.hasOwn(rejected, "customerPhone"), false);
  const fromList = await body<Quotation[]>(await quotations.GET(request("/api/quotations")));
  assert.equal(Object.hasOwn(fromList[0], "customerPhone"), false);
});

test("customerPhone validation rejects malformed numbers and normalizes valid ones", async () => {
  for (const customerPhone of ["123456789", "1234567890123456", "+92 abc 0300", "0300+1234567", "1".repeat(41)]) {
    await body(
      await operations.POST(request("/api/operations/run", "POST", { ...demo, customerPhone })),
      422,
    );
  }
  assert.equal([...fixture.rows.keys()].filter((key) => key.startsWith("quotations/")).length, 0);
  const quote = (await body<OperationRun>(await operations.POST(
    request("/api/operations/run", "POST", { ...demo, customerPhone: "" }),
  ))).quotation!;
  assert.equal(Object.hasOwn(quote, "customerPhone"), false);
});

test("normalized phone is covered by operation idempotency", async () => {
  const key = "phone-retry";
  const first = await body<OperationRun>(await operations.POST(
    request("/api/operations/run", "POST", { ...demo, customerPhone: "+92 300 1234567" }, "owner-one", { "Idempotency-Key": key }),
  ));
  const same = await body<OperationRun>(await operations.POST(
    request("/api/operations/run", "POST", { ...demo, customerPhone: "923001234567" }, "owner-one", { "Idempotency-Key": key }),
  ));
  assert.equal(first.id, same.id);
  assert.equal(same.quotation?.customerPhone, "923001234567");
  await body(await operations.POST(
    request("/api/operations/run", "POST", { ...demo, customerPhone: "03001234567" }, "owner-one", { "Idempotency-Key": key }),
  ), 409);
});
