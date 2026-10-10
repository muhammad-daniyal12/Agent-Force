import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rupees = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** PKR, e.g. "Rs 1,269,160". */
export function formatCurrency(value: number) {
  return `${value < 0 ? "−" : ""}Rs ${rupees.format(Math.abs(Math.round(value)))}`;
}

/** Short PKR for tight spaces, e.g. "Rs 12.7 lakh", "Rs 1.2 crore". */
export function formatCurrencyShort(value: number) {
  if (value >= 10_000_000) return `Rs ${(value / 10_000_000).toFixed(1).replace(/\.0$/, "")} crore`;
  if (value >= 100_000) return `Rs ${(value / 100_000).toFixed(1).replace(/\.0$/, "")} lakh`;
  return formatCurrency(value);
}

/** "GST (18%)" style label from the amounts the backend actually charged. */
export function taxLabel(q: { subtotal: number; discount: number; tax: number }) {
  const base = q.subtotal - q.discount;
  const pct = base > 0 ? Math.round((q.tax / base) * 1000) / 10 : 0;
  return `GST (${pct}%)`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}
