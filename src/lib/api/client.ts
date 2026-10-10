// Single place where the UI talks to the backend. Pages import `api` only.
// NEXT_PUBLIC_USE_MOCK=false switches every call to the real Next.js API routes.
import type { ActivityLog, Agent, DashboardStats, OperationRun, Product, Quotation } from "@/types";
import { MockError, mock, wait } from "./mock-engine";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

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

  runOperation: (input: RunInput): Promise<OperationRun> =>
    USE_MOCK ? fake(() => mock.runOperation(input), 1400) : http("/api/operations/run", { method: "POST", body: json(input) }),

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
