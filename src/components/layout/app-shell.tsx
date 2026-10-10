"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Bot, CheckCircle2, LayoutDashboard, Menu, Moon, Package, Sun, Workflow, X } from "lucide-react";
import { api, isMockMode } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/operations", label: "AI Operations", icon: Workflow },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/approvals", label: "Approval Center", icon: CheckCircle2, badge: true },
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
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-card">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 18 L12 5 L20 18" />
          <path d="M8 13 H16" />
        </svg>
      </div>
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
    <nav className="space-y-0.5" aria-label="Main">
      {nav.map(({ href, label, icon: Icon, badge }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "bg-primary-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
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
    </nav>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
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

function SidebarFooter() {
  return (
    <div className="space-y-3">
      <ThemeToggle />
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/60 p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-fg">NT</div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium text-fg">Nova Tech Supplies</p>
          <p className="truncate text-[11px] text-muted">Lahore · Owner</p>
        </div>
      </div>
      {isMockMode && <p className="px-1 text-[11px] text-subtle">Demo data mode</p>}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-border bg-surface px-4 py-5 lg:flex">
        <div className="space-y-7">
          <div className="px-1">
            <Logo />
          </div>
          <NavLinks />
        </div>
        <SidebarFooter />
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
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between bg-surface px-4 py-5 shadow-pop">
            <div className="space-y-7">
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
            <SidebarFooter />
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div key={pathname} className="animate-fade-up mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
