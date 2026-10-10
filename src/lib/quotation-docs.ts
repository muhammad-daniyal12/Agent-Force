// Customer-facing outputs for a quotation: the Support Agent's reply draft and a printable PDF.
import type { Quotation } from "@/types";
import type { BusinessProfile } from "@/lib/business";
import { toWhatsAppNumber } from "@/lib/business";
import { formatCurrency, formatDate, shortId, taxLabel } from "@/lib/utils";

/** The Relay mark in fixed colours (the print window has no theme variables). Keep in sync with BrandMark. */
const AGENTFORCE_MARK_SVG = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 34 L18 22 L28 30 L38 14" stroke="#059669" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="34" r="5" fill="#2563eb"/><circle cx="18" cy="22" r="5" fill="#d97706"/><circle cx="28" cy="30" r="5" fill="#7c3aed"/><circle cx="38" cy="14" r="7.5" fill="#059669"/><path d="M34.6 14.2 L37 16.6 L41.4 11.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** "Name, City" or just "Name". */
const signature = (b: BusinessProfile) => [b.name, b.city].filter(Boolean).join(", ");

/** Minutes a person typically spends reading a request, checking stock and pricing a quote by hand. */
export const MINUTES_SAVED_PER_QUOTE = 20;

export function draftReply(q: Quotation, biz: BusinessProfile) {
  const firstName = q.customerName.split(" ")[0];
  const lines = q.items.map((i) => `• ${i.quantity} × ${i.name} @ ${formatCurrency(i.unitPrice)} = ${formatCurrency(i.total)}`);
  const short = q.items.filter((i) => !i.inStock);
  return [
    `Dear ${firstName},`,
    "",
    `Thank you for contacting ${biz.name}. Here is your quotation QUO-${shortId(q.id)}:`,
    "",
    ...lines,
    "",
    `Subtotal: ${formatCurrency(q.subtotal)}`,
    ...(q.discount > 0 ? [`Volume discount: −${formatCurrency(q.discount)}`] : []),
    `${taxLabel(q)}: ${formatCurrency(q.tax)}`,
    `Total: ${formatCurrency(q.total)}`,
    "",
    ...(short.length > 0
      ? [
          `Please note: ${short.map((i) => i.name).join(", ")} ${short.length > 1 ? "have" : "has"} limited stock right now. We can deliver the available units immediately and the rest within 5 working days.`,
          "",
        ]
      : []),
    "This quotation is valid for 7 days. Just reply to this message to confirm your order.",
    "",
    "Best regards,",
    signature(biz),
    ...(biz.phone ? [biz.phone] : []),
  ].join("\n");
}

/** Opens WhatsApp with the text ready; goes straight to the customer's chat when a phone is known. */
export const whatsappLink = (text: string, phone = "") => `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`;

export const emailLink = (q: Quotation, text: string, biz: BusinessProfile) =>
  `mailto:${q.customerEmail}?subject=${encodeURIComponent(`Quotation QUO-${shortId(q.id)} from ${biz.name}`)}&body=${encodeURIComponent(text)}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Opens a print-ready quotation; the browser's "Save as PDF" produces the file. */
export function printQuotation(q: Quotation, biz: BusinessProfile) {
  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) return false;
  const rows = q.items
    .map(
      (i) => `<tr><td>${esc(i.name)}${i.inStock ? "" : ' <span class="tag">Limited stock</span>'}</td><td class="r">${i.quantity}</td><td class="r">${formatCurrency(i.unitPrice)}</td><td class="r">${formatCurrency(i.total)}</td></tr>`,
    )
    .join("");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Quotation QUO-${shortId(q.id)}</title>
<style>
  *{box-sizing:border-box} body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;margin:0;padding:48px;font-size:13px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #059669;padding-bottom:20px}
  .brand{font-size:22px;font-weight:700;color:#059669} .muted{color:#586274} h1{font-size:20px;margin:0 0 4px}
  .meta{display:flex;gap:48px;margin:28px 0} .meta b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#929db0;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-top:8px} th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#929db0;border-bottom:1px solid #e2e7ee;padding:8px 0}
  td{padding:10px 0;border-bottom:1px solid #eff2f6} .r{text-align:right} .tag{font-size:10px;color:#d97706;background:#fdf1df;padding:2px 6px;border-radius:99px}
  .totals{margin-left:auto;width:280px;margin-top:16px} .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .grand{border-top:2px solid #0f172a;margin-top:6px;padding-top:10px!important;font-size:16px;font-weight:700}
  .foot{margin-top:48px;padding-top:16px;border-top:1px solid #e2e7ee;font-size:11px;color:#586274;display:flex;align-items:center;gap:10px}
  .foot svg{width:22px;height:22px;flex:none}
  @media print{body{padding:24px}}
</style></head><body>
<div class="top"><div><div class="brand">${esc(biz.name)}</div><div class="muted">${esc([biz.city ? `${biz.city}, Pakistan` : "Pakistan", biz.phone, biz.email].filter(Boolean).join(" · "))}</div></div>
<div style="text-align:right"><h1>Quotation</h1><div class="muted">QUO-${shortId(q.id)}</div></div></div>
<div class="meta"><div><b>Prepared for</b>${esc(q.customerName)}<br><span class="muted">${esc(q.customerEmail)}</span></div>
<div><b>Date</b>${formatDate(q.createdAt)}</div><div><b>Valid for</b>7 days</div><div><b>Status</b>${q.status === "approved" ? "Approved" : q.status === "rejected" ? "Rejected" : "Draft, pending approval"}</div></div>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span class="muted">Subtotal</span><span>${formatCurrency(q.subtotal)}</span></div>
${q.discount > 0 ? `<div><span class="muted">Volume discount</span><span>−${formatCurrency(q.discount)}</span></div>` : ""}
<div><span class="muted">${taxLabel(q)}</span><span>${formatCurrency(q.tax)}</span></div>
<div class="grand"><span>Total</span><span>${formatCurrency(q.total)}</span></div></div>
<div class="foot">${AGENTFORCE_MARK_SVG}<span>Prepared by AgentForce AI agents and reviewed by ${esc(biz.name)}. Prices in Pakistani Rupees, inclusive of GST.</span></div>
<script>window.onload=()=>{window.print()}</script></body></html>`);
  win.document.close();
  return true;
}
