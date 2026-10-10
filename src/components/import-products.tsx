"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { api, ApiError, type NewProduct } from "@/lib/api/client";
import { cn, formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";
import { Badge, Button, Textarea } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const TEMPLATE = [
  "sku,name,category,price,stock,lowStockThreshold",
  "MSE-WL-300,Wireless Mouse Pro,Peripherals,3499,40,10",
  "CBL-HDMI-5,HDMI Cable (5m),Cables,2199,60,15",
].join("\r\n");

/** Minimal CSV parser: handles quoted cells, escaped quotes and CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

// Accept common header spellings from Excel exports.
const HEADERS: Record<string, keyof NewProduct> = {
  sku: "sku", code: "sku", "product code": "sku",
  name: "name", product: "name", "product name": "name",
  category: "category",
  price: "price", "unit price": "price", "price (rs)": "price",
  stock: "stock", quantity: "stock", qty: "stock",
  lowstockthreshold: "lowStockThreshold", "low stock": "lowStockThreshold", "low stock threshold": "lowStockThreshold", "low at": "lowStockThreshold",
};

type Row = { line: number; data: NewProduct; errors: string[]; existing?: Product };

function toRows(text: string, existing: Product[]): { rows: Row[]; headerError?: string } {
  const table = parseCsv(text.replace(/^﻿/, ""));
  if (table.length < 2) return { rows: [], headerError: "Add a header row and at least one product row." };
  const keys = table[0].map((h) => HEADERS[h.trim().toLowerCase()]);
  for (const required of ["sku", "name", "price", "stock"] as const)
    if (!keys.includes(required)) return { rows: [], headerError: `Missing a "${required}" column. Use the template for the right headers.` };

  const bySku = new Map(existing.map((p) => [p.sku.toUpperCase(), p]));
  const seen = new Set<string>();
  const rows = table.slice(1).map((cells, i) => {
    const get = (k: keyof NewProduct) => (cells[keys.indexOf(k)] ?? "").trim();
    const data: NewProduct = {
      sku: get("sku").toUpperCase(),
      name: get("name"),
      category: get("category") || "General",
      price: Number(get("price").replace(/[,\s]|rs\.?/gi, "")),
      stock: Number(get("stock").replace(/[,\s]/g, "")),
      lowStockThreshold: keys.includes("lowStockThreshold") && get("lowStockThreshold") !== "" ? Number(get("lowStockThreshold")) : 10,
    };
    const errors: string[] = [];
    if (!data.sku) errors.push("SKU missing");
    else if (seen.has(data.sku)) errors.push("Duplicate SKU in file");
    if (!data.name) errors.push("Name missing");
    if (!(data.price > 0)) errors.push("Price must be above 0");
    if (!Number.isInteger(data.stock) || data.stock < 0) errors.push("Stock must be a whole number");
    if (!Number.isInteger(data.lowStockThreshold) || data.lowStockThreshold < 0) errors.push("Low-stock level must be a whole number");
    seen.add(data.sku);
    return { line: i + 2, data, errors, existing: bySku.get(data.sku) };
  });
  return { rows };
}

export function ImportProducts({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  // Full catalog (not the page's search-filtered list) so duplicate SKUs are always detected.
  const [existing, setExisting] = useState<Product[]>([]);

  async function openDialog() {
    setOpen(true);
    try {
      setExisting(await api.products());
    } catch {
      setExisting([]);
    }
  }
  const [text, setText] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const { rows, headerError } = useMemo(() => (text.trim() ? toRows(text, existing) : { rows: [] as Row[] }), [text, existing]);
  const valid = rows.filter((r) => r.errors.length === 0);
  const toCreate = valid.filter((r) => !r.existing);
  const toUpdate = updateExisting ? valid.filter((r) => r.existing) : [];
  const skipped = rows.length - toCreate.length - toUpdate.length;

  function reset() {
    setText("");
    setProgress(0);
    setUpdateExisting(false);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error("That file is too large", { description: "Import up to 1 MB at a time." });
      return;
    }
    setText(await file.text());
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "agentforce-products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    const jobs = [...toCreate, ...toUpdate];
    setBusy(true);
    let created = 0, updated = 0;
    const failed: string[] = [];
    // One at a time keeps us well inside the backend's rate limit and gives clear per-row errors.
    for (const [i, r] of jobs.entries()) {
      try {
        if (r.existing) {
          await api.updateProduct(r.existing.id, { name: r.data.name, category: r.data.category, price: r.data.price, stock: r.data.stock, lowStockThreshold: r.data.lowStockThreshold });
          updated++;
        } else {
          await api.createProduct(r.data);
          created++;
        }
      } catch (err) {
        failed.push(`${r.data.sku}: ${err instanceof ApiError ? err.message : "failed"}`);
      }
      setProgress(Math.round(((i + 1) / jobs.length) * 100));
    }
    setBusy(false);
    onImported();
    if (failed.length) toast.error(`${failed.length} product${failed.length > 1 ? "s" : ""} couldn't be imported`, { description: failed.slice(0, 3).join(" · ") });
    if (created || updated) toast.success("Import complete", { description: `${created} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}` });
    setOpen(false);
    reset();
  }

  return (
    <>
      <Button variant="secondary" onClick={openDialog}>
        <Upload className="h-4 w-4" aria-hidden /> Import CSV
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); if (!o) reset(); } }}>
        <DialogContent title="Import products" description="Upload a CSV from Excel or Google Sheets. Nothing is saved until you confirm." className="max-w-2xl">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg shadow-card hover:opacity-90 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                <FileSpreadsheet className="h-4 w-4" aria-hidden /> Choose CSV file
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
              </label>
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4" aria-hidden /> Download template
              </Button>
            </div>

            <Textarea
              aria-label="CSV content"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"…or paste rows here, e.g.\n" + TEMPLATE}
              className="font-mono text-xs"
              disabled={busy}
            />

            {headerError && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">{headerError}</p>}

            {rows.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="success">{toCreate.length} new</Badge>
                  {valid.some((r) => r.existing) && <Badge tone="primary">{valid.filter((r) => r.existing).length} already in catalog</Badge>}
                  {rows.length - valid.length > 0 && <Badge tone="danger">{rows.length - valid.length} with errors</Badge>}
                  {valid.some((r) => r.existing) && (
                    <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[13px] text-fg">
                      <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" disabled={busy} />
                      Update existing products
                    </label>
                  )}
                </div>
                <div className="max-h-64 overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-[560px] text-[12.5px]">
                    <thead className="sticky top-0 bg-surface-2">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-subtle">
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">SKU</th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 text-right font-medium">Price</th>
                        <th className="px-3 py-2 text-right font-medium">Stock</th>
                        <th className="px-3 py-2 font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((r) => (
                        <tr key={r.line} className={cn(r.errors.length > 0 && "bg-danger-soft/40")}>
                          <td className="tabular px-3 py-2 text-muted">{r.line}</td>
                          <td className="px-3 py-2 font-mono text-fg">{r.data.sku || "–"}</td>
                          <td className="max-w-48 truncate px-3 py-2 text-fg">{r.data.name || "–"}</td>
                          <td className="tabular px-3 py-2 text-right text-fg">{r.data.price > 0 ? formatCurrency(r.data.price) : "–"}</td>
                          <td className="tabular px-3 py-2 text-right text-fg">{Number.isFinite(r.data.stock) ? r.data.stock : "–"}</td>
                          <td className="px-3 py-2">
                            {r.errors.length > 0 ? (
                              <span className="flex items-center gap-1 text-danger"><X className="h-3.5 w-3.5" aria-hidden />{r.errors[0]}</span>
                            ) : r.existing ? (
                              <span className="text-muted">{updateExisting ? "Will update" : "Skip (exists)"}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-success"><Check className="h-3.5 w-3.5" aria-hidden />Will add</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {busy && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => { setOpen(false); reset(); }} disabled={busy}>Cancel</Button>
              <Button onClick={runImport} loading={busy} disabled={toCreate.length + toUpdate.length === 0}>
                {busy ? `Importing… ${progress}%` : `Import ${toCreate.length + toUpdate.length} product${toCreate.length + toUpdate.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
