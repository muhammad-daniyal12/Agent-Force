import { Boxes, Headset, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";
import type { AgentType } from "@/types";
import { cn } from "@/lib/utils";

export const agentMeta: Record<AgentType, { label: string; icon: LucideIcon; text: string; soft: string; tile: string; tagline: string }> = {
  support: { label: "Support", icon: Headset, text: "text-support", soft: "bg-support-soft", tile: "from-blue-500 to-blue-600", tagline: "Reads and understands every customer request" },
  inventory: { label: "Inventory", icon: Boxes, text: "text-inventory", soft: "bg-inventory-soft", tile: "from-amber-400 to-orange-500", tagline: "Checks live stock before anything is promised" },
  sales: { label: "Sales", icon: Receipt, text: "text-sales", soft: "bg-sales-soft", tile: "from-violet-500 to-purple-600", tagline: "Builds accurate quotations for human approval" },
};

const dims = { sm: "h-7 w-7 rounded-lg", md: "h-9 w-9 rounded-xl", lg: "h-11 w-11 rounded-xl" } as const;
const iconSize = { sm: "h-3.5 w-3.5", md: "h-[18px] w-[18px]", lg: "h-5 w-5" } as const;

/** Solid colour tile with a white icon: the same agent colours as the logo and login demo, legible in light and dark mode. */
function Tile({ gradient, size, children }: { gradient: string; size: keyof typeof dims; children: React.ReactNode }) {
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm ring-1 ring-inset ring-white/15", dims[size], gradient)}>
      {children}
    </div>
  );
}

export function AgentAvatar({ type, size = "md" }: { type: AgentType; size?: "sm" | "md" | "lg" }) {
  const meta = agentMeta[type];
  const Icon = meta.icon;
  return (
    <Tile gradient={meta.tile} size={size}>
      <Icon className={iconSize[size]} strokeWidth={2.2} aria-hidden />
    </Tile>
  );
}

/** Avatar for an activity actor name like "Sales Agent" or "Admin" (the owner). */
export function ActorAvatar({ actor }: { actor: string }) {
  const type = (Object.keys(agentMeta) as AgentType[]).find((t) => actor.toLowerCase().startsWith(t));
  if (type) return <AgentAvatar type={type} size="sm" />;
  return (
    <Tile gradient="from-emerald-500 to-emerald-600" size="sm">
      <ShieldCheck className={iconSize.sm} strokeWidth={2.2} aria-hidden />
    </Tile>
  );
}
