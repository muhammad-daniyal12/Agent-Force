// Follow-up Agent: finds quotations that need a nudge and drafts the message.
// Runs in the browser from existing quotation data; "done" marks are kept per
// browser until the backend stores follow-up status.
import type { Quotation } from "@/types";
import type { BusinessProfile } from "@/lib/business";
import { formatCurrency, shortId } from "@/lib/utils";

/** Approved quotes older than this get a customer check-in. */
export const CUSTOMER_FOLLOW_UP_AFTER_MS = 2 * 60 * 60 * 1000;
/** Pending quotes older than this remind the owner to decide. */
export const OWNER_REMINDER_AFTER_MS = 30 * 60 * 1000;

export type FollowUp =
  | { kind: "customer"; quotation: Quotation; ageMs: number }
  | { kind: "owner"; quotation: Quotation; ageMs: number };

const DONE_KEY = "agentforce.followups-done";

export function readDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markDone(quotationId: string) {
  const done = readDone();
  done.add(quotationId);
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    // Storage blocked: the item reappears after a reload.
  }
  window.dispatchEvent(new Event(FOLLOWUPS_CHANGED));
}

export const FOLLOWUPS_CHANGED = "agentforce:followups-changed";

export function findFollowUps(quotations: Quotation[], done: Set<string>, now = Date.now()): FollowUp[] {
  const items: FollowUp[] = [];
  for (const q of quotations) {
    if (done.has(q.id)) continue;
    const ageMs = now - new Date(q.createdAt).getTime();
    if (q.status === "approved" && ageMs >= CUSTOMER_FOLLOW_UP_AFTER_MS) items.push({ kind: "customer", quotation: q, ageMs });
    if (q.status === "pending" && ageMs >= OWNER_REMINDER_AFTER_MS) items.push({ kind: "owner", quotation: q, ageMs });
  }
  // Owner decisions first (they block everything else), then the oldest customer check-ins.
  return items.sort((a, b) => (a.kind === b.kind ? b.ageMs - a.ageMs : a.kind === "owner" ? -1 : 1));
}

/** Polite check-in for a customer who received an approved quotation. */
export function draftFollowUp(q: Quotation, biz: BusinessProfile) {
  const firstName = q.customerName.split(" ")[0];
  const items = q.items.map((i) => `${i.quantity} × ${i.name}`).join(", ");
  return [
    `Dear ${firstName},`,
    "",
    `Hope you're well. Just checking in on quotation QUO-${shortId(q.id)} for ${items} (total ${formatCurrency(q.total)}).`,
    "",
    "Would you like us to go ahead with the order? We can reserve the stock for you today, and we're happy to adjust quantities if your needs have changed.",
    "",
    "Best regards,",
    [biz.name, biz.city].filter(Boolean).join(", "),
    ...(biz.phone ? [biz.phone] : []),
  ].join("\n");
}

export function formatAge(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""}`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? "s" : ""}`;
}
