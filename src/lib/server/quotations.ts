import "server-only";
import { AppwriteException, Query } from "node-appwrite";
import { ApiError } from "./errors";
import { productDto, quoteDto } from "./mappers";
import type { BusinessStore } from "./store";
import type { Quotation } from "./contracts";

export async function listQuotations(store: BusinessStore, status?: Quotation["status"]) {
  return (await store.list("quotations", [...(status ? [Query.equal("status", status)] : []), Query.orderDesc("$createdAt"), Query.orderDesc("$id")])).map(quoteDto);
}

export async function reviewQuotation(store: BusinessStore, id: string, decision: "approved" | "rejected", note?: string): Promise<Quotation> {
  try {
    await store.transaction(async transactionId => {
      const quote = quoteDto(await store.get("quotations", id, transactionId));
      if (quote.status !== "pending") throw new ApiError(409, "Quotation has already been reviewed.");
      // Conditional state transition and every stock change are in one transaction.
      // Appwrite conflict detection plus min:0 prevents double deductions/overselling.
      await store.decide(id, decision, note, transactionId);
      if (decision === "approved") {
        const quantities = new Map<string, number>();
        for (const item of quote.items) if (item.inStock) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
        for (const [productId, quantity] of quantities) {
          let product;
          try { product = productDto(await store.get("products", productId, transactionId)); }
          catch (error) { if (error instanceof ApiError && error.status === 404) throw new ApiError(409, "Quoted inventory is no longer available. Review the quotation."); throw error; }
          if (product.stock < quantity) throw new ApiError(409, "Stock changed since this quotation was prepared. Review the inventory.");
          await store.decrementStock(productId, quantity, transactionId);
        }
      }
      await store.activity("Admin", decision === "approved" ? "Approved quotation" : "Rejected quotation", id, transactionId);
    });
  } catch (error) {
    if (error instanceof AppwriteException && [400, 409].includes(error.code)) throw new ApiError(409, "Quotation or stock changed during review. Refresh and try again.");
    throw error;
  }
  return quoteDto(await store.get("quotations", id));
}
