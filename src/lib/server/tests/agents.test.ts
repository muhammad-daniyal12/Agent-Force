import assert from "node:assert/strict";
import { test } from "node:test";
import { fallbackInterpret } from "../agents/support";
import { findProduct } from "../agents/inventory";
import { createQuotation } from "../agents/sales";
import type { Product } from "../contracts";

const mouse: Product = {
  id: "mouse",
  sku: "MOUSE-WL",
  name: "Wireless Mouse",
  category: "Mice",
  price: 29.99,
  stock: 100,
  lowStockThreshold: 5,
  updatedAt: new Date(0).toISOString(),
};
const hub: Product = {
  ...mouse,
  id: "hub",
  sku: "HUB-C",
  name: "USB-C Hub",
  price: 79.99,
  stock: 5,
};

test("fallback understands plural product names, multiple quantities and number words", () => {
  const interpretation = fallbackInterpret(
    "Hi, I need ten wireless mice and five USB-C hubs for my office, what's the price?",
    [mouse, hub],
  );
  assert.deepEqual(interpretation.items, [
    { productQuery: "wireless mice", quantity: 10 },
    { productQuery: "USB-C hubs", quantity: 5 },
  ]);
  assert.equal(findProduct("wireless mice", [mouse, hub])?.id, "mouse");
  assert.equal(findProduct("USB-C hubs", [mouse, hub])?.id, "hub");
  assert.equal(
    findProduct("mouse", [
      { ...mouse, name: "Wireless Mouse" },
      { ...mouse, id: "other", name: "Ergonomic Mouse" },
    ]),
    null,
  );
});

test("fallback does not silently clamp invalid quantities or turn refunds into purchases", () => {
  assert.deepEqual(
    fallbackInterpret("I need 0 wireless mice", [mouse]).items,
    [],
  );
  assert.deepEqual(
    fallbackInterpret("I need 1001 wireless mice", [mouse]).items,
    [],
  );
  assert.equal(
    fallbackInterpret("Please refund my broken mouse", [mouse]).intent,
    "support",
  );
});

test("PKR discount thresholds and whole-rupee rounding", () => {
  const quote = (subtotal: number) =>
    createQuotation([{ product: { ...mouse, price: subtotal }, quantity: 1 }], 0.18);
  assert.equal(quote(150_000).discount, 0);
  assert.equal(quote(150_001).discount, 7_500);
  assert.equal(quote(500_000).discount, 25_000);
  assert.equal(quote(500_001).discount, 50_000);
  const example = createQuotation(
    [
      { product: { ...mouse, price: 2_499 }, quantity: 10 },
      { product: { ...hub, price: 12_999 }, quantity: 10 },
      { product: { ...hub, id: "other", price: 6_499 }, quantity: 5 },
    ],
    0.18,
  );
  assert.equal(example.subtotal, 187_475);
  assert.equal(example.discount, 9_374);
  assert.equal(example.tax, 32_058);
  assert.equal(example.total, 210_159);
});
