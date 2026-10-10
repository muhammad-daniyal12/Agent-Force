import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { appwriteFixture } from "./appwrite-fixture";
import * as signup from "../../../app/api/auth/signup/route";
import * as login from "../../../app/api/auth/login/route";
import * as logout from "../../../app/api/auth/logout/route";
import * as me from "../../../app/api/auth/me/route";
import * as start from "../../../app/api/auth/google/start/route";
import * as callback from "../../../app/api/auth/google/callback/route";
import * as products from "../../../app/api/products/route";
import * as product from "../../../app/api/products/[id]/route";
import * as quotations from "../../../app/api/quotations/route";
import { OAUTH_STATE_COOKIE } from "../oauth";
import { safeAuthRedirect } from "../../auth-redirect";
import { finishAuthentication } from "../auth";
import type { Models } from "node-appwrite";

let fixture: Awaited<ReturnType<typeof appwriteFixture>>;
before(async () => {
  fixture = await appwriteFixture();
});
beforeEach(() => {
  fixture.reset();
  Object.assign(process.env, {
    NODE_ENV: "test",
    APPWRITE_ENDPOINT: fixture.endpoint,
    APPWRITE_PROJECT_ID: "test-project",
    APPWRITE_API_KEY: "test-server-key",
    APP_ORIGIN: "http://localhost:3000",
    LLM_PROVIDER: "none",
  });
  delete process.env.APPWRITE_SITE_ID;
  delete process.env.AGENTFORCE_APPWRITE_API_KEY;
  fixture.insert("products", "private-product", {
    owner_user_id: "owner-one",
    sku: "PRIVATE",
    name: "Existing owner's product",
    category: "Private",
    price: 12,
    stock: 8,
    lowStockThreshold: 2,
  });
});
after(async () => {
  await fixture.close();
});

const registration = {
  name: "New Business Owner",
  email: "new-owner@example.com",
  password: "safe-test-password",
  confirmPassword: "safe-test-password",
};
function jsonRequest(
  path: string,
  data: unknown,
  cookie = "",
  origin = process.env.APP_ORIGIN!,
) {
  return new Request(`${process.env.APP_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}
function cookieFor(response: Response, name: string) {
  const value = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${name}=`));
  assert.ok(value, `Expected ${name} cookie.`);
  return value.split(";")[0];
}
function getRequest(path: string, cookie = "") {
  return new Request(`${process.env.APP_ORIGIN}${path}`, {
    headers: { Cookie: cookie },
  });
}
async function google(next = "/operations", cookie = "") {
  const response = await start.POST(
    new Request(`${process.env.APP_ORIGIN}/api/auth/google/start`, {
      method: "POST",
      headers: {
        Origin: process.env.APP_ORIGIN!,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      },
      body: new URLSearchParams({ next }),
    }),
  );
  return response;
}
function callbackRequest(
  response: Response,
  userId: string,
  secret: string,
  overrides: Record<string, string> = {},
) {
  const state = new URL(response.headers.get("location")!).searchParams.get(
    "state",
  )!;
  const query = new URLSearchParams({ state, userId, secret, ...overrides });
  return getRequest(
    `/api/auth/google/callback?${query}`,
    cookieFor(response, OAUTH_STATE_COOKIE),
  );
}

