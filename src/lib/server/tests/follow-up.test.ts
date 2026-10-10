import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { appwriteFixture } from "./appwrite-fixture";
import type { Quotation } from "../contracts";
import * as followUp from "../../../app/api/quotations/[id]/follow-up/route";
import * as quotations from "../../../app/api/quotations/route";
import * as quotation from "../../../app/api/quotations/[id]/route";
import * as approve from "../../../app/api/quotations/[id]/approve/route";

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
  const base = {
    customerName: "Ali",
    customerEmail: "ali@example.com",
    request: "Need one wireless mouse",
    itemsJson: JSON.stringify([
      {
        productId: "mouse",
        name: "Wireless Mouse",
        quantity: 1,
        unitPrice: 2499,
        total: 2499,
        inStock: true,
      },
    ]),
    subtotal: 2499,
    discount: 0,
    tax: 450,
    total: 2949,
    status: "approved",
    demo_tax_rate: 0.18,
  };
  fixture.insert("quotations", "quote-1", {
    ...base,
    owner_user_id: "owner-one",
  });
  fixture.insert("quotations", "quote-2", {
    ...base,
    customerName: "Sara",
    owner_user_id: "owner-two",
  });
});
after(async () => fixture.close());

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function req(
  id: string,
  method: "GET" | "POST" = "POST",
  owner: string | null = "owner-one",
  origin = "http://localhost:3000",
) {
  return new Request(`http://localhost:3000/api/quotations/\${id}/follow-up`, {
    method,
    headers: {
      ...(owner ? { Cookie: `agentforce_session=\${owner}-session` } : {}),
      ...(method === "POST" ? { Origin: origin } : {}),
    },
  });
}
function getReq(path: string, owner = "owner-one") {
  return new Request("http://localhost:3000" + path, {
    headers: { Cookie: `agentforce_session=\${owner}-session` },
  });
}
async function body<T>(response: Response, status = 200): Promise<T> {
  assert.equal(response.status, status, await response.clone().text());
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return response.json() as Promise<T>;
}
const auditRows = () => [...fixture.rows].filter(([key, row]) =>
  key.startsWith("activity_logs/") &&
  row.action === "Admin followed up with Ali",
);

test("follow-up requires session, same origin, and valid owner scoped ID", async () => {
  await body(await followUp.POST(req("quote-1", "POST", null), ctx("quote-1")), 401);
  await body(await followUp.POST(req("quote-1", "POST", "owner-one", "https://attacker.example"), ctx("quote-1")), 403);
  await body(await followUp.POST(req("quote-1", "POST", "owner-two"), ctx("quote-1")), 404);
  await body(await followUp.POST(req("quote-2"), ctx("quote-2")), 404);
  await body(await followUp.POST(req("nonexistent"), ctx("nonexistent")), 404);
  await body(await followUp.POST(req("@invalid"), ctx("@invalid")), 422);
  assert.equal(auditRows().length, 0);
  assert.equal(fixture.rows.get("quotations/quote-1")?.followedUpAt, undefined);
  assert.equal(followUp.GET().status, 405);
});

test("follow-up saves timestamp, audits once and replays without changing timestamp", async () => {
  const first = await body<Quotation>(await followUp.POST(req("quote-1"), ctx("quote-1")));
  assert.equal(first.status, "approved");
  assert.equal(first.customerName, "Ali");
  assert.ok(first.followedUpAt);
  assert.ok(!Number.isNaN(Date.parse(first.followedUpAt)));
  assert.equal(fixture.rows.get("quotations/quote-1")?.followedUpAt, first.followedUpAt);
  assert.equal(auditRows().length, 1);
  const again = await body<Quotation>(await followUp.POST(req("quote-1"), ctx("quote-1")));
  assert.equal(again.followedUpAt, first.followedUpAt);
  assert.equal(auditRows().length, 1);
  const fetched = await body<Quotation>(
    await quotation.GET(getReq("/api/quotations/quote-1"), ctx("quote-1")),
  );
  assert.equal(fetched.followedUpAt, first.followedUpAt);
  const listed = await body<Quotation[]>(await quotations.GET(getReq("/api/quotations")));
  assert.equal(listed[0].followedUpAt, first.followedUpAt);
  assert.equal(Object.hasOwn(listed[0], "owner_user_id"), false);
  assert.equal((await body<Quotation[]>(
    await quotations.GET(getReq("/api/quotations", "owner-two")),
  )).some((q) => q.id === "quote-1"), false);
});

test("existing quotations stay backward compatible when not followed up", async () => {
  const listed = await body<Quotation[]>(await quotations.GET(getReq("/api/quotations")));
  assert.equal(listed.length, 1);
  assert.equal(Object.hasOwn(listed[0], "followedUpAt"), false);
  const foreign = await body<Quotation>(
    await quotation.GET(getReq("/api/quotations/quote-2", "owner-two"), ctx("quote-2")),
  );
  assert.equal(Object.hasOwn(foreign, "followedUpAt"), false);
});

test("a followed-up quote retains timestamp when already reviewed", async () => {
  const result = await body<Quotation>(await followUp.POST(req("quote-1"), ctx("quote-1")));
  assert.ok(result.followedUpAt);
  assert.equal(result.status, "approved");
  await body(await approve.POST(new Request("http://localhost:3000/api/quotations/quote-1/approve", {
    method: "POST",
    headers: {
      Cookie: "agentforce_session=owner-one-session",
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: "{}",
  }), ctx("quote-1")), 409);
  assert.equal(fixture.rows.get("quotations/quote-1")?.followedUpAt, result.followedUpAt);
  assert.equal(auditRows().length, 1);
});
