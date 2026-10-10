"use client";

import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";
import type { ActivityLog } from "@/types";
import { Card, EmptyState, ErrorState, Input, PageHeader, Skeleton } from "@/components/ui";
import { ActorAvatar } from "@/components/agent-meta";

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "Support Agent", label: "Support" },
  { key: "Inventory Agent", label: "Inventory" },
  { key: "Sales Agent", label: "Sales" },
  { key: "Admin", label: "You (owner)" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "short" });
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });

export default function ActivityPage() {
  const { data, error, loading, reload } = useAsync(() => api.activity(100));
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = (data ?? []).filter(
      (a) => (filter === "all" || a.actor === filter) && (!needle || `${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(needle)),
    );
    const byDay = new Map<string, ActivityLog[]>();
    for (const a of rows) byDay.set(dayLabel(a.createdAt), [...(byDay.get(dayLabel(a.createdAt)) ?? []), a]);
    return [...byDay.entries()];
  }, [data, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length ?? 0 };
    for (const a of data ?? []) c[a.actor] = (c[a.actor] ?? 0) + 1;
    return c;
  }, [data]);

  return (
    <>
      <PageHeader title="Activity log" description="Every action by your AI agents and by you, recorded for accountability." />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by who acted">
            {FILTERS.map(({ key, label }) => (
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
                <span className="tabular text-xs text-subtle">{counts[key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actions, quotes, products" className="pl-9" aria-label="Search activity" />
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <div className="space-y-3 p-5">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : groups.length === 0 ? (
          <EmptyState icon={History} title={query || filter !== "all" ? "No matching activity" : "No activity yet"} description={query || filter !== "all" ? "Try a different filter or search." : undefined} />
        ) : (
          <div className="divide-y divide-border">
            {groups.map(([day, rows]) => (
              <section key={day} className="px-5 py-4">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{day}</h2>
                <ol className="stagger relative space-y-4">
                  <span className="absolute bottom-2 left-[13px] top-2 w-px bg-border" aria-hidden />
                  {rows.map((a) => (
                    <li key={a.id} className="relative flex gap-3">
                      <ActorAvatar actor={a.actor} />
                      <div className="min-w-0 flex-1 text-[13px] leading-snug">
                        <p className="text-fg">
                          <span className="font-medium">{a.actor}</span> <span className="text-muted">{a.action}</span>{" "}
                          <span className="font-medium break-words">{a.target}</span>
                        </p>
                      </div>
                      <time className="tabular shrink-0 text-xs text-subtle" dateTime={a.createdAt}>{timeOf(a.createdAt)}</time>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
