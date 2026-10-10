"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";
import { auth, ApiError, isMockMode } from "@/lib/api/client";
import { Button, Card, Field, Input } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/** Only allow same-site relative paths as the post-login destination. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in (or demo mode): go straight to the app.
  useEffect(() => {
    auth.me().then(() => router.replace(next)).catch(() => undefined);
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
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="animate-fade-up w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-card">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 18 L12 5 L20 18" />
              <path d="M8 13 H16" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">Sign in to AgentForce</h1>
          <p className="mt-1 text-sm text-muted">Your AI team is waiting for you.</p>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@business.pk" autoFocus />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {!busy && <LogIn className="h-4 w-4" aria-hidden />} Sign in
            </Button>
          </form>
        </Card>

        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
          {isMockMode ? "Demo data mode: any details will work." : "Accounts are created by your administrator."}
        </p>
      </div>
    </main>
  );
}
