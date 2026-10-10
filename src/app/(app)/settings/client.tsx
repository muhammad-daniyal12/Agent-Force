"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, Check, Info, Percent, ShieldCheck } from "lucide-react";
import { isMockMode } from "@/lib/api/client";
import { isValidPhone, useBusiness, useSaveBusiness, type BusinessProfile } from "@/lib/business";
import { useSessionUser } from "@/components/session";
import { Button, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const user = useSessionUser();
  const biz = useBusiness();
  // Key the form on the saved profile so it refills once the session loads.
  return <SettingsForm key={`${user?.id ?? "loading"}:${JSON.stringify(biz)}`} initial={biz} ready={!!user} />;
}

function SettingsForm({ initial, ready }: { initial: BusinessProfile; ready: boolean }) {
  const save = useSaveBusiness();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Business name is required";
    if (!isValidPhone(form.phone)) next.phone = "Enter a valid phone, e.g. 0300 1234567";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email";
    setErrors(next);
    if (Object.keys(next).length) return;
    save({ name: form.name.trim(), city: form.city.trim(), phone: form.phone.trim(), email: form.email.trim() });
    toast.success("Business profile saved", { description: "New replies, PDFs and purchase orders will use it." });
  }

  const set = (key: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <PageHeader title="Settings" description="How your business appears to customers and suppliers." />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" aria-hidden /> Business profile
              </span>
            }
            description="Used on AI-drafted replies, PDF quotations and purchase orders"
          />
          <form onSubmit={submit} className="space-y-4 p-5" noValidate>
            <Field label="Business name" htmlFor="biz-name" error={errors.name}>
              <Input id="biz-name" value={form.name} onChange={set("name")} placeholder="Nova Tech Supplies" disabled={!ready} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" htmlFor="biz-city">
                <Input id="biz-city" value={form.city} onChange={set("city")} placeholder="Lahore" disabled={!ready} />
              </Field>
              <Field label="Phone / WhatsApp" htmlFor="biz-phone" error={errors.phone}>
                <Input id="biz-phone" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="0300 1234567" disabled={!ready} />
              </Field>
            </div>
            <Field label="Business email" htmlFor="biz-email" error={errors.email}>
              <Input id="biz-email" type="email" value={form.email} onChange={set("email")} placeholder="sales@business.pk" disabled={!ready} />
            </Field>
            <div className="flex items-center justify-end gap-3 pt-1">
              {!dirty && ready && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden /> Saved
                </span>
              )}
              <Button type="submit" disabled={!dirty || !ready}>Save changes</Button>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              Saved in this browser for your account. It will sync across devices once business settings are stored on the server.
            </p>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-sales" aria-hidden /> Pricing rules
                </span>
              }
              description="Applied by the Sales Agent on every quotation"
            />
            <dl className="divide-y divide-border text-[13px]">
              {[
                ["Currency", "Pakistani Rupee (Rs)"],
                ["Tax", "GST, set by your administrator"],
                ["Volume discount", "Automatic, by order size"],
                ["Prices", "Always taken from your inventory"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-5 py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <ShieldCheck className="h-4 w-4" aria-hidden />
              </div>
              <div className="text-[13px]">
                <p className="font-medium text-fg">Human approval is always on</p>
                <p className="mt-1 text-muted">
                  Agents can draft quotations and replies, but only you can approve them. Every decision is recorded in the activity log.
                </p>
                {isMockMode && <p className="mt-2 text-xs text-subtle">Demo data mode is on.</p>}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
