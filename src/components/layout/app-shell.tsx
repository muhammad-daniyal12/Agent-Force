"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { BarChart3, BellRing, Bot, CheckCircle2, History, Users, LayoutDashboard, Loader2, LogOut, Menu, Moon, Package, Settings, Sun, Workflow, X } from "lucide-react";
import { api, ApiError, auth, isMockMode, type SessionUser } from "@/lib/api/client";
import { SessionContext } from "@/components/session";
import { BrandMark } from "@/components/brand-mark";
import { WelcomeTour } from "@/components/welcome-tour";
import { useBusiness } from "@/lib/business";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; badge?: boolean };

// Grouped so ten pages stay scannable: daily work first, then the business, then setup.
const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Work",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/operations", label: "AI Operations", icon: Workflow },
      { href: "/approvals", label: "Approval Center", icon: CheckCircle2, badge: true },
      { href: "/follow-ups", label: "Follow-ups", icon: BellRing },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/activity", label: "Activity log", icon: History },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Fired by pages after creating/approving quotations so the sidebar count stays fresh. */
export const QUOTATIONS_CHANGED = "agentforce:quotations-changed";
export const notifyQuotationsChanged = () => window.dispatchEvent(new Event(QUOTATIONS_CHANGED));

function usePendingCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const load = () => api.quotations("pending").then((q) => setCount(q.length)).catch(() => setCount(null));
    load();
    window.addEventListener(QUOTATIONS_CHANGED, load);
    return () => window.removeEventListener(QUOTATIONS_CHANGED, load);
  }, []);
  return count;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <BrandMark className="h-8 w-8 shrink-0" />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight text-fg">AgentForce</p>
        <p className="text-[11px] text-muted">AI digital employees</p>
      </div>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const pending = usePendingCount();
  return (
    <nav className="space-y-5" aria-label="Main">
      {navSections.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle">{section.title}</p>
          <div className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon, badge }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "bg-nav-active text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active && "text-brand")} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {badge && pending !== null && pending > 0 && (
                    <span className="tabular rounded-full bg-primary px-1.5 py-px text-[11px] font-semibold text-primary-fg" aria-label={`${pending} pending`}>
                      {pending}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- theme is only known after mount
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}

function SidebarFooter({ user, onLogout }: { user: SessionUser | null; onLogout: () => void }) {
  const biz = useBusiness();
  const name = biz.name || user?.email || "Owner";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .join("")
    .slice(0, 2);
  return (
    <div className="space-y-3">
      <ThemeToggle />
      <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-surface-2/60 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-fg">{initials}</div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium text-fg">{name}</p>
          <p className="truncate text-[11px] text-muted">{user?.email ?? "Owner"}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-danger outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      {isMockMode && <p className="px-1 text-[11px] text-subtle">Demo data mode</p>}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile drawer on navigation
  useEffect(() => setOpen(false), [pathname]);

  // "checking" until /api/auth/me answers; pages only render once the owner is confirmed.
  const [session, setSession] = useState<"checking" | "ready" | "error">("checking");
  const [signingOut, setSigningOut] = useState(false);

  const checkSession = useCallback(() => {
    setSession("checking");
    auth
      .me()
      .then((u) => {
        setUser(u);
        setSession("ready");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        else setSession("error");
      });
  }, [router]);

  // Every business page needs a signed-in owner; send everyone else to /login.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- session check on mount
  useEffect(() => checkSession(), [checkSession]);

  async function logout() {
    setSigningOut(true);
    try {
      await auth.logout();
      setUser(null);
      setSession("checking");
      router.replace("/login");
    } catch {
      toast.error("Couldn't sign out", { description: "Check your connection and try again." });
      setSigningOut(false);
    }
  }

  const footer = <SidebarFooter user={user} onLogout={logout} />;

  return (
    <SessionContext.Provider value={user}>
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <div className="-mr-2 min-h-0 space-y-7 overflow-y-auto pr-2">
          <div className="px-1">
            <Logo />
          </div>
          <NavLinks />
        </div>
        <div className="shrink-0 pt-4">{footer}</div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-fg hover:bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between bg-sidebar px-4 py-5 shadow-pop">
            <div className="-mr-2 min-h-0 space-y-7 overflow-y-auto pr-2">
              <div className="flex items-center justify-between px-1">
                <Logo />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-muted hover:bg-surface-2 cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="shrink-0 pt-4">{footer}</div>
          </div>
        </div>
      )}

      <main className="overflow-x-clip lg:pl-64">
        <div key={pathname} className="animate-fade-up mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {session === "ready" && <WelcomeTour />}
          {session === "ready" ? (
            children
          ) : session === "error" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center" role="alert">
              <p className="text-sm font-medium text-fg">Can&apos;t reach AgentForce right now</p>
              <p className="max-w-sm text-[13px] text-muted">The server didn&apos;t respond. Check your connection, then try again.</p>
              <button
                type="button"
                onClick={checkSession}
                className="mt-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg shadow-card hover:bg-surface-2 cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {signingOut ? "Signing out…" : "Checking your session…"}
            </div>
          )}
        </div>
      </main>
    </div>
    </SessionContext.Provider>
  );
}
