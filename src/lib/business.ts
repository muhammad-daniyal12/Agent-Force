"use client";

// Business profile shown on replies, PDFs and purchase orders. Stored per owner in this
// browser until the backend has a settings endpoint; defaults come from the signed-in account.
import { useCallback, useSyncExternalStore } from "react";
import { useSessionUser } from "@/components/session";
import type { SessionUser } from "@/lib/api/client";

export interface BusinessProfile {
  name: string;
  city: string;
  phone: string;
  email: string;
}

const CHANGED = "agentforce:business-changed";
const profileKey = (userId: string) => `agentforce.business.${userId}`;
const PHONES_KEY = "agentforce.customer-phones";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): the profile simply isn't remembered.
  }
}

export function defaultProfile(user: SessionUser | null): BusinessProfile {
  return { name: user?.name?.trim() || "My Business", city: "", phone: "", email: user?.email ?? "" };
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The current owner's business profile, live-updating when Settings saves. */
export function useBusiness(): BusinessProfile {
  const user = useSessionUser();
  const key = user ? profileKey(user.id) : null;
  // Return a stable string so useSyncExternalStore doesn't loop; parse below.
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? localStorage.getItem(key) : null),
    () => null,
  );
  const fallback = defaultProfile(user);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<BusinessProfile>) };
  } catch {
    return fallback;
  }
}

export function useSaveBusiness() {
  const user = useSessionUser();
  return useCallback(
    (profile: BusinessProfile) => {
      if (!user) return;
      write(profileKey(user.id), profile);
      window.dispatchEvent(new Event(CHANGED));
    },
    [user],
  );
}

/** Customer WhatsApp numbers aren't stored by the backend yet, so remember them per quotation here. */
export function rememberCustomerPhone(quotationId: string, phone: string) {
  if (!phone.trim()) return;
  write(PHONES_KEY, { ...(read<Record<string, string>>(PHONES_KEY) ?? {}), [quotationId]: phone.trim() });
}

export function customerPhoneFor(quotationId: string): string {
  return read<Record<string, string>>(PHONES_KEY)?.[quotationId] ?? "";
}

/** Pakistani mobile in international digits for wa.me, e.g. "0300 1234567" -> "923001234567". */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("3")) return `92${digits}`;
  return digits;
}

export const isValidPhone = (phone: string) => !phone.trim() || /^\d{10,15}$/.test(toWhatsAppNumber(phone));
