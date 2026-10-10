import type { ActivityLog, Agent, Product, Quotation } from "@/types";
import { priceQuote } from "./pricing";

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
    capabilities: ["Build itemised quotations", "Apply volume discounts", "Calculate 18% GST & totals", "Send for human approval"],
    tasksCompleted: 97,
    lastActiveAt: ago(1),
  },
];

const p = (id: string, sku: string, name: string, category: string, price: number, stock: number, lowStockThreshold = 10, updated = 120): Product => ({
  id, sku, name, category, price, stock, lowStockThreshold, updatedAt: ago(updated),
});

/** Prices in PKR. */
export const mockProducts: Product[] = [
  p("prd_01", "MSE-WL-200", "Wireless Mouse", "Peripherals", 2_499, 86),
  p("prd_02", "KBD-MEC-410", "Mechanical Keyboard", "Peripherals", 12_999, 34),
  p("prd_03", "HUB-USBC-7", "USB-C Hub 7-in-1", "Accessories", 6_499, 7, 10, 45),
  p("prd_04", "MON-27-QHD", "27\" QHD Monitor", "Displays", 74_999, 18, 5),
  p("prd_05", "MON-24-FHD", "24\" FHD Monitor", "Displays", 38_999, 26, 5),
  p("prd_06", "HDS-NC-300", "Noise-Cancelling Headset", "Audio", 18_499, 22),
  p("prd_07", "CAM-HD-1080", "HD Webcam 1080p", "Video", 8_999, 0, 8, 30),
  p("prd_08", "STD-LAP-AL", "Aluminium Laptop Stand", "Accessories", 4_999, 41),
  p("prd_09", "CBL-HDMI-2", "HDMI 2.1 Cable (2m)", "Cables", 1_499, 140, 25),
  p("prd_10", "CBL-USBC-1", "USB-C Charging Cable (1m)", "Cables", 999, 9, 25, 20),
  p("prd_11", "DCK-TB4-PRO", "Thunderbolt 4 Dock", "Accessories", 54_999, 12, 4),
  p("prd_12", "SPK-BT-MINI", "Bluetooth Speaker Mini", "Audio", 6_999, 30),
  p("prd_13", "CHR-ERG-01", "Ergonomic Office Chair", "Furniture", 64_999, 9, 3),
  p("prd_14", "PAD-XL-DESK", "XL Desk Mat", "Accessories", 2_299, 63),
  p("prd_15", "SSD-EXT-1TB", "External SSD 1TB", "Storage", 21_999, 27, 6),
];

function quote(
  id: string,
  customerName: string,
  customerEmail: string,
  request: string,
  lines: [productId: string, quantity: number][],
  status: Quotation["status"],
  minutesAgo: number,
  reviewerNote?: string,
): Quotation {
  const items = lines.map(([productId, quantity]) => {
    const product = mockProducts.find((x) => x.id === productId)!;
    return { productId, name: product.name, quantity, unitPrice: product.price, total: product.price * quantity, inStock: product.stock >= quantity };
  });
  const { subtotal, discount, tax, total } = priceQuote(items.map((i) => i.total));
  return { id, customerName, customerEmail, request, items, subtotal, discount, tax, total, status, reviewerNote, createdAt: ago(minutesAgo) };
}

export const mockQuotations: Quotation[] = [
  quote("quo_8f21a3", "Sara Khan", "sara@brightlabs.pk",
    "Assalam o Alaikum, we're onboarding 6 new hires in Lahore. Need 6 mechanical keyboards and 6 wireless mice, delivered this week if possible.",
    [["prd_02", 6], ["prd_01", 6]], "pending", 12),
  quote("quo_7c19be", "Omar Farooq", "omar@nexadesign.co",
    "Price for 4 x 27 inch monitors and 4 laptop stands for our design studio in Karachi?",
    [["prd_04", 4], ["prd_08", 4]], "pending", 38),
  quote("quo_5a02d4", "Ayesha Malik", "ayesha@greenleaf.pk",
    "Need 10 HDMI cables and 2 Thunderbolt docks for the conference room.",
    [["prd_09", 10], ["prd_11", 2]], "approved", 190, "Approved: repeat customer."),
  quote("quo_3e77f0", "Bilal Ahmed", "bilal@quickcart.pk",
    "Can I get 20 webcams at a 30% discount?",
    [["prd_07", 20]], "rejected", 320, "Out of stock and discount outside policy."),
  quote("quo_2b40c9", "Hina Siddiqui", "hina@studio88.pk",
    "3 noise cancelling headsets and 3 external SSDs please, for our Islamabad office.",
    [["prd_06", 3], ["prd_15", 3]], "approved", 1440),
];

export const mockActivity: ActivityLog[] = [
  { id: "act_1", actor: "Sales Agent", action: "created quotation", target: "QUO-8F21A3 · Sara Khan", createdAt: ago(12) },
  { id: "act_2", actor: "Inventory Agent", action: "checked stock for", target: "Mechanical Keyboard, Wireless Mouse", createdAt: ago(12) },
  { id: "act_3", actor: "Support Agent", action: "parsed request from", target: "sara@brightlabs.pk", createdAt: ago(13) },
  { id: "act_4", actor: "Sales Agent", action: "created quotation", target: "QUO-7C19BE · Omar Farooq", createdAt: ago(38) },
  { id: "act_5", actor: "Inventory Agent", action: "flagged low stock", target: "USB-C Hub 7-in-1", createdAt: ago(45) },
  { id: "act_6", actor: "Admin", action: "approved quotation", target: "QUO-5A02D4 · Ayesha Malik", createdAt: ago(180) },
  { id: "act_7", actor: "Admin", action: "rejected quotation", target: "QUO-3E77F0 · Bilal Ahmed", createdAt: ago(310) },
];
