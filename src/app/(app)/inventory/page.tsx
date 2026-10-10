"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PackageSearch, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, type NewProduct } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";
import type { Product } from "@/types";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Skeleton } from "@/components/ui";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { RestockPanel } from "@/components/restock-panel";

type Filter = "all" | "low" | "out";

function stockState(p: Product) {
  if (p.stock === 0) return { label: "Out of stock", tone: "danger" as const, bar: "bg-danger" };
  if (p.stock <= p.lowStockThreshold) return { label: "Low stock", tone: "warning" as const, bar: "bg-warning" };
  return { label: "In stock", tone: "success" as const, bar: "bg-success" };
}

export default function InventoryPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: products, error, loading, reload, setData } = useAsync(() => api.products(debounced), [debounced]);

  const counts = useMemo(() => {
    const list = products ?? [];
    return {
      all: list.length,
      low: list.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length,
      out: list.filter((p) => p.stock === 0).length,
    };
  }, [products]);

  const visible = (products ?? []).filter((p) =>
    filter === "all" ? true : filter === "out" ? p.stock === 0 : p.stock > 0 && p.stock <= p.lowStockThreshold,
  );
  const inventoryValue = (products ?? []).reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="The live catalog your Inventory Agent checks before any quotation is drafted."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> Add product
          </Button>
        }
      />

      {/* Only on the unfiltered catalog, so suggestions cover every product. */}
      {!debounced && products && <RestockPanel products={products} />}

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Stock filter">
            {([
              ["all", "All products"],
              ["low", "Low stock"],
              ["out", "Out of stock"],
            ] as [Filter, string][]).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
                  filter === key ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                )}
              >
                {label}
                <span className="tabular text-xs text-subtle">{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-[13px] text-muted lg:block">
              Stock value <span className="tabular font-semibold text-fg">{formatCurrency(inventoryValue)}</span>
            </p>
            <div className="relative w-full md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, SKU, category" className="pl-9" aria-label="Search products" />
            </div>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !products ? (
          <div className="space-y-3 p-5">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={debounced ? `No products match "${debounced}"` : "No products here"}
            description={debounced ? "Try a different name or SKU." : "Add your first product so agents can quote it."}
            action={!debounced && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add product</Button>}
          />
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-subtle">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Stock</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((p) => {
                  const state = stockState(p);
                  const pct = Math.min(100, (p.stock / Math.max(p.lowStockThreshold * 4, 1)) * 100);
                  return (
                    <tr key={p.id} className="group hover:bg-surface-2/60">
                      <td className="px-5 py-3">
                        <p className="font-medium text-fg">{p.name}</p>
                        <p className="font-mono text-[11px] text-subtle">{p.sku}</p>
                      </td>
                      <td className="px-5 py-3 text-muted">{p.category}</td>
                      <td className="tabular px-5 py-3 text-right font-medium text-fg">{formatCurrency(p.price)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-20">
                            <p className="tabular text-[13px] font-medium text-fg">{p.stock} <span className="font-normal text-subtle">units</span></p>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                              <div className={cn("animate-grow h-full rounded-full", state.bar)} style={{ width: `${Math.max(pct, p.stock > 0 ? 4 : 0)}%` }} />
                            </div>
                          </div>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-muted">{timeAgo(p.updatedAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`} className="hover:text-danger"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProductDialog
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved, isNew) => {
          setData((list) => (isNew ? [saved, ...(list ?? [])] : (list ?? []).map((p) => (p.id === saved.id ? saved : p))));
        }}
      />
      <DeleteDialog
        product={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => setData((list) => (list ?? []).filter((p) => p.id !== id))}
      />
    </>
  );
}

const emptyForm = { name: "", sku: "", category: "", price: "", stock: "", lowStockThreshold: "10" };

function ProductDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product | "new" | null;
  onClose: () => void;
  onSaved: (p: Product, isNew: boolean) => void;
}) {
  const isNew = product === "new";
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form when a different product is opened
    setErrors({});
    if (product && product !== "new") {
      setForm({
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: String(product.price),
        stock: String(product.stock),
        lowStockThreshold: String(product.lowStockThreshold),
      });
    } else setForm(emptyForm);
  }, [product]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.sku.trim()) e.sku = "SKU is required";
    if (!form.category.trim()) e.category = "Category is required";
    if (!(Number(form.price) > 0)) e.price = "Enter a price above 0";
    if (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 0 || form.stock === "") e.stock = "Whole number, 0 or more";
    if (!Number.isInteger(Number(form.lowStockThreshold)) || Number(form.lowStockThreshold) < 0) e.lowStockThreshold = "Whole number, 0 or more";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!product || !validate()) return;
    const payload: NewProduct = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      lowStockThreshold: Number(form.lowStockThreshold),
    };
    setSaving(true);
    try {
      const saved = isNew ? await api.createProduct(payload) : await api.updateProduct(product.id, payload);
      onSaved(saved, isNew);
      toast.success(isNew ? "Product added" : "Product updated", { description: saved.name });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save product");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent title={isNew ? "Add product" : "Edit product"} description="Agents use these details for stock checks and pricing.">
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Product name" htmlFor="p-name" error={errors.name}>
            <Input id="p-name" value={form.name} onChange={set("name")} placeholder="Wireless Mouse" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU" htmlFor="p-sku" error={errors.sku}>
              <Input id="p-sku" value={form.sku} onChange={set("sku")} placeholder="MSE-WL-200" className="font-mono" />
            </Field>
            <Field label="Category" htmlFor="p-category" error={errors.category}>
              <Input id="p-category" value={form.category} onChange={set("category")} placeholder="Peripherals" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Price (Rs)" htmlFor="p-price" error={errors.price}>
              <Input id="p-price" type="number" step="1" min="0" value={form.price} onChange={set("price")} />
            </Field>
            <Field label="Stock" htmlFor="p-stock" error={errors.stock}>
              <Input id="p-stock" type="number" min="0" value={form.stock} onChange={set("stock")} />
            </Field>
            <Field label="Low at" htmlFor="p-low" error={errors.lowStockThreshold}>
              <Input id="p-low" type="number" min="0" value={form.lowStockThreshold} onChange={set("lowStockThreshold")} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose asChild><Button type="button" variant="secondary" disabled={saving}>Cancel</Button></DialogClose>
            <Button type="submit" loading={saving}>{isNew ? "Add product" : "Save changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ product, onClose, onDeleted }: { product: Product | null; onClose: () => void; onDeleted: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (!product) return;
    setBusy(true);
    try {
      await api.deleteProduct(product.id);
      onDeleted(product.id);
      toast.success("Product deleted", { description: product.name });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete product");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent title="Delete product?" description={product ? `${product.name} will be removed from the catalog. Agents won't be able to quote it.` : undefined}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild><Button variant="secondary" disabled={busy}>Cancel</Button></DialogClose>
          <Button variant="danger" onClick={confirm} loading={busy}>Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
