import "server-only";
import type { Agent, AgentType, DashboardStats } from "./contracts";
import { ApiError } from "./errors";
import { productDto, quoteDto } from "./mappers";
import type { BusinessStore } from "./store";

const employees: { type: AgentType; name: string; capabilities: string[] }[] = [
  {
    type: "support",
    name: "Support Agent",
    capabilities: [
      "Understand customer requests",
      "Extract products and quantities",
    ],
  },
  {
    type: "inventory",
    name: "Inventory Agent",
    capabilities: ["checkStock", "Check real product availability"],
  },
  {
    type: "sales",
    name: "Sales Agent",
    capabilities: ["createQuotation", "Prepare quotations for human approval"],
  },
];

export async function agents(store: BusinessStore): Promise<Agent[]> {
  const runs = await store.list("runs");
  return employees.map((employee) => {
    let tasksCompleted = 0;
    let lastActiveAt = new Date(0).toISOString();
    for (const run of runs) {
      let steps: { agent: string; status: string }[];
      try {
        steps = JSON.parse(String(run.stepsJson));
        if (!Array.isArray(steps)) throw new Error();
      } catch {
        throw new ApiError(503, "Stored operation steps are invalid.");
      }
      tasksCompleted += steps.filter(
        (step) => step.agent === employee.type && step.status === "done",
      ).length;
      if (
        steps.some((step) => step.agent === employee.type) &&
        run.$createdAt > lastActiveAt
      )
        lastActiveAt = run.$createdAt;
    }
    return {
      id: employee.type,
      ...employee,
      status: "online",
      tasksCompleted,
      lastActiveAt,
    };
  });
}

export async function dashboard(store: BusinessStore): Promise<DashboardStats> {
  const [productRows, quoteRows] = await Promise.all([
    store.list("products"),
    store.list("quotations"),
  ]);
  const products = productRows.map(productDto);
  const quotes = quoteRows.map(quoteDto);
  return {
    totalQuotations: quotes.length,
    pendingApprovals: quotes.filter((quote) => quote.status === "pending")
      .length,
    approvedValue:
      quotes
        .filter((quote) => quote.status === "approved")
        .reduce((minor, quote) => minor + Math.round(quote.total * 100), 0) /
      100,
    lowStockCount: products.filter(
      (product) => product.stock <= product.lowStockThreshold,
    ).length,
    activeAgents: 3,
  };
}
