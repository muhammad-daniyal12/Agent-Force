"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { auth } from "@/lib/api/client";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { BrandMark } from "@/components/brand-mark";
import { Button, Field, Input } from "@/components/ui";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeAuthRedirect(params.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    auth
      .me()
      .then(() => router.replace(next))
      .catch(() => setChecking(false));
  }, [next, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await auth.signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      setPassword("");
      setConfirmPassword("");
      // A full navigation drops any previous workspace state after registration.
      window.location.assign(next);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn't create your account. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 px-12 py-12 text-white lg:flex xl:px-16">
        <Link href="/login" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
            <BrandMark className="h-8 w-8" />
          </span>
          <span className="text-lg font-semibold">AgentForce</span>
        </Link>
        <div className="my-16 max-w-lg">
          <span className="mb-6 inline-flex rounded-2xl bg-white/10 p-4">
            <Sparkles className="h-8 w-8 text-emerald-200" />
          </span>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Meet your new AI team.
            <br />
            <span className="text-emerald-200">Build your own workspace.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-emerald-50/85">
            Support, inventory, and sales work together. You review every
            quotation and stay in control.
          </p>
          <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5">
            <ShieldCheck className="mb-3 h-6 w-6 text-emerald-200" />
            <p className="font-semibold">Your business stays yours</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-50/80">
              New accounts start with an empty workspace. Your products and
              quotations are private to your account.
            </p>
          </div>
        </div>
        <p className="text-sm text-emerald-100">
          AI digital employees. Human approval.
        </p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 flex justify-center lg:hidden">
            <BrandMark className="h-12 w-12" />
          </div>
          <div className="animate-fade-up rounded-3xl border border-border bg-surface p-7 shadow-pop sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
              <UserPlus className="h-3 w-3" /> Your workspace starts here
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-muted">
              Bring your business. We&apos;ll bring the AI team.
            </p>
            {checking ? (
              <p className="mt-8 flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your
                session…
              </p>
            ) : (
              <>
                <div className="mt-7">
                  <GoogleSignIn next={next} disabled={busy} />
                </div>
                <div className="my-5 flex items-center gap-3 text-xs text-subtle">
                  <span className="h-px flex-1 bg-border" /> or create an
                  account with email <span className="h-px flex-1 bg-border" />
                </div>
                <form onSubmit={submit} className="space-y-4">
                  <Field label="Full name" htmlFor="signup-name">
                    <Input
                      id="signup-name"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      minLength={2}
                      maxLength={128}
                      required
                      className="h-11"
                      placeholder="Your full name"
                      disabled={busy}
                    />
                  </Field>
                  <Field label="Email" htmlFor="signup-email">
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      maxLength={254}
                      required
                      className="h-11"
                      placeholder="you@business.com"
                      disabled={busy}
                    />
                  </Field>
                  <Field label="Password" htmlFor="signup-password">
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={visible ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={8}
                        maxLength={256}
                        aria-describedby="password-help"
                        required
                        disabled={busy}
                        className="h-11 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setVisible(!visible)}
                        aria-label={
                          visible ? "Hide passwords" : "Show passwords"
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {visible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p id="password-help" className="mt-1.5 text-xs text-muted">
                      At least 8 characters.
                    </p>
                  </Field>
                  <Field label="Confirm password" htmlFor="signup-confirm">
                    <Input
                      id="signup-confirm"
                      type={visible ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      minLength={8}
                      maxLength={256}
                      required
                      disabled={busy}
                      className="h-11"
                    />
                  </Field>
                  {error && (
                    <p
                      role="alert"
                      className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
                    >
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    loading={busy}
                    className="h-11 w-full"
                  >
                    {!busy && <UserPlus className="h-4 w-4" />}{" "}
                    {busy ? "Creating your account…" : "Create account"}
                  </Button>
                </form>
              </>
            )}
            <p className="mt-6 text-center text-xs text-muted">
              Already have an account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="font-semibold text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Private to your
            business. Secure sessions.
          </p>
        </div>
      </main>
    </div>
  );
}
