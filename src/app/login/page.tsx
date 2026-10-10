"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  Check,
  Eye,
  EyeOff,
  Headset,
  Loader2,
  Lock,
  LogIn,
  MapPin,
  MessageSquareText,
  Receipt,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
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
  { from: "Ali · Finlytics, Lahore", text: "Need 10 wireless mice, 10 keyboards and 5 USB-C hubs for our new office.", total: "Rs 210,159" },
  { from: "Omar · Nexa Design, Karachi", text: "Please quote 4 × 27-inch monitors and 4 laptop stands.", total: "Rs 358,711" },
  { from: "Zara · PixelCraft, Islamabad", text: "6 noise-cancelling headsets for the remote team, urgent please.", total: "Rs 130,973" },
];

// Node colours match the Relay logo: blue Support, amber Inventory, violet Sales, green owner check.
const stages: { key: string; label: string; icon: LucideIcon; working: string; solid: string; tint: string }[] = [
  { key: "support", label: "Support", icon: Headset, working: "Support Agent is reading the message…", solid: "bg-blue-500", tint: "bg-blue-400/30 text-blue-50" },
  { key: "inventory", label: "Inventory", icon: Boxes, working: "Inventory Agent is checking live stock…", solid: "bg-amber-500", tint: "bg-amber-300/30 text-amber-50" },
  { key: "sales", label: "Sales", icon: Receipt, working: "Sales Agent is pricing with 18% GST…", solid: "bg-violet-500", tint: "bg-violet-400/30 text-violet-50" },
  { key: "you", label: "You", icon: UserCheck, working: "Waiting for your approval", solid: "bg-white", tint: "bg-amber-300 text-amber-900" },
];

// Steps 0-2: agents work in turn · 3: owner reviews · 4-5: approved (held two ticks) · then next request.
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
    <div className="rounded-3xl bg-white/[0.08] p-6 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] ring-1 ring-white/20 backdrop-blur-md" aria-hidden>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-100/80">Live: how a request is handled</p>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-teal-100/80">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300" />
          </span>
          Running
        </span>
      </div>

      {/* Incoming message, styled like a chat bubble */}
      <div key={request.text} className="animate-step-in mt-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          <MessageSquareText className="h-4 w-4" />
        </span>
        <div className="min-w-0 rounded-2xl rounded-tl-md bg-white px-4 py-3 text-teal-950 shadow-sm">
          <p className="text-[11px] font-semibold text-teal-700">{request.from}</p>
          <p className="mt-0.5 text-sm leading-snug">“{request.text}”</p>
        </div>
      </div>

      {/* Agents */}
      <ol className="mt-6 flex items-start">
        {stages.map(({ key, label, icon: Icon, solid, tint }, i) => {
          const done = approved || i < step;
          const active = !approved && i === step;
          const isYou = key === "you";
          return (
            <li key={key} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-16 flex-col items-center gap-2">
                <span
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500",
                    done && cn(solid, isYou ? "text-teal-700" : "text-white", "shadow-lg"),
                    active && cn(tint, "animate-halo"),
                    !done && !active && "bg-white/10 text-white/55",
                  )}
                >
                  {done ? <Check className="h-5 w-5" strokeWidth={2.75} /> : active && !isYou ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className={cn("text-xs font-medium transition-colors", done || active ? "text-white" : "text-white/55")}>{label}</span>
              </div>
              {i < stages.length - 1 && (
                <span className="mt-6 h-0.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <span className="block h-full rounded-full bg-white/90 transition-[width] duration-700 ease-out" style={{ width: done ? "100%" : "0%" }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Status + result */}
      <div className="mt-5 flex min-h-[48px] items-center justify-between gap-3 rounded-2xl bg-black/20 px-4 py-3">
        <p key={status} className="animate-step-in flex items-center gap-2 text-[13px] text-teal-50">
          {approved && <Check className="h-4 w-4 text-lime-300" strokeWidth={3} />}
          {status}
        </p>
        {step >= 3 && (
          <span key={`${request.total}-${approved}`} className="animate-pop-in shrink-0 rounded-lg bg-white px-2.5 py-1 text-[13px] font-semibold tabular-nums text-teal-800">
            {request.total}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Brand panel ---------- */

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-950 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
      {/* Soft grid + drifting glows for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        aria-hidden
      />
      <div className="animate-drift pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-lime-300/25 blur-3xl" aria-hidden />
      <div className="animate-drift-slow pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-teal-300/25 blur-3xl" aria-hidden />

      <div className="animate-fade-up relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg">
          <BrandMark className="h-8 w-8" />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-semibold tracking-tight">AgentForce</p>
          <p className="text-xs text-teal-100/80">AI digital employees</p>
        </div>
      </div>

      <div className="stagger relative my-10 max-w-xl">
        <h2 className="text-[2.6rem] font-semibold leading-[1.1] tracking-tight text-balance">
          Your AI team for support, stock and sales.{" "}
          <span className="text-lime-300">You stay in charge.</span>
        </h2>
        <p className="mt-4 max-w-md text-base text-teal-50/85">
          Agents read customer messages, check stock and draft quotations. Nothing reaches a customer until you approve it.
        </p>
        <div className="mt-8">
          <LivePipeline />
        </div>
        <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-teal-100/80">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Built for businesses in
          {["Lahore", "Karachi", "Islamabad", "Faisalabad"].map((city) => (
            <span key={city} className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-white/90 ring-1 ring-white/15">
              {city}
            </span>
          ))}
        </p>
      </div>

      <dl className="animate-fade-up relative grid grid-cols-3 gap-6 border-t border-white/15 pt-6" style={{ animationDelay: "0.4s" }}>
        <div>
          <dt className="sr-only">Time per quotation</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">
            ~<CountUp value={3} duration={1200} /> sec
          </dd>
          <dd className="text-xs text-teal-100/75">per quotation</dd>
        </div>
        <div>
          <dt className="sr-only">Time saved</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">
            <CountUp value={20} duration={1200} /> min
          </dd>
          <dd className="text-xs text-teal-100/75">saved per request</dd>
        </div>
        <div>
          <dt className="sr-only">Approval</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">
            <CountUp value={100} duration={1400} />%
          </dd>
          <dd className="text-xs text-teal-100/75">human-approved</dd>
        </div>
      </dl>
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
                  <form key={errorCount} onSubmit={submit} className={cn("mt-7 space-y-4", errorCount > 0 && "animate-shake")} noValidate>
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
                      {isMockMode ? "Demo data mode: any email and password will work." : "Accounts are created by your administrator."}
                    </p>
                  </form>
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
