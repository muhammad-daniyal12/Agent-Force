import { Boxes, Headset, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";
import type { AgentType } from "@/types";
import { cn } from "@/lib/utils";

export const agentMeta: Record<AgentType, { label: string; icon: LucideIcon; text: string; soft: string; tagline: string }> = {
  support: { label: "Support", icon: Headset, text: "text-support", soft: "bg-support-soft", tagline: "Reads and understands every customer request" },
  inventory: { label: "Inventory", icon: Boxes, text: "text-inventory", soft: "bg-inventory-soft", tagline: "Checks live stock before anything is promised" },
  sales: { label: "Sales", icon: Receipt, text: "text-sales", soft: "bg-sales-soft", tagline: "Builds accurate quotations for human approval" },
};

export function AgentAvatar({ type, size = "md" }: { type: AgentType; size?: "sm" | "md" | "lg" }) {
  const meta = agentMeta[type];
  const Icon = meta.icon;
  const dims = { sm: "h-7 w-7 rounded-md", md: "h-9 w-9 rounded-lg", lg: "h-11 w-11 rounded-xl" }[size];
  const icon = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" }[size];
  return (
    <div className={cn("flex shrink-0 items-center justify-center", dims, meta.soft, meta.text)}>
      <Icon className={icon} aria-hidden />
    </div>
  );
}

/** Avatar for an activity actor name like "Sales Agent" or "Admin". */
export function ActorAvatar({ actor }: { actor: string }) {
  const type = (Object.keys(agentMeta) as AgentType[]).find((t) => actor.toLowerCase().startsWith(t));
  if (type) return <AgentAvatar type={type} size="sm" />;
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
    </div>
  );
}