test("signup establishes the existing HTTP-only session and isolates the new owner's workspace", async () => {
  const response = await signup.POST(
    jsonRequest("/api/auth/signup", registration),
  );
  assert.equal(response.status, 201);
  const data = await response.json();
  const userId = data.data.user.id;
  assert.notEqual(userId, "owner-one");
  assert.equal(data.data.user.name, registration.name);
  assert.equal(data.data.user.email, registration.email);
  assert.equal(fixture.users.get(userId)?.password, registration.password);
  const accountCall = fixture.calls.find(
    (call) => call.method === "POST" && call.path === "/account",
  )!;
  assert.equal(accountCall.key, "test-server-key");
  assert.equal(accountCall.body?.userId, userId);
  assert.equal(accountCall.body?.confirmPassword, undefined);
  assert.doesNotMatch(
    JSON.stringify(data),
    /safe-test-password|session|secret|test-server-key/,
  );
  const sessionCookie = cookieFor(response, "agentforce_session");
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(response.headers.get("set-cookie")!, /SameSite=lax/i);
  assert.equal(
    (await me.GET(getRequest("/api/auth/me", sessionCookie))).status,
    200,
  );
  assert.deepEqual(
    await (
      await products.GET(getRequest("/api/products", sessionCookie))
    ).json(),
    [],
  );
  assert.deepEqual(
    await (
      await quotations.GET(getRequest("/api/quotations", sessionCookie))
    ).json(),
    [],
  );
  assert.equal(
    (
      await product.PATCH(
        jsonRequest(
          "/api/products/private-product",
          { stock: 99 },
          sessionCookie,
        ),
        { params: Promise.resolve({ id: "private-product" }) },
      )
    ).status,
    404,
  );
  const created = await products.POST(
    jsonRequest(
      "/api/products",
      {
        sku: "OWN-1",
        name: "New owner product",
        category: "Own",
        price: 25,
        stock: 5,
        lowStockThreshold: 1,
      },
      sessionCookie,
    ),
  );
  assert.equal(created.status, 201);
  const ownProduct = await created.json();
  assert.equal(
    fixture.rows.get(`products/${ownProduct.id}`)?.owner_user_id,
    userId,
  );
  assert.equal(
    (
      await product.PATCH(
        jsonRequest(
          `/api/products/${ownProduct.id}`,
          { stock: 99 },
          "agentforce_session=owner-one-session",
        ),
        { params: Promise.resolve({ id: ownProduct.id }) },
      )
    ).status,
    404,
  );
  assert.equal(
    (await logout.POST(jsonRequest("/api/auth/logout", {}, sessionCookie)))
      .status,
    200,
  );
  assert.equal(
    (await me.GET(getRequest("/api/auth/me", sessionCookie))).status,
    401,
  );
  assert.equal(
    (
      await login.POST(
        jsonRequest("/api/auth/login", {
          email: registration.email,
          password: registration.password,
        }),
      )
    ).status,
    200,
  );
});

test("registration rejects malformed details, confirmation mismatch, ownership injection, and cross-site requests", async () => {
  for (const input of [
    { ...registration, name: " " },
    { ...registration, email: "invalid" },
    { ...registration, password: "short", confirmPassword: "short" },
    { ...registration, confirmPassword: "different-password" },
    { ...registration, owner_user_id: "owner-one" },
  ]) {
    const response = await signup.POST(jsonRequest("/api/auth/signup", input));
    assert.equal(response.status, 422);
    assert.equal(response.headers.has("set-cookie"), false);
  }
  assert.equal(
    (
      await signup.POST(
        jsonRequest(
          "/api/auth/signup",
          registration,
          "",
          "https://attacker.invalid",
        ),
      )
    ).status,
    403,
  );
  assert.equal(fixture.users.size, 2);
  assert.equal(fixture.calls.length, 0);
});

test("registration normalizes email and name; duplicate and disallowed passwords have safe errors", async () => {
  const response = await signup.POST(
    jsonRequest("/api/auth/signup", {
      ...registration,
      name: "  Full Name  ",
      email: " NEW-OWNER@EXAMPLE.COM ",
    }),
  );
  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.user.name, "Full Name");
  const duplicate = await signup.POST(
    jsonRequest("/api/auth/signup", registration),
  );
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).error, /Sign in/);
  const rejected = await signup.POST(
    jsonRequest("/api/auth/signup", {
      ...registration,
      email: "other@example.com",
      password: "common-password",
      confirmPassword: "common-password",
    }),
  );
  assert.equal(rejected.status, 422);
  assert.equal(rejected.headers.has("set-cookie"), false);
});

