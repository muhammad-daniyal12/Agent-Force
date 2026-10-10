import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { appwriteFixture } from "./appwrite-fixture";
import * as settings from "../../../app/api/settings/route";

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
beforeEach(() => fixture.reset());
after(async () => fixture.close());

function request(
  method: "GET" | "PUT",
  body?: unknown,
  owner: string | null = "owner-one",
  origin = "http://localhost:3000",
) {
  return new Request("http://localhost:3000/api/settings", {
    method,
    headers: {
      ...(owner ? { Cookie: `agentforce_session=${owner}-session` } : {}),
      ...(method === "PUT" ? { Origin: origin } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function json(response: Response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  return response.json();
}

// Rate limiting writes its own internal rows; count only business records.
function businessRowCount() {
  return [...fixture.rows.keys()].filter(
    (key) => key.startsWith("business_settings/") || key.startsWith("activity_logs/"),
  ).length;
}

test("settings require a verified session and same origin for writes", async () => {
  await json(await settings.GET(request("GET", undefined, null)), 401);
  await json(await settings.PUT(request("PUT", { name: "Shop" }, null)), 401);
  await json(await settings.PUT(request("PUT", { name: "Shop" }, "owner-one", "https://attacker.example")), 403);
  assert.equal(businessRowCount(), 0);
});

test("GET uses the owner's account name until settings are saved", async () => {
  const fallback = await json(await settings.GET(request("GET")));
  assert.deepEqual(fallback, { name: "Ali", city: "", phone: "", email: "" });
  assert.equal(businessRowCount(), 0);
});

test("PUT persists owner-scoped settings and audits changes", async () => {
  const input = { name: "  Nova Tech  ", city: "Lahore", phone: "+92 300 1234567", email: "sales@example.pk" };
  const result = await json(await settings.PUT(request("PUT", input)));
  assert.deepEqual(result, { name: "Nova Tech", city: "Lahore", phone: "+92 300 1234567", email: "sales@example.pk" });
  assert.equal(fixture.rows.get("business_settings/owner-one")?.owner_user_id, "owner-one");
  assert.deepEqual(fixture.rows.get("business_settings/owner-one")?.$permissions, []);
  assert.deepEqual(await json(await settings.GET(request("GET"))), result);
  const updated = await json(await settings.PUT(request("PUT", { name: "New Shop" })));
  assert.deepEqual(updated, { name: "New Shop", city: "", phone: "", email: "" });
  assert.equal(businessRowCount(), 3); // one settings record and two audit records
});

test("two owners cannot read each other's settings", async () => {
  await json(await settings.PUT(request("PUT", { name: "Owner One Shop" })));
  assert.deepEqual(await json(await settings.GET(request("GET", undefined, "owner-two"))), {
    name: "Second Owner", city: "", phone: "", email: "",
  });
  await json(await settings.PUT(request("PUT", { name: "Owner Two Shop" }, "owner-two")));
  assert.deepEqual(await json(await settings.GET(request("GET"))), {
    name: "Owner One Shop", city: "", phone: "", email: "",
  });
  assert.equal(fixture.rows.get("business_settings/owner-two")?.owner_user_id, "owner-two");
});

test("PUT rejects malformed, injected and invalid fields", async () => {
  for (const payload of [
    { name: "" }, { name: "Shop", city: "x".repeat(81) },
    { name: "Shop", phone: "+92 abc" },
    { name: "Shop", phone: "123" },
    { name: "Shop", email: "invalid" },
    { name: "Shop", owner_user_id: "owner-two" },
  ]) {
    await json(await settings.PUT(request("PUT", payload)), 422);
  }
  assert.equal(businessRowCount(), 0);
});
