// In-browser stand-in for the backend. Mirrors the agreed API so pages work before
// the real endpoints exist. Removed from the request path once NEXT_PUBLIC_USE_MOCK=false.
import type { ActivityLog, AgentStep, OperationRun, Product, Quotation, QuotationItem } from "@/types";
import { mockActivity, mockAgents, mockProducts, mockQuotations } from "./mock-data";

const TAX_RATE = 0.08;

const db = {
  agents: structuredClone(mockAgents),
  products: structuredClone(mockProducts),
  quotations: structuredClone(mockQuotations),
  activity: structuredClone(mockActivity),
};

const uid = (prefix: string) => `${prefix}_${Math.random().toString(16).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(actor: string, action: string, target: string) {
  const entry: ActivityLog = { id: uid("act"), actor, action, target, createdAt: nowIso() };
  db.activity.unshift(entry);
}

export class MockError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const mock = {
  dashboard() {
    const approved = db.quotations.filter((q) => q.status === "approved");
    return {
      totalQuotations: db.quotations.length,
      pendingApprovals: db.quotations.filter((q) => q.status === "pending").length,
      approvedValue: approved.reduce((sum, q) => sum + q.total, 0),
      lowStockCount: db.products.filter((p) => p.stock <= p.lowStockThreshold).length,
      activeAgents: db.agents.filter((a) => a.status !== "offline").length,
    };
  },

  agents: () => db.agents,

  products(q?: string) {
    if (!q) return db.products;
    const needle = q.toLowerCase();
    return db.products.filter((p) => [p.name, p.sku, p.category].some((v) => v.toLowerCase().includes(needle)));
  },

  createProduct(input: Omit<Product, "id" | "updatedAt">) {
    if (db.products.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase())) {
      throw new MockError(`SKU ${input.sku} already exists`, 409);
    }
    const product: Product = { ...input, id: uid("prd"), updatedAt: nowIso() };
    db.products.unshift(product);
    log("Admin", "added product", product.name);
    return product;
  },

  updateProduct(id: string, patch: Partial<Product>) {
    const product = db.products.find((p) => p.id === id);
    if (!product) throw new MockError("Product not found", 404);
    Object.assign(product, patch, { id, updatedAt: nowIso() });
    log("Admin", "updated product", product.name);
    return product;
  },

  deleteProduct(id: string) {
    const index = db.products.findIndex((p) => p.id === id);
    if (index === -1) throw new MockError("Product not found", 404);
    const [removed] = db.products.splice(index, 1);
    log("Admin", "deleted product", removed.name);
    return { ok: true as const };
  },

  quotations(status?: Quotation["status"]) {
    const list = status ? db.quotations.filter((q) => q.status === status) : db.quotations;
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  quotation(id: string) {
    const quotation = db.quotations.find((q) => q.id === id);
    if (!quotation) throw new MockError("Quotation not found", 404);
    return quotation;
  },

  review(id: string, decision: "approved" | "rejected", note?: string) {
    const quotation = mock.quotation(id);
    if (quotation.status !== "pending") throw new MockError(`Quotation already ${quotation.status}`, 409);
    quotation.status = decision;
    quotation.reviewerNote = note || undefined;
    if (decision === "approved") {
      for (const item of quotation.items) {
        const product = db.products.find((p) => p.id === item.productId);
        if (product && item.inStock) product.stock = Math.max(0, product.stock - item.quantity);
      }
    }
    log("Admin", decision === "approved" ? "approved quotation" : "rejected quotation", `QUO-${id.slice(-6).toUpperCase()} · ${quotation.customerName}`);
    return quotation;
  },

  activity: (limit = 20) => db.activity.slice(0, limit),

  runOperation(input: { customerName: string; customerEmail: string; request: string }): OperationRun {
    const steps: AgentStep[] = [];
    const step = (s: Omit<AgentStep, "id">) => steps.push({ id: uid("stp"), ...s });

    // 1. Support agent: extract items
    const extracted = extractItems(input.request, db.products);
    const isPurchase = extracted.length > 0 || /\b(price|quote|quotation|buy|order|need|want)\b/i.test(input.request);
    step({
      agent: "support",
      title: isPurchase ? "Understood a quotation request" : "Request is not a purchase enquiry",
      status: "done",
      tool: "parseRequest",
      input: { request: input.request },
      output: {
        intent: isPurchase ? "quotation_request" : "general_enquiry",
        items: extracted.map((e) => ({ productQuery: e.query, quantity: e.quantity })),
        urgency: /\b(urgent|asap|today|this week)\b/i.test(input.request) ? "high" : "normal",
        sentiment: "neutral",
      },
      durationMs: 820 + Math.round(Math.random() * 400),
    });
    log("Support Agent", "parsed request from", input.customerEmail);

    if (!isPurchase || extracted.length === 0) {
      return {
        id: uid("run"),
        steps,
        quotation: null,
        summary: isPurchase
          ? "I couldn't match any catalog products in this request. Try naming specific products and quantities."
          : "This looks like a general enquiry, so no quotation was created. The Support Agent can draft a reply instead.",
      };
    }

    // 2. Inventory agent: check stock per item
    const items: QuotationItem[] = extracted.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.price,
      total: round(product.price * quantity),
      inStock: product.stock >= quantity,
    }));
    step({
      agent: "inventory",
      title: `Checked stock for ${items.length} product${items.length > 1 ? "s" : ""}`,
      status: "done",
      tool: "checkStock",
      input: extracted.map((e) => e.query),
      output: extracted.map(({ product, quantity }) => ({
        sku: product.sku,
        name: product.name,
        requested: quantity,
        available: product.stock,
        inStock: product.stock >= quantity,
      })),
      durationMs: 410 + Math.round(Math.random() * 300),
    });
    log("Inventory Agent", "checked stock for", items.map((i) => i.name).join(", "));

    // 3. Sales agent: build quotation
    const subtotal = round(items.reduce((s, i) => s + i.total, 0));
    const discountRate = subtotal > 2000 ? 0.1 : subtotal > 500 ? 0.05 : 0;
    const discount = round(subtotal * discountRate);
    const tax = round((subtotal - discount) * TAX_RATE);
    const quotation: Quotation = {
      id: uid("quo"),
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      request: input.request,
      items,
      subtotal,
      discount,
      tax,
      total: round(subtotal - discount + tax),
      status: "pending",
      createdAt: nowIso(),
    };
    db.quotations.unshift(quotation);
    step({
      agent: "sales",
      title: "Drafted quotation and sent it for approval",
      status: "done",
      tool: "createQuotation",
      input: { items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
      output: { quotationId: quotation.id, subtotal, discountRate, discount, tax, total: quotation.total, status: "pending" },
      durationMs: 690 + Math.round(Math.random() * 300),
    });
    log("Sales Agent", "created quotation", `QUO-${quotation.id.slice(-6).toUpperCase()} · ${input.customerName}`);

    const outOfStock = items.filter((i) => !i.inStock);
    return {
      id: uid("run"),
      steps,
      quotation,
      summary:
        outOfStock.length > 0
          ? `Quotation drafted for ${items.length} item(s). ${outOfStock.map((i) => i.name).join(", ")} ${outOfStock.length > 1 ? "are" : "is"} short on stock, so please review before approving.`
          : `Quotation drafted for ${items.length} item(s), all in stock. It's waiting for your approval.`,
    };
  },
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20 };

