"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Boxes, Check, Eye, EyeOff, Headset, Loader2, Lock, LogIn, MapPin, Receipt, ShieldCheck, UserCheck, type LucideIcon } from "lucide-react";
import { auth, ApiError, isMockMode } from "@/lib/api/client";
import { Button, Field, Input } from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

/** Only allow same-site relative paths as the post-login destination. */
const safeNext = safeAuthRedirect;

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the OS setting after mount
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
};

/* ---------- App preview (decorative: a miniature of the real dashboard) ---------- */

// Totals follow the app's pricing (5% volume discount above Rs 150,000, then 18% GST).
const demoRequests = [
  { who: "Ali · Finlytics, Lahore", total: "Rs 210,159" },
  { who: "Omar · Nexa Design, Karachi", total: "Rs 358,711" },
  { who: "Zara · PixelCraft, Islamabad", total: "Rs 130,973" },
];

const toastStages: { agent: string; text: string; dot: string; icon: LucideIcon }[] = [
  { agent: "Support Agent", text: "is reading a new request…", dot: "bg-blue-500", icon: Headset },
  { agent: "Inventory Agent", text: "checked live stock ✓", dot: "bg-amber-500", icon: Boxes },
  { agent: "Sales Agent", text: "drafted a quotation", dot: "bg-violet-500", icon: Receipt },
  { agent: "You", text: "approved it. Reply ready on WhatsApp", dot: "bg-emerald-500", icon: UserCheck },
];

const TICK_MS = 1600;

/** Floating notification that cycles through the agent hand-off. */
function LiveToast() {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const stage = reduced ? 3 : tick % toastStages.length;
  const request = demoRequests[reduced ? 0 : Math.floor(tick / toastStages.length) % demoRequests.length];
  const s = toastStages[stage];
  const Icon = s.icon;

  return (
    <div className="w-[19rem] rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-[0_20px_50px_-12px_rgb(2_44_34/0.45)] backdrop-blur" aria-hidden>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <span>{request.who}</span>
        <span className="flex items-center gap-1 text-emerald-600">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>
      <div key={`${tick}`} className="animate-step-in mt-2 flex items-center gap-2.5">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white", s.dot)}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="min-w-0 text-[13px] leading-snug text-slate-700">
          <span className="font-semibold text-slate-900">{s.agent}</span> {s.text}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {toastStages.map((t, i) => (
          <span key={t.agent} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
            <span className={cn("block h-full rounded-full transition-all duration-500", t.dot, i <= stage ? "w-full" : "w-0")} />
          </span>
        ))}
      </div>
      {stage >= 2 && (
        <div key={`total-${request.total}-${stage}`} className="animate-pop-in mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-[11px] text-slate-500">Quotation total</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-900">
            {request.total}
            {stage === 3 && <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />}
          </span>
        </div>
      )}
    </div>
  );
}

const previewBars = [6, 9, 7, 12, 10, 5, 8];

