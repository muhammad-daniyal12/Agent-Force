"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, Check, Eye, EyeOff, Headset, Loader2, Lock, LogIn, MessageSquareText, Receipt, ShieldCheck, UserCheck, type LucideIcon } from "lucide-react";
import { auth, ApiError, isMockMode } from "@/lib/api/client";
import { Button, Field, Input } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { BrandMark } from "@/components/brand-mark";
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

/* ---------- Live pipeline demo ---------- */

// Totals follow the app's pricing (5% volume discount above Rs 150,000, then 18% GST).
const demoRequests = [
  { from: "Ali · Finlytics", text: "Need 10 wireless mice, 10 keyboards and 5 USB-C hubs for our Lahore office.", total: "Rs 210,159" },
  { from: "Omar · Nexa Design", text: "Please quote 4 × 27-inch monitors and 4 laptop stands.", total: "Rs 358,711" },
  { from: "Zara · PixelCraft", text: "6 noise-cancelling headsets for the remote team, urgent please.", total: "Rs 130,973" },
];

const stages: { key: string; label: string; icon: LucideIcon; working: string }[] = [
  { key: "support", label: "Support", icon: Headset, working: "Support Agent is reading the message…" },
  { key: "inventory", label: "Inventory", icon: Boxes, working: "Inventory Agent is checking live stock…" },
  { key: "sales", label: "Sales", icon: Receipt, working: "Sales Agent is pricing with GST…" },
  { key: "you", label: "You", icon: UserCheck, working: "Waiting for your approval" },
];

// Step 0-2: agents work in turn · 3: owner reviews · 4-5: approved (held two ticks) · then next request.
const STEPS = 6;
const TICK_MS = 1300;