/** Rule-based extraction: finds catalog products mentioned in text and the quantity before them. */
function extractItems(text: string, products: Product[]) {
  const lower = text.toLowerCase();
  const found: { product: Product; quantity: number; query: string }[] = [];
  const consumed: [number, number][] = [];

  // Longest keywords first so "27 inch monitor" wins over the generic "monitor".
  const candidates = products
    .flatMap((product) => productKeywords(product).map((keyword) => ({ product, keyword })))
    .sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { product, keyword: match } of candidates) {
    if (found.some((f) => f.product.id === product.id)) continue;
    let index = lower.indexOf(match);
    while (index !== -1 && consumed.some(([s, e]) => index < e && index + match.length > s)) {
      index = lower.indexOf(match, index + 1);
    }
    if (index === -1) continue;
    consumed.push([index, index + match.length]);
    const before = lower.slice(Math.max(0, index - 28), index);
    const numeric = before.match(/(\d+)\s*(x\s*)?[a-z"\-\s]*$/);
    const word = before.match(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty)\b[a-z"\-\s]*$/);
    const quantity = numeric ? parseInt(numeric[1], 10) : word ? NUMBER_WORDS[word[1]] : 1;
    found.push({ product, quantity: Math.max(1, quantity), query: match });
  }
  return found.sort((a, b) => lower.indexOf(a.query) - lower.indexOf(b.query));
}

function productKeywords(product: Product): string[] {
  const name = product.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  const map: Record<string, string[]> = {
    prd_01: ["wireless mouse", "wireless mice", "mice", "mouse"],
    prd_02: ["mechanical keyboard", "keyboard"],
    prd_03: ["usb-c hub", "usb c hub", "hub"],
    prd_04: ["27 inch monitor", "27\" monitor", "27-inch monitor", "27 inch", "qhd monitor"],
    prd_05: ["24 inch monitor", "24\" monitor", "24-inch monitor", "24 inch", "monitor"],
    prd_06: ["noise cancelling headset", "noise-cancelling headset", "headset"],
    prd_07: ["webcam", "web cam", "camera"],
    prd_08: ["laptop stand", "stand"],
    prd_09: ["hdmi cable", "hdmi"],
    prd_10: ["charging cable", "usb-c cable", "usb c cable"],
    prd_11: ["thunderbolt dock", "thunderbolt", "dock"],
    prd_12: ["bluetooth speaker", "speaker"],
    prd_13: ["office chair", "ergonomic chair", "chair"],
    prd_14: ["desk mat", "mouse pad"],
    prd_15: ["external ssd", "ssd"],
  };
  return map[product.id] ?? [name, product.sku.toLowerCase()];
}
