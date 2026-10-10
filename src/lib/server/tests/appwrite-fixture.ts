import { createServer, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

type Row = Record<string, unknown> & {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
};
type Query = { method: string; attribute?: string; values?: unknown[] };
type Transaction = {
  rows: Map<string, Row>;
  versions: Map<string, number>;
  dirty: Set<string>;
};

// HTTP fixture exercises the installed node-appwrite SDK, not a substitute SDK.
// Transaction version checks model Appwrite's conflict detection; live Cloud
// provisioning remains a separate required check once credentials are configured.
export async function appwriteFixture() {
  const rows = new Map<string, Row>();
  const versions = new Map<string, number>();
  const transactions = new Map<string, Transaction>();
  const sessions = new Map<string, string>();
  const users = new Map<
    string,
    {
      $id: string;
      name: string;
      email: string;
      password: string;
      status: boolean;
    }
  >();
  const oauthTokens = new Map<string, string>();
  const auth = { failSession: false, emptySecret: false, oauthRedirect: "" };
  const calls: {
    method: string;
    path: string;
    session?: string;
    key?: string;
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  }[] = [];
  let sequence = 0;
  const cloneRows = () =>
    new Map([...rows].map(([key, value]) => [key, structuredClone(value)]));
  function fail(status: number, type: string): never {
    throw { status, type };
  }
  function select(
    source: Map<string, Row>,
    table: string,
    queries: Query[],
  ): Row[] {
    let result = [...source.entries()]
      .filter(([key]) => key.startsWith(`${table}/`))
      .map(([, row]) => row);
    for (const query of queries) {
      const value = query.values?.[0];
      if (query.method === "equal")
        result = result.filter((row) =>
          query.values?.includes(row[query.attribute!]),
        );
      if (query.method === "lessThan")
        result = result.filter(
          (row) => String(row[query.attribute!]) < String(value),
        );
      if (query.method === "greaterThan")
        result = result.filter(
          (row) => String(row[query.attribute!]) > String(value),
        );
    }
    const orders = queries.filter((query) => query.method.startsWith("order"));
    result.sort((a, b) => {
      for (const query of orders) {
        const comparison = String(a[query.attribute!]).localeCompare(
          String(b[query.attribute!]),
        );
        if (comparison)
          return query.method === "orderDesc" ? -comparison : comparison;
      }
      return a.$id.localeCompare(b.$id);
    });
    const cursor = queries.find((query) => query.method === "cursorAfter")
      ?.values?.[0];
    if (cursor)
      result = result.slice(result.findIndex((row) => row.$id === cursor) + 1);
    const limit = queries.find((query) => query.method === "limit")
      ?.values?.[0];
    return limit ? result.slice(0, Number(limit)) : result;
  }
  function mutate(
    source: Map<string, Row>,
    key: string,
    row: Row | undefined,
    transaction?: Transaction,
  ) {
    if (row) source.set(key, structuredClone(row));
    else source.delete(key);
    if (transaction) transaction.dirty.add(key);
    else versions.set(key, (versions.get(key) ?? 0) + 1);
  }
  function ensureUnique(source: Map<string, Row>, key: string, row: Row) {
    for (const [otherKey, other] of source) {
      if (otherKey === key || other.owner_user_id !== row.owner_user_id)
        continue;
      if (
        key.startsWith("products/") &&
        otherKey.startsWith("products/") &&
        other.sku === row.sku
      )
        fail(409, "row_already_exists");
      if (
        key.startsWith("agent_runs/") &&
        otherKey.startsWith("agent_runs/") &&
        row.idempotencyKey &&
        other.idempotencyKey === row.idempotencyKey
      )
        fail(409, "row_already_exists");
    }
  }
  function send(response: ServerResponse, data: unknown, status = 200) {
    if (status === 204) {
      response.writeHead(status);
      response.end();
      return;
    }
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(data));
  }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url!, "http://fixture.local");
      const path = url.pathname.replace(/^\/v1/, "");
      const method = request.method!;
      const session = String(request.headers["x-appwrite-session"] ?? "");
      const key = String(request.headers["x-appwrite-key"] ?? "");
      const call = {
        method,
        path,
        session,
        key,
        query: Object.fromEntries(url.searchParams),
        body: undefined as Record<string, unknown> | undefined,
      };
      calls.push(call);
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : {};
      call.body = body;
      function issueSession(owner: string) {
        if (auth.failSession) fail(503, "session_creation_failed");
        const secret = `${owner}-session`;
        sessions.set(secret, owner);
        return send(
          response,
          {
            $id: `session-${owner}`,
            userId: owner,
            secret: auth.emptySecret ? "" : secret,
            expire: new Date(Date.now() + 3600000).toISOString(),
          },
          201,
        );
      }
      if (path === "/account" && method === "GET") {
        const owner = sessions.get(session);
        if (!owner) fail(401, "user_unauthorized");
        const user = users.get(owner);
        if (!user) fail(401, "user_unauthorized");
        return send(response, {
          $id: owner,
          name: user!.name,
          email: user!.email,
          status: user!.status,
        });
      }
      if (path === "/account" && method === "POST") {
        if (key !== "test-server-key") fail(401, "general_unauthorized_scope");
        if ([...users.values()].some((user) => user.email === body.email))
          fail(409, "user_already_exists");
        if (body.password === "common-password")
          fail(400, "user_password_not_allowed");
        const user = {
          $id: body.userId,
          name: body.name,
          email: body.email,
          password: body.password,
          status: true,
        };
        users.set(user.$id, user);
        return send(
          response,
          { $id: user.$id, name: user.name, email: user.email, status: true },
          201,
        );
      }
      if (path === "/account/tokens/oauth2/google" && method === "GET") {
        if (key !== "test-server-key") fail(401, "general_unauthorized_scope");
        response.writeHead(302, {
          location:
            auth.oauthRedirect ||
            `https://accounts.google.com/o/oauth2/v2/auth?state=${url.searchParams.get("state")}`,
        });
        response.end();
        return;
      }
      if (path === "/account/sessions/token" && method === "POST") {
        if (key !== "test-server-key") fail(401, "general_unauthorized_scope");
        if (
          !oauthTokens.has(body.secret) ||
          oauthTokens.get(body.secret) !== body.userId
        )
          fail(401, "user_invalid_token");
        oauthTokens.delete(body.secret);
        return issueSession(body.userId);
      }
      if (path === "/account/sessions/email" && method === "POST") {
        if (key !== "test-server-key") fail(401, "general_unauthorized_scope");
        const user = [...users.values()].find(
          (value) =>
            value.email === body.email && value.password === body.password,
        );
        if (!user) fail(401, "user_invalid_credentials");
        return issueSession(user!.$id);
      }
      if (path === "/account/sessions/current" && method === "DELETE") {
        if (!sessions.has(session)) fail(401, "user_unauthorized");
        sessions.delete(session);
        return send(response, {}, 204);
      }
      if (key !== "test-server-key") fail(401, "general_unauthorized_scope");
      if (path === "/tablesdb/transactions" && method === "POST") {
        if (
          body.ttl !== undefined &&
          (!Number.isInteger(body.ttl) || body.ttl < 60)
        )
          fail(400, "general_argument_invalid");
        const id = `transaction-${++sequence}`;
        transactions.set(id, {
          rows: cloneRows(),
          versions: new Map(versions),
          dirty: new Set(),
        });
        return send(response, { $id: id, status: "pending" }, 201);
      }
      const transactionPath = path.match(/^\/tablesdb\/transactions\/([^/]+)$/);
      if (transactionPath && method === "PATCH") {
        const transaction = transactions.get(transactionPath[1]);
        if (!transaction) fail(404, "transaction_not_found");
        if (body.rollback) {
          transactions.delete(transactionPath[1]);
          return send(response, {
            $id: transactionPath[1],
            status: "rolled_back",
          });
        }
        if (body.commit) {
          for (const id of transaction!.dirty)
            if (
              (versions.get(id) ?? 0) !== (transaction!.versions.get(id) ?? 0)
            )
              fail(409, "transaction_conflict");
          const combined = cloneRows();
          for (const id of transaction!.dirty) {
            const row = transaction!.rows.get(id);
            if (row) combined.set(id, row);
            else combined.delete(id);
          }
          for (const id of transaction!.dirty) {
            const row = combined.get(id);
            if (row) ensureUnique(combined, id, row);
          }
          for (const id of transaction!.dirty)
            mutate(rows, id, transaction!.rows.get(id));
          transactions.delete(transactionPath[1]);
          return send(response, {
            $id: transactionPath[1],
            status: "committed",
          });
        }
      }
      const match = path.match(
        /^\/tablesdb\/agentforce\/tables\/([^/]+)\/rows(?:\/([^/]+))?(?:\/([^/]+)\/(increment|decrement))?$/,
      );
      if (!match) fail(404, "route_not_found");
      const [, table, id, column, numeric] = match!;
      const transactionId =
        body.transactionId || url.searchParams.get("transactionId");
      const transaction = transactionId
        ? transactions.get(transactionId)
        : undefined;
      if (transactionId && !transaction) fail(404, "transaction_not_found");
      const source = transaction?.rows || rows;
      const rowKey = `${table}/${id}`;
      const queries = (
        body.queries ||
        [...url.searchParams]
          .filter(([name]) => name.startsWith("queries"))
          .map(([, value]) => value)
      ).map((query: string) => JSON.parse(query)) as Query[];
      if (!id && method === "GET") {
        const selected = select(source, table, queries);
        return send(response, { total: selected.length, rows: selected });
      }
      if (!id && method === "POST") {
        const newKey = `${table}/${body.rowId}`;
        if (source.has(newKey)) fail(409, "row_already_exists");
        const now = new Date(Date.now() + ++sequence).toISOString();
        const row = {
          ...body.data,
          $id: body.rowId,
          $createdAt: now,
          $updatedAt: now,
          $permissions: body.permissions ?? [],
        } as Row;
        ensureUnique(source, newKey, row);
        mutate(source, newKey, row, transaction);
        return send(response, row, 201);
      }
      if (!id && method === "PATCH") {
        const selected = select(source, table, queries);
        const updated = selected.map((row) => ({
          ...row,
          ...body.data,
          $updatedAt: new Date().toISOString(),
        }));
        for (const row of updated)
          mutate(source, `${table}/${row.$id}`, row, transaction);
        return send(response, { total: updated.length, rows: updated });
      }
      const row = source.get(rowKey);
      if (!row) fail(404, "row_not_found");
      if (method === "GET") return send(response, row);
      if (method === "PATCH") {
        const updated = {
          ...row!,
          ...body.data,
          $updatedAt: new Date().toISOString(),
        };
        if (numeric) {
          const value =
            Number(row![column]) +
            (numeric === "increment" ? 1 : -1) * Number(body.value ?? 1);
          if (
            (body.min !== undefined && value < body.min) ||
            (body.max !== undefined && value > body.max)
          )
            fail(400, "column_value_out_of_range");
          updated[column] = value;
        }
        ensureUnique(source, rowKey, updated);
        mutate(source, rowKey, updated, transaction);
        return send(response, updated);
      }
      if (method === "DELETE") {
        mutate(source, rowKey, undefined, transaction);
        return send(response, {}, 204);
      }
      fail(405, "method_not_allowed");
    } catch (error) {
      const failure = error as { status?: number; type?: string };
      send(
        response,
        {
          message: "Fixture error",
          type: failure.type || "fixture_error",
          code: failure.status || 500,
        },
        failure.status || 500,
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const reset = () => {
    rows.clear();
    versions.clear();
    transactions.clear();
    sessions.clear();
    users.clear();
    oauthTokens.clear();
    auth.failSession = false;
    auth.emptySecret = false;
    auth.oauthRedirect = "";
    calls.length = 0;
    sessions.set("owner-one-session", "owner-one");
    sessions.set("owner-two-session", "owner-two");
    users.set("owner-one", {
      $id: "owner-one",
      name: "Ali",
      email: "owner-one@example.com",
      password: "demo-password",
      status: true,
    });
    users.set("owner-two", {
      $id: "owner-two",
      name: "Second Owner",
      email: "owner-two@example.com",
      password: "demo-password",
      status: true,
    });
  };
  reset();
  return {
    endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    rows,
    calls,
    users,
    sessions,
    auth,
    issueOAuthToken(userId: string) {
      if (!users.has(userId))
        users.set(userId, {
          $id: userId,
          name: "Google Owner",
          email: `${userId}@example.com`,
          password: "",
          status: true,
        });
      const secret = `${userId}-oauth-token-${++sequence}`;
      oauthTokens.set(secret, userId);
      return secret;
    },
    reset,
    insert(table: string, id: string, data: Record<string, unknown>) {
      const now = new Date().toISOString();
      mutate(rows, `${table}/${id}`, {
        ...data,
        $id: id,
        $createdAt: now,
        $updatedAt: now,
        $permissions: [],
      });
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