test("signup uses persistent per-email rate limits and refuses signed-in account switching", async () => {
  assert.equal(
    (
      await signup.POST(
        jsonRequest(
          "/api/auth/signup",
          registration,
          "agentforce_session=owner-one-session",
        ),
      )
    ).status,
    409,
  );
  assert.equal(
    fixture.calls.some(
      (call) => call.path === "/account" && call.method === "POST",
    ),
    false,
  );
  for (let i = 0; i < 3; i++) {
    assert.equal(
      (
        await signup.POST(
          jsonRequest("/api/auth/signup", {
            ...registration,
            email: "owner-one@example.com",
          }),
        )
      ).status,
      409,
    );
  }
  const limited = await signup.POST(
    jsonRequest("/api/auth/signup", {
      ...registration,
      email: "owner-one@example.com",
    }),
  );
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal(
    fixture.calls.filter(
      (call) => call.path === "/account" && call.method === "POST",
    ).length,
    3,
  );
});

test("failed registration session creation leaves a recoverable account and no authenticated cookie", async () => {
  fixture.auth.failSession = true;
  const response = await signup.POST(
    jsonRequest("/api/auth/signup", registration),
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /account was created/);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(
    [...fixture.users.values()].filter(
      (user) => user.email === registration.email,
    ).length,
    1,
  );
  fixture.auth.failSession = false;
  assert.equal(
    (
      await login.POST(
        jsonRequest("/api/auth/login", {
          email: registration.email,
          password: registration.password,
        }),
      )
    ).status,
    200,
  );
});

test("OAuth start binds a fresh random HTTP-only state and trusted production callback", async () => {
  process.env.APP_ORIGIN = "https://agent-force.tech";
  const response = await google();
  assert.equal(response.status, 303);
  assert.equal(
    new URL(response.headers.get("location")!).hostname,
    "accounts.google.com",
  );
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(response.headers.get("set-cookie")!, /Secure/);
  assert.match(response.headers.get("set-cookie")!, /SameSite=lax/i);
  assert.match(response.headers.get("set-cookie")!, /Max-Age=600/);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const call = fixture.calls.find(
    (value) => value.path === "/account/tokens/oauth2/google",
  )!;
  assert.equal(
    call.query?.success,
    "https://agent-force.tech/api/auth/google/callback",
  );
  assert.equal(
    call.query?.failure,
    "https://agent-force.tech/api/auth/google/callback?failure=1",
  );
  assert.match(call.query?.state || "", /^[a-f0-9]{64}$/);
  const second = await google();
  assert.notEqual(
    new URL(second.headers.get("location")!).searchParams.get("state"),
    call.query?.state,
  );
  assert.ok(
    [...fixture.rows.values()].every((row) => row.$permissions.length === 0),
  );
});

test("Google callbacks exchange tokens on the server, preserve sessions and isolate a new Google account", async () => {
  const response = await google();
  const secret = fixture.issueOAuthToken("google-owner");
  const request = callbackRequest(response, "google-owner", secret);
  const authenticated = await callback.GET(request);
  assert.equal(authenticated.status, 303);
  assert.equal(
    authenticated.headers.get("location"),
    "http://localhost:3000/operations",
  );
  assert.match(
    authenticated.headers.get("set-cookie")!,
    /agentforce_oauth_state=;.*Max-Age=0/,
  );
  const sessionCookie = cookieFor(authenticated, "agentforce_session");
  const exchange = fixture.calls.find(
    (call) => call.path === "/account/sessions/token",
  )!;
  assert.equal(exchange.body?.userId, "google-owner");
  assert.equal(exchange.body?.secret, secret);
  assert.equal(exchange.key, "test-server-key");
  assert.doesNotMatch(
    authenticated.headers.get("location")!,
    /secret|state|token/,
  );
  assert.deepEqual(
    await (
      await products.GET(getRequest("/api/products", sessionCookie))
    ).json(),
    [],
  );
  assert.equal(
    (
      await product.PATCH(
        jsonRequest(
          "/api/products/private-product",
          { stock: 99 },
          sessionCookie,
        ),
        { params: Promise.resolve({ id: "private-product" }) },
      )
    ).status,
    404,
  );
  assert.equal(
    (await me.GET(getRequest("/api/auth/me", sessionCookie))).status,
    200,
  );
  assert.equal((await callback.GET(request)).status, 403);
  assert.equal(
    fixture.calls.filter((call) => call.path === "/account/sessions/token")
      .length,
    1,
  );
});

