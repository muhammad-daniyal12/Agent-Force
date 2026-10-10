// Backend-local copies of the approved frontend DTOs. Do not edit src/types/index.ts.
export type AgentType = "support" | "inventory" | "sales";
export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  status: "online" | "busy" | "offline";
  capabilities: string[];
  tasksCompleted: number;
  lastActiveAt: string;
}
export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  updatedAt: string;
}
export interface QuotationItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  inStock: boolean;
}
export interface Quotation {
  id: string;
  customerName: string;
  customerEmail: string;
  request: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: "pending" | "approved" | "rejected";
  reviewerNote?: string;
  createdAt: string;
}
export interface AgentStep {
  id: string;
  agent: AgentType;
  title: string;
  status: "done" | "failed";
  tool?: string;
  input?: unknown;
  output?: unknown;
  durationMs: number;
}
export interface OperationRun {
  id: string;
  steps: AgentStep[];
  quotation: Quotation | null;
  summary: string;
}
export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
}
export interface DashboardStats {
  totalQuotations: number;
  pendingApprovals: number;
  approvedValue: number;
  lowStockCount: number;
  activeAgents: number;
}
