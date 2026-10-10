import "server-only";
import { createHash } from "node:crypto";
import { AppwriteException, ID, Query } from "node-appwrite";
import { z } from "zod";
import { demoTaxRate, workflowTimeoutMs } from "../../appwrite/config";
import type { AgentStep, OperationRun, Quotation, Product } from "../contracts";
import { ApiError } from "../errors";
import { interpretRequest } from "../llm";
import { quoteDto } from "../mappers";
import { rateLimit } from "../rate-limit";
import type { BusinessRow, BusinessStore } from "../store";
import { operationInput } from "../validation";
import { agentTools } from "./tools";

export async function runOperation(
  store: BusinessStore,
  input: z.infer<typeof operationInput>,
  idempotencyKey?: string,
): Promise<OperationRun> {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  async function replay(): Promise<OperationRun | undefined> {
    if (!idempotencyKey) return;
    const existing = (
      await store.list("runs", [Query.equal("idempotencyKey", idempotencyKey)])
    )[0];
    if (!existing) return;
    if (existing.requestHash !== hash)
      throw new ApiError(
        409,
        "Idempotency key was already used for a different request.",
      );
    let steps: AgentStep[];
    try {
      steps = JSON.parse(String(existing.stepsJson));
      if (!Array.isArray(steps)) throw new Error();
    } catch {
      throw new ApiError(503, "Stored operation steps are invalid.");
    }
    return {
      id: existing.$id,
      steps,
      quotation: existing.quotationId
        ? quoteDto(await store.get("quotations", String(existing.quotationId)))
        : null,
      summary: String(existing.summary),
    };
  }
  const previous = await replay();
  if (previous) return previous;
  await rateLimit(store.db, `${store.ownerId}:operations`, 5);
  const deadline = Date.now() + workflowTimeoutMs();
  const taxRate = demoTaxRate();
  const tools = agentTools(store);
  const catalog = await tools.catalog();
  const steps: AgentStep[] = [];
  let started = Date.now();
  const support = await interpretRequest(input.request, catalog, deadline);
  const suffix = support.fallback ? " (fallback)" : "";
  steps.push({
    id: ID.unique(),
    agent: "support",
    title: `Understood customer request${suffix}`,
    status: "done",
    tool: "extract_request",
    input: { request: input.request },
    output: support.interpretation,
    durationMs: Date.now() - started,
  });
  let summary: string;
  let quoteData: ReturnType<typeof tools.createQuotation> | undefined;
  if (!["quote", "purchase"].includes(support.interpretation.intent)) {
    summary =
      support.interpretation.intent === "support"
        ? "Your support request has been recorded for the owner. No quotation or inventory change was made."
        : "Please tell us which office products and quantities you would like quoted.";
  } else if (!support.interpretation.items.length) {
    summary =
      "Please specify product names or SKUs and quantities between 1 and 1,000 so we can prepare a quotation.";
  } else {
    started = Date.now();
    const matched = new Map<string, { product: Product; quantity: number }>();
    const unmatched: string[] = [];
    for (const item of support.interpretation.items) {
      const stock = tools.checkStock(item.productQuery, item.quantity, catalog);
      if (!stock.product) {
        unmatched.push(item.productQuery);
        continue;
      }
      const prior = matched.get(stock.product.id);
      matched.set(stock.product.id, {
        product: stock.product,
        quantity: (prior?.quantity ?? 0) + item.quantity,
      });
    }
    const matches = [...matched.values()];
    steps.push({
      id: ID.unique(),
      agent: "inventory",
      title: `Checked real stock${suffix}`,
      status: "done",
      tool: "checkStock",
      input: support.interpretation.items,
      output: {
        matched: matches.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          requested: quantity,
          available: product.stock,
          inStock: product.stock >= quantity,
        })),
        unmatched,
      },
      durationMs: Date.now() - started,
    });
    if (!matches.length)
      summary =
        "We could not match these products unambiguously. Please provide exact product names or SKUs from the inventory.";
    else if (matches.some((match) => match.quantity > 1000))
      summary =
        "The combined quantity of a product exceeds 1,000. Please revise the request.";
    else {
      started = Date.now();
      quoteData = tools.createQuotation(matches, taxRate);
      steps.push({
        id: ID.unique(),
        agent: "sales",
        title: `Prepared quotation for approval${suffix}`,
        status: "done",
        tool: "createQuotation",
        input: { productIds: matches.map((match) => match.product.id) },
        output: {
          subtotal: quoteData.subtotal,
          discount: quoteData.discount,
          tax: quoteData.tax,
          total: quoteData.total,
          status: "pending",
          taxSetting: "demo",
        },
        durationMs: Date.now() - started,
      });
      const warnings = [
        unmatched.length ? "Some requested products were unmatched." : "",
        quoteData.items.some((item) => !item.inStock)
          ? "Some quantities are unavailable and are flagged in the quotation."
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      summary = `Quotation prepared with demo discount/tax settings and is waiting for human approval.${warnings ? ` ${warnings}` : ""}`;
    }
  }
  if (Date.now() >= deadline)
    throw new ApiError(
      504,
      "Operation exceeded its time budget. Please retry.",
    );
  const runId = ID.unique();
  let persistedQuote: BusinessRow | undefined;
  try {
    await store.transaction(async (transactionId) => {
      if (quoteData)
        persistedQuote = await store.create(
          "quotations",
          {
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
            request: input.request,
            itemsJson: JSON.stringify(quoteData.items),
            subtotal: quoteData.subtotal,
            discount: quoteData.discount,
            tax: quoteData.tax,
            total: quoteData.total,
            status: "pending",
            demo_tax_rate: taxRate,
          },
          transactionId,
        );
      await store.create(
        "runs",
        {
          request: input.request,
          stepsJson: JSON.stringify(steps),
          quotationId: persistedQuote?.$id ?? null,
          summary,
          idempotencyKey: idempotencyKey ?? null,
          requestHash: idempotencyKey ? hash : null,
        },
        transactionId,
        runId,
      );
      for (const step of steps)
        await store.activity(
          `${step.agent[0].toUpperCase()}${step.agent.slice(1)} Agent`,
          step.title,
          runId,
          transactionId,
        );
      if (persistedQuote)
        await store.activity(
          "Sales Agent",
          "Created pending quotation",
          persistedQuote.$id,
          transactionId,
        );
    });
  } catch (error) {
    if (
      idempotencyKey &&
      error instanceof AppwriteException &&
      error.code === 409
    ) {
      const duplicate = await replay();
      if (duplicate) return duplicate;
    }
    throw error;
  }
  const quotation: Quotation | null = persistedQuote
    ? quoteDto(await store.get("quotations", persistedQuote.$id))
    : null;
  return { id: runId, steps, quotation, summary };
}
