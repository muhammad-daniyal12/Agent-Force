// Customer-facing outputs for a quotation: the Support Agent's reply draft and a printable PDF.
import type { Quotation } from "@/types";
import { formatCurrency, formatDate, shortId, taxLabel } from "@/lib/utils";

export const BUSINESS = { name: "Nova Tech Supplies", city: "Lahore", phone: "+92 300 1234567", email: "sales@novatech.pk" };

/** Minutes a person typically spends reading a request, checking stock and pricing a quote by hand. */
export const MINUTES_SAVED_PER_QUOTE = 20;

export function draftReply(q: Quotation) {
  const firstName = q.customerName.split(" ")[0];
  const lines = q.items.map((i) => `• ${i.quantity} × ${i.name} @ ${formatCurrency(i.unitPrice)} = ${formatCurrency(i.total)}`);
  const short = q.items.filter((i) => !i.inStock);
  return [
    `Dear ${firstName},`,
    "",
    `Thank you for contacting ${BUSINESS.name}. Here is your quotation QUO-${shortId(q.id)}:`,
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
    `${BUSINESS.name}, ${BUSINESS.city}`,
    BUSINESS.phone,
  ].join("\n");
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const emailLink = (q: Quotation, text: string) =>
  `mailto:${q.customerEmail}?subject=${encodeURIComponent(`Quotation QUO-${shortId(q.id)} from ${BUSINESS.name}`)}&body=${encodeURIComponent(text)}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Opens a print-ready quotation; the browser's "Save as PDF" produces the file. */
export function printQuotation(q: Quotation) {
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
  .foot{margin-top:48px;padding-top:16px;border-top:1px solid #e2e7ee;font-size:11px;color:#586274}
  @media print{body{padding:24px}}
</style></head><body>
<div class="top"><div><div class="brand">${BUSINESS.name}</div><div class="muted">${BUSINESS.city}, Pakistan · ${BUSINESS.phone} · ${BUSINESS.email}</div></div>
<div style="text-align:right"><h1>Quotation</h1><div class="muted">QUO-${shortId(q.id)}</div></div></div>
<div class="meta"><div><b>Prepared for</b>${esc(q.customerName)}<br><span class="muted">${esc(q.customerEmail)}</span></div>
<div><b>Date</b>${formatDate(q.createdAt)}</div><div><b>Valid for</b>7 days</div><div><b>Status</b>${q.status === "approved" ? "Approved" : q.status === "rejected" ? "Rejected" : "Draft, pending approval"}</div></div>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span class="muted">Subtotal</span><span>${formatCurrency(q.subtotal)}</span></div>
${q.discount > 0 ? `<div><span class="muted">Volume discount</span><span>−${formatCurrency(q.discount)}</span></div>` : ""}
<div><span class="muted">${taxLabel(q)}</span><span>${formatCurrency(q.tax)}</span></div>
<div class="grand"><span>Total</span><span>${formatCurrency(q.total)}</span></div></div>
<div class="foot">Prepared by AgentForce AI agents and reviewed by ${BUSINESS.name}. Prices in Pakistani Rupees, inclusive of GST.</div>
<script>window.onload=()=>{window.print()}</script></body></html>`);
  win.document.close();
  return true;
}
