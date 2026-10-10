import type { ActivityLog, Agent, Product, Quotation } from "@/types";

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

export const mockAgents: Agent[] = [
  {
    id: "agent_support",
    type: "support",
    name: "Support Agent",
    status: "online",
    capabilities: ["Understand customer requests", "Extract products & quantities", "Detect urgency & sentiment", "Draft customer replies"],
    tasksCompleted: 148,
    lastActiveAt: ago(3),
  },
  {
    id: "agent_inventory",
    type: "inventory",
    name: "Inventory Agent",
    status: "online",
    capabilities: ["Check live stock levels", "Match products by name or SKU", "Flag low & out-of-stock items", "Suggest alternatives"],
    tasksCompleted: 131,
    lastActiveAt: ago(3),
  },
  {
    id: "agent_sales",
    type: "sales",
    name: "Sales Agent",
    status: "busy",
    capabilities: ["Build itemised quotations", "Apply volume discounts", "Calculate tax & totals", "Send for human approval"],
    tasksCompleted: 97,
    lastActiveAt: ago(1),
  },
];

const p = (id: string, sku: string, name: string, category: string, price: number, stock: number, lowStockThreshold = 10, updated = 120): Product => ({
  id, sku, name, category, price, stock, lowStockThreshold, updatedAt: ago(updated),
});

export const mockProducts: Product[] = [
  p("prd_01", "MSE-WL-200", "Wireless Mouse", "Peripherals", 24.99, 86),
  p("prd_02", "KBD-MEC-410", "Mechanical Keyboard", "Peripherals", 89.0, 34),
  p("prd_03", "HUB-USBC-7", "USB-C Hub 7-in-1", "Accessories", 39.5, 7, 10, 45),
  p("prd_04", "MON-27-QHD", "27\" QHD Monitor", "Displays", 279.0, 18, 5),
  p("prd_05", "MON-24-FHD", "24\" FHD Monitor", "Displays", 149.0, 26, 5),
  p("prd_06", "HDS-NC-300", "Noise-Cancelling Headset", "Audio", 119.0, 22),
  p("prd_07", "CAM-HD-1080", "HD Webcam 1080p", "Video", 59.0, 0, 8, 30),
  p("prd_08", "STD-LAP-AL", "Aluminium Laptop Stand", "Accessories", 34.0, 41),
  p("prd_09", "CBL-HDMI-2", "HDMI 2.1 Cable (2m)", "Cables", 12.5, 140, 25),
  p("prd_10", "CBL-USBC-1", "USB-C Charging Cable (1m)", "Cables", 9.99, 9, 25, 20),
  p("prd_11", "DCK-TB4-PRO", "Thunderbolt 4 Dock", "Accessories", 229.0, 12, 4),
  p("prd_12", "SPK-BT-MINI", "Bluetooth Speaker Mini", "Audio", 45.0, 30),
  p("prd_13", "CHR-ERG-01", "Ergonomic Office Chair", "Furniture", 249.0, 9, 3),
  p("prd_14", "PAD-XL-DESK", "XL Desk Mat", "Accessories", 19.0, 63),
  p("prd_15", "SSD-EXT-1TB", "External SSD 1TB", "Storage", 99.0, 27, 6),
];

