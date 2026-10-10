export type Column = {
  key: string;
  type:
    | "varchar"
    | "text"
    | "mediumtext"
    | "integer"
    | "float"
    | "enum"
    | "datetime";
  required: boolean;
  array?: boolean;
  size?: number;
  min?: number;
  max?: number;
  elements?: string[];
};
export type Index = {
  key: string;
  type: "key" | "unique";
  columns: string[];
  orders?: string[];
};
const owner: Column = {
  key: "owner_user_id",
  type: "varchar",
  size: 36,
  required: true,
};
const text = (key: string, size: number, required = true): Column => ({
  key,
  type: "varchar",
  size,
  required,
});
const money = (key: string, max = 1000000000000): Column => ({
  key,
  type: "float",
  min: 0,
  max,
  required: true,
});
const history: Index = {
  key: "owner_created",
  type: "key",
  columns: ["owner_user_id", "$createdAt", "$id"],
  orders: ["ASC", "DESC", "DESC"],
};

export const businessSchema: {
  configKey: "products" | "quotations" | "runs" | "activity" | "rateLimits" | "settings" | "dealers" | "restockOrders";
  columns: Column[];
  indexes: Index[];
}[] = [
  {
    configKey: "products",
    columns: [
      owner,
      text("sku", 64),
      text("name", 200),
      text("category", 100),
      money("price", 1000000),
      { key: "stock", type: "integer", min: 0, max: 1000000, required: true },
      {
        key: "lowStockThreshold",
        type: "integer",
        min: 0,
        max: 1000000,
        required: true,
      },
    ],
    indexes: [
      history,
      { key: "owner_sku", type: "unique", columns: ["owner_user_id", "sku"] },
    ],
  },
  {
    configKey: "quotations",
    columns: [
      owner,
      text("customerName", 120),
      text("customerEmail", 254),
      text("customerPhone", 20, false),
      { key: "request", type: "text", required: true },
      { key: "itemsJson", type: "text", required: true },
      money("subtotal"),
      money("discount"),
      money("tax"),
      money("total"),
      {
        key: "status",
        type: "enum",
        elements: ["pending", "approved", "rejected"],
        required: true,
      },
      text("reviewerNote", 1000, false),
      text("reviewer_user_id", 36, false),
      { key: "reviewed_at", type: "datetime", required: false },
      { key: "followedUpAt", type: "datetime", required: false },
      { key: "demo_tax_rate", type: "float", min: 0, max: 1, required: true },
    ],
    indexes: [
      history,
      {
        key: "owner_status_created",
        type: "key",
        columns: ["owner_user_id", "status", "$createdAt", "$id"],
        orders: ["ASC", "ASC", "DESC", "DESC"],
      },
    ],
  },
  {
    configKey: "runs",
    columns: [
      owner,
      { key: "request", type: "text", required: true },
      { key: "stepsJson", type: "mediumtext", required: true },
      text("quotationId", 36, false),
      { key: "summary", type: "text", required: true },
      text("idempotencyKey", 128, false),
      text("requestHash", 64, false),
    ],
    indexes: [
      history,
      {
        key: "owner_idempotency",
        type: "unique",
        columns: ["owner_user_id", "idempotencyKey"],
      },
    ],
  },
  {
    configKey: "activity",
    columns: [
      owner,
      text("actor", 64),
      text("action", 200),
      text("target", 200),
    ],
    indexes: [history],
  },
  {
    configKey: "settings",
    columns: [
      owner,
      text("name", 120),
      text("city", 80),
      text("phone", 20),
      text("email", 254),
    ],
    indexes: [history],
  },
  {
    configKey: "dealers",
    columns: [
      owner,
      text("name", 120),
      text("phone", 20),
      text("email", 254),
      { key: "categories", type: "varchar", size: 100, array: true, required: false },
    ],
    indexes: [history],
  },
  {
    configKey: "restockOrders",
    columns: [
      owner,
      text("dealerId", 36),
      { key: "itemsJson", type: "text", required: true },
      {
        key: "status",
        type: "enum",
        elements: ["draft", "sent"],
        required: true,
      },
      { key: "sentAt", type: "datetime", required: false },
    ],
    indexes: [history],
  },
  {
    configKey: "rateLimits",
    columns: [
      { key: "count", type: "integer", min: 0, max: 1000000, required: true },
      { key: "expires_at", type: "datetime", required: true },
    ],
    indexes: [{ key: "expiry", type: "key", columns: ["expires_at"] }],
  },
];
