// Single place where the UI talks to the backend. Pages import `api` only.
// Calls the real Next.js API routes; NEXT_PUBLIC_USE_MOCK=true switches to built-in demo data.
import type { ActivityLog, Agent, DashboardStats, OperationRun, Product, Quotation } from "@/types";
import { MockError, mock, wait } from "./mock-engine";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** Sends the browser to the login page when the session is missing or expired. */
function redirectToLogin() {
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    // A full page load is intended here: it drops all in-memory owner data before login.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }
}

async function http<T>(path: string, init?: RequestInit, { redirectOn401 = true } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && redirectOn401) redirectToLogin();
    // Business routes return { error: "message" }; auth routes may return { error: { message } }.
    const message = typeof body?.error === "string" ? body.error : body?.error?.message;
    throw new ApiError(message ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

const DEMO_USER: SessionUser = { id: "demo", name: "Nova Tech Supplies", email: "owner@novatech.pk" };

// Demo mode keeps a fake session in this browser so sign-in and sign-out behave like the real app.
const DEMO_SESSION_KEY = "agentforce.demo-session";
const demoSession = {
  get: (): SessionUser | null => {
    try {
      const raw = localStorage.getItem(DEMO_SESSION_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  },
  set: (user: SessionUser) => {
    try {
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
    } catch {
      // Storage blocked: the demo session lasts until the page reloads.
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      // Nothing stored.
    }
  },
};

export const auth = {
  /** Current owner; rejects with a 401 ApiError when nobody is signed in. */
  me: async (): Promise<SessionUser> => {
    if (USE_MOCK) {
      const user = demoSession.get();
      if (!user) throw new ApiError("Authentication required.", 401);
      return user;
    }
    return (await http<{ data: { user: SessionUser } }>("/api/auth/me", undefined, { redirectOn401: false })).data.user;
  },

  login: async (email: string, password: string): Promise<SessionUser> => {
    if (USE_MOCK) {
      await wait(500);
      const user = { ...DEMO_USER, email: email || DEMO_USER.email };
      demoSession.set(user);
      return user;
    }
    return (await http<{ data: { user: SessionUser } }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, { redirectOn401: false })).data.user;
  },

  signup: async (input: SignupInput): Promise<SessionUser> => {
    if (USE_MOCK) throw new ApiError("Account creation requires real backend mode. Disable NEXT_PUBLIC_USE_MOCK first.", 400);
    return (await http<{ data: { user: SessionUser } }>("/api/auth/signup", {
      method: "POST", body: JSON.stringify(input),
    }, { redirectOn401: false })).data.user;
  },

  /** Ends the session. Throws if the server couldn't revoke it, so the UI never pretends to be signed out. */
  logout: async (): Promise<void> => {
    if (USE_MOCK) {
      demoSession.clear();
      return;
    }
    try {
      await http("/api/auth/logout", { method: "POST" }, { redirectOn401: false });
    } catch (err) {
      // 401 means the session was already gone (the backend still expires the cookie): that's signed out.
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
  },
};

/** Runs a mock handler with realistic latency and the same error shape as the API. */
async function fake<T>(fn: () => T, latency = 350): Promise<T> {
  await wait(latency + Math.random() * 250);
  try {
    return structuredClone(fn());
  } catch (err) {
    if (err instanceof MockError) throw new ApiError(err.message, err.status);
    throw err;
  }
}

const json = (body: unknown) => JSON.stringify(body);

export type NewProduct = Omit<Product, "id" | "updatedAt">;
export type RunInput = { customerName: string; customerEmail: string; request: string };

export const api = {
  dashboard: (): Promise<DashboardStats> => (USE_MOCK ? fake(mock.dashboard) : http("/api/dashboard")),

  agents: (): Promise<Agent[]> => (USE_MOCK ? fake(mock.agents) : http("/api/agents")),

  products: (q = ""): Promise<Product[]> =>
    USE_MOCK ? fake(() => mock.products(q), 250) : http(`/api/products?q=${encodeURIComponent(q)}`),

  createProduct: (input: NewProduct): Promise<Product> =>
    USE_MOCK ? fake(() => mock.createProduct(input)) : http("/api/products", { method: "POST", body: json(input) }),

  updateProduct: (id: string, patch: Partial<Product>): Promise<Product> =>
    USE_MOCK ? fake(() => mock.updateProduct(id, patch)) : http(`/api/products/${id}`, { method: "PATCH", body: json(patch) }),

  deleteProduct: (id: string): Promise<{ ok: true }> =>
    USE_MOCK ? fake(() => mock.deleteProduct(id)) : http(`/api/products/${id}`, { method: "DELETE" }),

  /** Pass the same idempotencyKey when retrying one request, so the backend never creates a duplicate quote. */
  runOperation: (input: RunInput, idempotencyKey: string = crypto.randomUUID()): Promise<OperationRun> =>
    USE_MOCK
      ? fake(() => mock.runOperation(input), 1400)
      : http("/api/operations/run", { method: "POST", body: json(input), headers: { "Idempotency-Key": idempotencyKey } }),

  quotations: (status?: Quotation["status"]): Promise<Quotation[]> =>
    USE_MOCK ? fake(() => mock.quotations(status)) : http(`/api/quotations${status ? `?status=${status}` : ""}`),

  quotation: (id: string): Promise<Quotation> => (USE_MOCK ? fake(() => mock.quotation(id)) : http(`/api/quotations/${id}`)),

  approveQuotation: (id: string, note?: string): Promise<Quotation> =>
    USE_MOCK ? fake(() => mock.review(id, "approved", note)) : http(`/api/quotations/${id}/approve`, { method: "POST", body: json({ note }) }),

  rejectQuotation: (id: string, note?: string): Promise<Quotation> =>
    USE_MOCK ? fake(() => mock.review(id, "rejected", note)) : http(`/api/quotations/${id}/reject`, { method: "POST", body: json({ note }) }),

  activity: (limit = 20): Promise<ActivityLog[]> =>
    USE_MOCK ? fake(() => mock.activity(limit), 250) : http(`/api/activity?limit=${limit}`),
};

export const isMockMode = USE_MOCK;