export const mockQuotations: Quotation[] = [
  {
    id: "quo_8f21a3",
    customerName: "Sara Khan",
    customerEmail: "sara@brightlabs.io",
    request: "We're onboarding 6 new hires. Need 6 mechanical keyboards and 6 wireless mice, delivered this week if possible.",
    items: [
      { productId: "prd_02", name: "Mechanical Keyboard", quantity: 6, unitPrice: 89, total: 534, inStock: true },
      { productId: "prd_01", name: "Wireless Mouse", quantity: 6, unitPrice: 24.99, total: 149.94, inStock: true },
    ],
    subtotal: 683.94,
    discount: 34.2,
    tax: 51.98,
    total: 701.72,
    status: "pending",
    createdAt: ago(12),
  },
  {
    id: "quo_7c19be",
    customerName: "Omar Farooq",
    customerEmail: "omar@nexadesign.co",
    request: "Price for 4 x 27 inch monitors and 4 laptop stands for our design studio?",
    items: [
      { productId: "prd_04", name: "27\" QHD Monitor", quantity: 4, unitPrice: 279, total: 1116, inStock: true },
      { productId: "prd_08", name: "Aluminium Laptop Stand", quantity: 4, unitPrice: 34, total: 136, inStock: true },
    ],
    subtotal: 1252,
    discount: 62.6,
    tax: 95.15,
    total: 1284.55,
    status: "pending",
    createdAt: ago(38),
  },
  {
    id: "quo_5a02d4",
    customerName: "Ayesha Malik",
    customerEmail: "ayesha@greenleaf.pk",
    request: "Need 10 HDMI cables and 2 Thunderbolt docks for the conference room.",
    items: [
      { productId: "prd_09", name: "HDMI 2.1 Cable (2m)", quantity: 10, unitPrice: 12.5, total: 125, inStock: true },
      { productId: "prd_11", name: "Thunderbolt 4 Dock", quantity: 2, unitPrice: 229, total: 458, inStock: true },
    ],
    subtotal: 583,
    discount: 29.15,
    tax: 44.31,
    total: 598.16,
    status: "approved",
    reviewerNote: "Approved — repeat customer.",
    createdAt: ago(190),
  },
  {
    id: "quo_3e77f0",
    customerName: "Bilal Ahmed",
    customerEmail: "bilal@quickcart.store",
    request: "Can I get 20 webcams at a 30% discount?",
    items: [{ productId: "prd_07", name: "HD Webcam 1080p", quantity: 20, unitPrice: 59, total: 1180, inStock: false }],
    subtotal: 1180,
    discount: 59,
    tax: 89.68,
    total: 1210.68,
    status: "rejected",
    reviewerNote: "Out of stock and discount outside policy.",
    createdAt: ago(320),
  },
  {
    id: "quo_2b40c9",
    customerName: "Hina Siddiqui",
    customerEmail: "hina@studio88.com",
    request: "3 noise cancelling headsets and 3 external SSDs please.",
    items: [
      { productId: "prd_06", name: "Noise-Cancelling Headset", quantity: 3, unitPrice: 119, total: 357, inStock: true },
      { productId: "prd_15", name: "External SSD 1TB", quantity: 3, unitPrice: 99, total: 297, inStock: true },
    ],
    subtotal: 654,
    discount: 32.7,
    tax: 49.7,
    total: 671.0,
    status: "approved",
    createdAt: ago(1440),
  },
];

export const mockActivity: ActivityLog[] = [
  { id: "act_1", actor: "Sales Agent", action: "created quotation", target: "QUO-8F21A3 · Sara Khan", createdAt: ago(12) },
  { id: "act_2", actor: "Inventory Agent", action: "checked stock for", target: "Mechanical Keyboard, Wireless Mouse", createdAt: ago(12) },
  { id: "act_3", actor: "Support Agent", action: "parsed request from", target: "sara@brightlabs.io", createdAt: ago(13) },
  { id: "act_4", actor: "Sales Agent", action: "created quotation", target: "QUO-7C19BE · Omar Farooq", createdAt: ago(38) },
  { id: "act_5", actor: "Inventory Agent", action: "flagged low stock", target: "USB-C Hub 7-in-1", createdAt: ago(45) },
  { id: "act_6", actor: "Admin", action: "approved quotation", target: "QUO-5A02D4 · Ayesha Malik", createdAt: ago(180) },
  { id: "act_7", actor: "Admin", action: "rejected quotation", target: "QUO-3E77F0 · Bilal Ahmed", createdAt: ago(310) },
];

/** Quotation volume for the last 7 days (dashboard chart). */
export const mockWeeklyVolume = [
  { day: "Mon", quotations: 6, approved: 4 },
  { day: "Tue", quotations: 9, approved: 7 },
  { day: "Wed", quotations: 7, approved: 5 },
  { day: "Thu", quotations: 12, approved: 9 },
  { day: "Fri", quotations: 10, approved: 8 },
  { day: "Sat", quotations: 5, approved: 4 },
  { day: "Sun", quotations: 8, approved: 5 },
];