function LivePipeline() {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const step = reduced ? 4 : tick % STEPS;
  const request = demoRequests[reduced ? 0 : Math.floor(tick / STEPS) % demoRequests.length];
  const approved = step >= 4;
  const status = approved ? "Approved · reply ready to send on WhatsApp" : stages[step].working;

  return (
    <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-sm" aria-hidden>
      {/* Incoming message */}
      <div key={request.text} className="animate-step-in flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <MessageSquareText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-100/75">{request.from}</p>
          <p className="mt-0.5 text-sm leading-snug text-white">“{request.text}”</p>
        </div>
      </div>

      {/* Agents */}
      <ol className="mt-5 flex items-start">
        {stages.map(({ key, label, icon: Icon }, i) => {
          const done = approved || i < step;
          const active = !approved && i === step;
          const isYou = key === "you";
          return (
            <li key={key} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-14 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500",
                    done && (isYou ? "bg-white text-emerald-700" : "bg-white/90 text-emerald-700"),
                    active && (isYou ? "animate-halo bg-amber-300 text-amber-900" : "animate-halo bg-white/25 text-white"),
                    !done && !active && "bg-white/10 text-white/60",
                  )}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={2.75} /> : active && !isYou ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className={cn("text-[11px] font-medium transition-colors", done || active ? "text-white" : "text-white/60")}>{label}</span>
              </div>
              {i < stages.length - 1 && (
                <span className="mt-5 h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
                  <span className="block h-full rounded-full bg-white transition-[width] duration-700 ease-out" style={{ width: done ? "100%" : "0%" }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Status + result */}
      <div className="mt-4 flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-black/15 px-4 py-2.5">
        <p key={status} className="animate-step-in text-[13px] text-emerald-50">{status}</p>
        {step >= 3 && (
          <span key={`${request.total}-${approved}`} className="animate-pop-in shrink-0 rounded-lg bg-white px-2.5 py-1 text-[13px] font-semibold tabular-nums text-emerald-800">
            {request.total}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Brand panel ---------- */

const agents = [
  { icon: Headset, name: "Support Agent", text: "Reads every customer message" },
  { icon: Boxes, name: "Inventory Agent", text: "Checks live stock instantly" },
  { icon: Receipt, name: "Sales Agent", text: "Drafts quotations with GST" },
];

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Soft grid + drifting glows for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        aria-hidden
      />
      <div className="animate-drift pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-emerald-300/30 blur-3xl" aria-hidden />
      <div className="animate-drift-slow pointer-events-none absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-teal-300/25 blur-3xl" aria-hidden />

      <div className="animate-fade-up relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <BrandMark mono checkColor="#047857" className="h-8 w-8 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-semibold tracking-tight">AgentForce</p>
          <p className="text-xs text-emerald-100/80">AI digital employees</p>
        </div>
      </div>

      <div className="stagger relative max-w-lg">
        <h2 className="text-4xl font-semibold leading-tight tracking-tight text-balance">Your AI team for support, stock and sales.</h2>
        <p className="mt-4 text-base text-emerald-50/85">
          Three AI employees handle the busywork. You stay in control. Nothing reaches a customer until you approve it.
        </p>
        <ul className="mt-7 space-y-3">
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
        <div className="mt-8">
          <LivePipeline />
        </div>
      </div>

      <dl className="animate-fade-up relative grid grid-cols-3 gap-6 border-t border-white/15 pt-6" style={{ animationDelay: "0.4s" }}>
        <div>
          <dt className="sr-only">Time per quotation</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">
            ~<CountUp value={3} duration={1200} /> sec
          </dd>
          <dd className="text-xs text-emerald-100/75">per quotation</dd>
        </div>
        <div>
          <dt className="sr-only">Time saved</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">
            <CountUp value={20} duration={1200} /> min
          </dd>
          <dd className="text-xs text-emerald-100/75">saved per request</dd>
        </div>
        <div>
          <dt className="sr-only">Approval</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">
            <CountUp value={100} duration={1400} />%
          </dd>
          <dd className="text-xs text-emerald-100/75">human-approved</dd>
        </div>
      </dl>
    </aside>
  );
}

/* ---------- Sign-in form ---------- */

const trust = [
  { icon: Lock, title: "Secure session", text: "Encrypted, HTTP-only sign-in cookie" },
  { icon: UserCheck, title: "You approve everything", text: "AI drafts, you decide what's sent" },
  { icon: ShieldCheck, title: "Private to your business", text: "Your data is never shared with others" },
];

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <BrandPanel />

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Logo for small screens, where the brand panel is hidden */}
          <div className="animate-fade-up mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-10 w-10 shrink-0" />
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-tight text-fg">AgentForce</p>
              <p className="text-xs text-muted">AI digital employees</p>
            </div>
          </div>

          {welcome ? (
            <div className="animate-pop-in flex flex-col items-center py-10 text-center" role="status">
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
            <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <h1 className="text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
              <p className="mt-1 text-sm text-muted">Sign in to see what your AI team has prepared.</p>

              {checking ? (
                <div className="mt-10 flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking your session…
                </div>
              ) : (
                <form key={errorCount} onSubmit={submit} className={cn("mt-8 space-y-4", errorCount > 0 && "animate-shake")} noValidate>
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
                        className="h-11 pr-11 transition-shadow focus:shadow-[0_0_0_4px_var(--primary-soft)]"
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
                    <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger" role="alert">
                      {error}
                    </p>
                  )}

                  <Button type="submit" size="lg" className="group h-11 w-full" loading={busy}>
                    {!busy && <LogIn className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />} {busy ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Why you can trust us */}
          <ul className="stagger mt-8 space-y-2.5">
            {trust.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 text-[13px] leading-snug">
                  <span className="block font-medium text-fg">{title}</span>
                  <span className="text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          {isMockMode && <p className="mt-4 text-center text-xs text-muted">Demo data mode: any email and password will work.</p>}
          <p className="mt-6 text-center text-xs text-subtle">© {new Date().getFullYear()} AgentForce · Built for small businesses in Pakistan</p>
        </div>
      </main>
    </div>
  );
}