/** Miniature of the AgentForce dashboard, drawn with the same layout as the real one. */
function AppPreview() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgb(2_44_34/0.6)] ring-1 ring-white/30" aria-hidden>
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-slate-400 ring-1 ring-slate-200">app.agentforce.pk/dashboard</span>
        </div>
        <div className="grid grid-cols-[8.5rem_1fr]">
          {/* Mini sidebar */}
          <div className="space-y-1 border-r border-slate-100 bg-white p-3">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-900">
              <BrandMark className="h-5 w-5" /> AgentForce
            </div>
            {["Dashboard", "AI Operations", "Approvals", "Customers", "Inventory", "Reports"].map((label, i) => (
              <div key={label} className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px]", i === 0 ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-500")}>
                <span className={cn("h-2 w-2 rounded-[3px]", i === 0 ? "bg-emerald-500" : "bg-slate-300")} />
                {label}
                {label === "Approvals" && <span className="ml-auto rounded-full bg-emerald-600 px-1 text-[9px] font-semibold text-white">2</span>}
              </div>
            ))}
          </div>
          {/* Mini dashboard */}
          <div className="space-y-2.5 bg-[#f4f6f9] p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-slate-900">Good evening, Nova Tech</p>
              <span className="rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-semibold text-white">+ New request</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: "Approved value", v: "Rs 2.9 lakh", bar: "bg-emerald-500" },
                { k: "Pending approvals", v: "2", bar: "bg-amber-500" },
                { k: "Hours saved", v: "~19h", bar: "bg-blue-500" },
              ].map((t) => (
                <div key={t.k} className="relative overflow-hidden rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
                  <span className={cn("absolute inset-x-0 top-0 h-0.5", t.bar)} />
                  <p className="text-[9px] text-slate-500">{t.k}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{t.v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[1.4fr_1fr] gap-2">
              <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-900">Quotation volume</p>
                <div className="mt-2 flex h-16 items-end gap-1.5 border-b border-slate-100">
                  {previewBars.map((h, i) => (
                    <div key={i} className="flex flex-1 items-end gap-0.5">
                      <span className="animate-grow-y flex-1 rounded-t-[2px] bg-[#4f7cff]" style={{ height: `${h * 5}px`, animationDelay: `${0.3 + i * 0.06}s` }} />
                      <span className="animate-grow-y flex-1 rounded-t-[2px] bg-[#12b886]" style={{ height: `${h * 3.7}px`, animationDelay: `${0.36 + i * 0.06}s` }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 rounded-lg bg-white p-2.5 ring-1 ring-slate-200/70">
                <p className="text-[10px] font-semibold text-slate-900">Waiting for approval</p>
                {[
                  ["Sara Khan", "Rs 109,726"],
                  ["Omar Farooq", "Rs 358,711"],
                ].map(([n, v]) => (
                  <div key={n} className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-700">{n}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{v}</span>
                  </div>
                ))}
                <span className="inline-block rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700">2 pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Floating live notification overlapping the window edge */}
      <div className="absolute -bottom-16 -right-6 xl:-right-10">
        <LiveToast />
      </div>
    </div>
  );
}

/* ---------- Brand panel ---------- */

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 px-12 py-10 text-white lg:flex lg:flex-col xl:px-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        aria-hidden
      />
      <div className="animate-drift pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-emerald-200/15 blur-[100px]" aria-hidden />
      <div className="animate-drift-slow pointer-events-none absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full bg-teal-200/10 blur-[100px]" aria-hidden />

      <div className="animate-fade-up relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg">
          <BrandMark className="h-8 w-8" />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-semibold tracking-tight">AgentForce</p>
          <p className="text-xs text-emerald-100/80">AI digital employees</p>
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-10">
        <div className="stagger">
          <h2 className="max-w-xl text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-balance">
            Your AI team for support, stock and sales. <span className="text-emerald-200">You stay in charge.</span>
          </h2>
          <p className="mt-4 max-w-lg text-base text-emerald-50/85">
            Agents read customer messages, check stock and draft quotations. Nothing reaches a customer until you approve it.
          </p>
        </div>
        <div className="animate-fade-up mb-10 mt-10 pr-6 xl:pr-10" style={{ animationDelay: "0.2s" }}>
          <AppPreview />
        </div>
      </div>

      <div className="animate-fade-up relative mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-8 gap-y-2 border-t border-white/15 pt-5 text-sm text-emerald-50/90" style={{ animationDelay: "0.4s" }}>
        <span><span className="font-semibold text-white">~3 sec</span> per quotation</span>
        <span><span className="font-semibold text-white">20 min</span> saved per request</span>
        <span><span className="font-semibold text-white">100%</span> human-approved</span>
        <span className="hidden items-center gap-1.5 text-emerald-100/80 2xl:flex"><MapPin className="h-3.5 w-3.5" /> Built for Pakistan</span>
      </div>
    </aside>
  );
}

/* ---------- Sign-in form ---------- */

const trust = [
  { icon: Lock, label: "Encrypted session" },
  { icon: UserCheck, label: "You approve everything" },
  { icon: ShieldCheck, label: "Private to your business" },
];

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(params.get("authError") === "google_cancelled" ? "Google sign-in was cancelled. Try again when you're ready." : null);
  const [errorCount, setErrorCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [welcome, setWelcome] = useState<string | null>(null);

  // Already signed in (or demo mode): go straight to the app.
  useEffect(() => {
    auth
      .me()
      .then(() => router.replace(next))
      .catch(() => setChecking(false));
  }, [next, router]);

  function fail(message: string) {
    setError(message);
    setErrorCount((n) => n + 1); // re-keys the form so the shake replays
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      fail("Enter your email and password.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      fail("That email doesn't look right. Check it and try again.");
      return;
    }
    setBusy(true);
    try {
      const user = await auth.login(email.trim(), password);
      // Brief confirmation before entering the workspace.
      setWelcome(user.name?.split(" ")[0] || "back");
      setTimeout(() => router.replace(next), 900);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        router.replace(next); // Already authenticated.
        return;
      }
      fail(
        err instanceof ApiError && err.status === 401
          ? "Incorrect email or password."
          : err instanceof ApiError && err.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : err instanceof Error
              ? err.message
              : "Couldn't sign in. Try again.",
      );
    }
  }

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"));

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <BrandPanel />

      <main className="relative flex items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
        {/* Subtle dot pattern and glow so the form side isn't flat */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }}
          aria-hidden
        />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden />

        <div className="relative w-full max-w-[400px]">
          {/* Logo for small screens, where the brand panel is hidden */}
          <div className="animate-fade-up mb-8 flex items-center justify-center gap-3 lg:hidden">
            <BrandMark className="h-10 w-10 shrink-0" />
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-tight text-fg">AgentForce</p>
              <p className="text-xs text-muted">AI digital employees</p>
            </div>
          </div>

          <div className="animate-fade-up rounded-3xl border border-border bg-surface p-7 shadow-pop sm:p-8" style={{ animationDelay: "0.05s" }}>
            {welcome ? (
              <div className="animate-pop-in flex flex-col items-center py-8 text-center" role="status">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path className="animate-check" d="M5 12.5 L10 17.5 L19 7.5" />
                  </svg>
                </span>
                <p className="mt-5 text-xl font-semibold tracking-tight text-fg">Welcome {welcome === "back" ? "back" : `back, ${welcome}`}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Opening your workspace…
                </p>
              </div>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
                  <Lock className="h-3 w-3" aria-hidden /> Owner sign-in · secured
                </span>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
                <p className="mt-1 text-sm text-muted">Sign in to review what your AI team has prepared.</p>

                {checking ? (
                  <div className="mt-8 flex items-center gap-2 py-6 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking your session…
                  </div>
                ) : (
                  <>
                  <div className="mt-7"><GoogleSignIn next={next} disabled={busy} /></div>
                  <div className="my-5 flex items-center gap-3 text-xs text-subtle"><span className="h-px flex-1 bg-border" /> or sign in with email <span className="h-px flex-1 bg-border" /></div>
                  <form key={errorCount} onSubmit={submit} className={cn("space-y-4", errorCount > 0 && "animate-shake")} noValidate>
                    <Field label="Email" htmlFor="email">
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="owner@business.pk"
                        className="h-11 transition-shadow focus:shadow-[0_0_0_4px_var(--primary-soft)]"
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
                          onKeyDown={onPasswordKey}
                          onKeyUp={onPasswordKey}
                          className="h-11 pr-11 transition-shadow focus:shadow-[0_0_0_4px_var(--primary-soft)]"
                          aria-describedby={capsLock ? "caps-warning" : undefined}
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
                      {capsLock && (
                        <p id="caps-warning" className="animate-step-in mt-1.5 flex items-center gap-1.5 text-xs text-warning">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Caps Lock is on
                        </p>
                      )}
                    </Field>

                    {error && (
                      <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger" role="alert">
                        {error}
                      </p>
                    )}

                    <Button type="submit" size="lg" className="group h-11 w-full text-[15px]" loading={busy}>
                      {!busy && <LogIn className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />} {busy ? "Signing in…" : "Sign in"}
                    </Button>

                    <p className="text-center text-xs text-muted">
                      {isMockMode ? "Demo data mode: email sign-in uses sample data." : <>New to AgentForce? <Link className="font-semibold text-primary hover:underline" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>}
                    </p>
                  </form>
                  </>
                )}
              </>
            )}
          </div>

          {/* Why you can trust us */}
          <ul className="stagger mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Icon className="h-3.5 w-3.5 text-success" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-xs text-subtle">© {new Date().getFullYear()} AgentForce · Made for small businesses in Pakistan</p>
        </div>
      </main>
    </div>
  );
}
