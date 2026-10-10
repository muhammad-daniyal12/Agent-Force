"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, Check, Eye, EyeOff, Headset, Loader2, LogIn, Receipt, ShieldCheck, UserCheck } from "lucide-react";
import { auth, ApiError, isMockMode } from "@/lib/api/client";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

/** Only allow same-site relative paths as the post-login destination. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 18 L12 5 L20 18" />
      <path d="M8 13 H16" />
    </svg>
  );
}

const agents = [
  { icon: Headset, name: "Support Agent", text: "Reads every customer message" },
  { icon: Boxes, name: "Inventory Agent", text: "Checks live stock instantly" },
  { icon: Receipt, name: "Sales Agent", text: "Drafts quotations with GST" },
];

const pipeline = [
  { icon: Headset, label: "Support" },
  { icon: Boxes, label: "Inventory" },
  { icon: Receipt, label: "Sales" },
  { icon: UserCheck, label: "You" },
];

/** Left panel: what AgentForce does, shown on large screens only. */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Soft grid + glow for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-300/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" aria-hidden />

      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <Mark className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-semibold tracking-tight">AgentForce</p>
          <p className="text-xs text-emerald-100/80">AI digital employees</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-4xl font-semibold leading-tight tracking-tight">
          Your AI team for support, stock and sales.
        </h2>
        <p className="mt-4 text-base text-emerald-50/85">
          Three AI employees handle the busywork. You stay in control. Nothing reaches a customer until you approve it.
        </p>

        <ul className="mt-8 space-y-3">
          {agents.map(({ icon: Icon, name, text }) => (
            <li key={name} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm">
                <span className="font-semibold">{name}</span>
                <span className="text-emerald-50/80"> · {text}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* Mini pipeline preview */}
        <div className="mt-10 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-100/80">Every customer request</p>
          <ol className="mt-4 flex items-center">
            {pipeline.map(({ icon: Icon, label }, i) => (
              <li key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", i === 3 ? "bg-white text-emerald-700" : "bg-white/20")}>
                    {i === 3 ? <Icon className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-50/90">{label}</span>
                </div>
                {i < pipeline.length - 1 && <span className="mx-2 mb-5 h-0.5 flex-1 rounded-full bg-white/30" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <dl className="relative grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
        {[
          ["~3 sec", "per quotation"],
          ["20 min", "saved per request"],
          ["100%", "human-approved"],
        ].map(([value, label]) => (
          <div key={label}>
            <dt className="sr-only">{label}</dt>
            <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
            <dd className="text-xs text-emerald-100/75">{label}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // Already signed in (or demo mode): go straight to the app.
  useEffect(() => {
    auth
      .me()
      .then(() => router.replace(next))
      .catch(() => setChecking(false));
  }, [next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await auth.login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        router.replace(next); // Already authenticated.
        return;
      }
      setError(
        err instanceof ApiError && err.status === 401
          ? "Incorrect email or password."
          : err instanceof ApiError && err.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : err instanceof Error
              ? err.message
              : "Couldn't sign in. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <BrandPanel />

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="animate-fade-up w-full max-w-sm">
          {/* Logo for small screens, where the brand panel is hidden */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-card">
              <Mark className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-tight text-fg">AgentForce</p>
              <p className="text-xs text-muted">AI digital employees</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to see what your AI team has prepared.</p>

          {checking ? (
            <div className="mt-10 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking your session…
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@business.pk"
                  className="h-11"
                  autoFocus
                />
              </Field>
              <Field label="Password" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted transition-colors hover:text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {error && (
                <p className="animate-step-in rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="h-11 w-full" loading={busy}>
                {!busy && <LogIn className="h-4 w-4" aria-hidden />} {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          )}

          <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-border bg-surface p-4 text-xs text-muted">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-success" aria-hidden />
            <p>
              {isMockMode
                ? "Demo data mode: any email and password will work."
                : "Accounts are created by your administrator. Your session is secured with an HTTP-only cookie."}
            </p>
          </div>

          <p className="mt-8 text-center text-xs text-subtle">© {new Date().getFullYear()} AgentForce · Built for small businesses in Pakistan</p>
        </div>
      </main>
    </div>
  );
}
