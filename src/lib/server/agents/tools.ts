import type { BusinessStore } from "../store";
import { listProducts } from "../products";
import { checkStock } from "./inventory";
import { createQuotation } from "./sales";

// This is the complete agent tool capability set. All records originate from the
// authenticated business scope; models cannot supply an owner ID or database query.
export function agentTools(store: BusinessStore) {
  return { catalog: () => listProducts(store), checkStock, createQuotation };
}
