"use client";

import { Repeat, UserPlus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { formatCurrencyShort } from "@/lib/utils";
import { Badge } from "@/components/ui";

/** Repeat-customer context from earlier quotations with the same email. */
export function CustomerInsight({ email, excludeId }: { email: string; excludeId: string }) {
  const { data } = useAsync(() => api.quotations(), [email]);
  if (!data) return null;

  const needle = email.trim().toLowerCase();
  const past = data.filter((q) => q.id !== excludeId && q.customerEmail.trim().toLowerCase() === needle);
  if (past.length === 0) {
    return (
      <Badge tone="neutral">
        <UserPlus className="h-3 w-3" aria-hidden /> New customer
      </Badge>
    );
  }

  const approved = past.filter((q) => q.status === "approved");
  const value = approved.reduce((s, q) => s + q.total, 0);
  return (
    <Badge tone="primary" className="whitespace-normal">
      <Repeat className="h-3 w-3" aria-hidden />
      Repeat customer · {past.length} previous quote{past.length > 1 ? "s" : ""}
      {approved.length > 0 && ` · ${formatCurrencyShort(value)} approved`}
    </Badge>
  );
}