test("OAuth rejects absent, forged, repeated, expired, or duplicate-cookie state before session exchange", async () => {
  const response = await google();
  const state = new URL(response.headers.get("location")!).searchParams.get(
    "state",
  )!;
  const cookie = cookieFor(response, OAUTH_STATE_COOKIE);
  for (const request of [
    getRequest(
      `/api/auth/google/callback?state=${state}&userId=owner-one&secret=fake`,
    ),
    getRequest(
      "/api/auth/google/callback?state=forged&userId=owner-one&secret=fake",
      cookie,
    ),
    getRequest(
      `/api/auth/google/callback?state=${state}&state=${state}&userId=owner-one&secret=fake`,
      cookie,
    ),
    getRequest(
      `/api/auth/google/callback?state=${state}&userId=owner-one&secret=fake`,
      `${cookie}; ${cookie}`,
    ),
  ]) {
    const rejected = await callback.GET(request);
    assert.ok([400, 403].includes(rejected.status));
    assert.equal(
      rejected.headers
        .getSetCookie()
        .some((value) => value.startsWith("agentforce_session=")),
      false,
    );
  }
  const challenge = [...fixture.rows.values()].find(
    (row) => Date.parse(String(row.expires_at)) > Date.now() + 120000,
  )!;
  challenge.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal(
    (
      await callback.GET(
        callbackRequest(
          response,
          "owner-one",
          fixture.issueOAuthToken("owner-one"),
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    fixture.calls.some((call) => call.path === "/account/sessions/token"),
    false,
  );
});

test("concurrent callbacks consume the OAuth challenge and create a session only once", async () => {
  const response = await google();
  const secret = fixture.issueOAuthToken("google-owner");
  const callbacks = await Promise.all(
    [1, 2].map(() =>
      callback.GET(callbackRequest(response, "google-owner", secret)),
    ),
  );
  assert.deepEqual(callbacks.map((value) => value.status).sort(), [303, 403]);
  assert.equal(
    fixture.calls.filter((call) => call.path === "/account/sessions/token")
      .length,
    1,
  );
});

test("OAuth cancellations and failed tokens consume state without signing in", async () => {
  const response = await google();
  const failed = await callback.GET(
    callbackRequest(response, "google-owner", "unused", { failure: "1" }),
  );
  assert.equal(failed.status, 303);
  assert.equal(
    failed.headers.get("location"),
    "http://localhost:3000/login?authError=google_cancelled",
  );
  assert.equal(
    fixture.calls.some((call) => call.path === "/account/sessions/token"),
    false,
  );
  const second = await google();
  assert.equal(
    (await callback.GET(callbackRequest(second, "owner-one", "wrong-token")))
      .status,
    401,
  );
  assert.equal(
    (await callback.GET(callbackRequest(second, "owner-one", "wrong-token")))
      .status,
    403,
  );
});

test("disabled users are denied and newly created sessions are revoked", async () => {
  const response = await google();
  const secret = fixture.issueOAuthToken("google-owner");
  fixture.users.get("google-owner")!.status = false;
  const denied = await callback.GET(
    callbackRequest(response, "google-owner", secret),
  );
  assert.equal(denied.status, 401);
  assert.equal(fixture.sessions.has("google-owner-session"), false);
  assert.equal(
    denied.headers
      .getSetCookie()
      .some((cookie) => cookie.startsWith("agentforce_session=")),
    false,
  );
});

test("Google start rejects cross-site requests, existing sessions, and unsafe redirect destinations", async () => {
  const crossSite = new Request("http://localhost:3000/api/auth/google/start", {
    method: "POST",
    headers: {
      Origin: "https://evil.invalid",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "next=%2F",
  });
  assert.equal((await start.POST(crossSite)).status, 403);
  assert.equal(
    (await google("/", "agentforce_session=owner-one-session")).status,
    409,
  );
  for (const path of [
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/%2Fevil.invalid",
    "/%5Cevil.invalid",
    "/..//evil.invalid",
    "/%2e%2e//evil.invalid",
    "/api/auth/google/callback",
    "/signup",
    "/login",
    "/%0D%0ALocation:evil",
    "javascript:alert(1)",
  ]) {
    assert.equal(safeAuthRedirect(path), "/");
    assert.equal((await google(path)).status, 400);
  }
  assert.equal(
    fixture.calls.some((call) => call.path === "/account/tokens/oauth2/google"),
    false,
  );
  assert.equal(
    safeAuthRedirect("/operations?tab=history#latest"),
    "/operations?tab=history#latest",
  );
  assert.equal(start.GET().status, 405);
  assert.equal(callback.POST().status, 405);
  assert.equal(signup.GET().status, 405);
});

test("callback validates the stored destination again and never follows a tampered cookie", async () => {
  const response = await google();
  const state = new URL(response.headers.get("location")!).searchParams.get(
    "state",
  )!;
  const cookie = `${OAUTH_STATE_COOKIE}=${state}.${Buffer.from("//evil.invalid").toString("base64url")}`;
  const denied = await callback.GET(
    getRequest(
      `/api/auth/google/callback?state=${state}&userId=owner-one&secret=fake`,
      cookie,
    ),
  );
  assert.equal(denied.status, 400);
  assert.equal(
    fixture.calls.some((call) => call.path === "/account/sessions/token"),
    false,
  );
});

test("OAuth start refuses untrusted provider redirects and removes its unused challenge", async () => {
  fixture.auth.oauthRedirect = "https://evil.invalid/oauth";
  assert.equal((await google()).status, 503);
  assert.equal(
    [...fixture.rows.values()].filter(
      (row) => Date.parse(String(row.expires_at)) > Date.now() + 120000,
    ).length,
    0,
  );
});

test("session verification rejects missing secrets, expired sessions, and account mismatches", async () => {
  fixture.auth.emptySecret = true;
  const signupResponse = await signup.POST(
    jsonRequest("/api/auth/signup", registration),
  );
  assert.equal(signupResponse.status, 503);
  assert.equal(signupResponse.headers.has("set-cookie"), false);
  fixture.auth.emptySecret = false;
  const session = {
    secret: "owner-one-session",
    expire: new Date(Date.now() + 3600000).toISOString(),
  } as Models.Session;
  await assert.rejects(
    () => finishAuthentication(session, undefined, "owner-two"),
    /could not be verified/,
  );
  assert.equal(fixture.sessions.has("owner-one-session"), false);
  const expired = {
    secret: "owner-two-session",
    expire: new Date(Date.now() - 1000).toISOString(),
  } as Models.Session;
  await assert.rejects(() => finishAuthentication(expired), /expired/);
  assert.equal(fixture.sessions.has("owner-two-session"), false);
});

test("malformed callback consumes valid state and cannot be retried with a fresh token", async () => {
  const response = await google();
  const secret = fixture.issueOAuthToken("google-owner");
  assert.equal(
    (await callback.GET(callbackRequest(response, "google-owner", ""))).status,
    400,
  );
  assert.equal(
    (await callback.GET(callbackRequest(response, "google-owner", secret)))
      .status,
    403,
  );
  assert.equal(
    fixture.calls.some((call) => call.path === "/account/sessions/token"),
    false,
  );
});

test("production Google session cookies are secure and invalid configuration returns a safe error", async () => {
  process.env.APP_ORIGIN = "https://agent-force.tech";
  const response = await google("/inventory");
  const secret = fixture.issueOAuthToken("google-owner");
  const authenticated = await callback.GET(
    callbackRequest(response, "google-owner", secret),
  );
  assert.equal(authenticated.status, 303);
  const cookie = authenticated.headers
    .getSetCookie()
    .find((value) => value.startsWith("agentforce_session="))!;
  assert.match(cookie, /Secure/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Expires=/);
  assert.equal(
    authenticated.headers.get("location"),
    "https://agent-force.tech/inventory",
  );
  const second = await google();
  process.env.APP_ORIGIN = "https://agent-force.tech/invalid";
  const rejected = await callback.GET(
    callbackRequest(second, "google-owner", "unused"),
  );
  assert.equal(rejected.status, 503);
  assert.equal(
    rejected.headers
      .getSetCookie()
      .some((value) => value.startsWith("agentforce_session=")),
    false,
  );
});
