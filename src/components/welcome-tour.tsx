"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, BellRing, Boxes, Check, Headset, MapPin, MessageSquareText, Phone, Play, Receipt, X } from "lucide-react";
import { useSessionUser } from "@/components/session";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui";
import { useBusiness } from "@/lib/business";
import { cn } from "@/lib/utils";

/** Fire this to replay the tour (e.g. from Settings). */
export const OPEN_TOUR = "agentforce:open-tour";
const doneKey = (userId: string) => `agentforce.tour-done.${userId}`;

/* ---------- Banner illustrations (decorative; the text carries the meaning) ---------- */

function Grid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.12]"
      style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      aria-hidden
    />
  );
}

function WelcomeArt() {
  const chips = [
    { icon: Headset, label: "Support", cls: "bg-blue-500" },
    { icon: Boxes, label: "Inventory", cls: "bg-amber-500" },
    { icon: Receipt, label: "Sales", cls: "bg-violet-500" },
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl">
        <BrandMark className="h-11 w-11" />
      </div>
      <div className="flex gap-2">
        {chips.map(({ icon: Icon, label, cls }, i) => (
          <span key={label} className="animate-pop-in flex items-center gap-1.5 rounded-full bg-white/95 py-1 pl-1 pr-3 text-xs font-medium text-slate-800 shadow" style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-white", cls)}>
              <Icon className="h-3 w-3" />
            </span>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function OperationsArt() {
  return (
    <div className="w-full max-w-xs space-y-4">
      <div className="animate-pop-in flex items-start gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/25 text-white">
          <MessageSquareText className="h-3.5 w-3.5" />
        </span>
        <p className="rounded-2xl rounded-tl-md bg-white px-3 py-2 text-xs text-slate-800 shadow">“Need 10 wireless mice and 5 USB-C hubs, price?”</p>
      </div>
      <div className="flex items-center justify-center">
        {["bg-blue-500", "bg-amber-500", "bg-violet-500"].map((cls, i) => (
          <div key={cls} className="flex items-center">
            <span className={cn("animate-pop-in flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg", cls)} style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            {i < 2 && <span className="mx-1.5 h-0.5 w-8 rounded-full bg-white/60" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ApproveArt() {
  return (
    <div className="animate-pop-in w-full max-w-[17rem] rounded-2xl bg-white p-4 text-slate-800 shadow-xl">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono">QUO-8F21A3</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Awaiting you</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">Ali Raza · 3 items</p>
      <p className="text-xl font-semibold tracking-tight">Rs 210,159</p>
      <div className="mt-3 flex gap-2">
        <span className="flex-1 rounded-lg border border-slate-200 py-1.5 text-center text-xs font-medium text-slate-600">Reject</span>
        <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-teal-700 py-1.5 text-xs font-semibold text-white">
          <Check className="h-3.5 w-3.5" strokeWidth={3} /> Approve
        </span>
      </div>
    </div>
  );
}

function FollowUpArt() {
  return (
    <div className="w-full max-w-xs space-y-3">
      <div className="animate-pop-in flex items-center gap-2 self-start rounded-full bg-white/95 py-1 pl-1 pr-3 text-xs font-medium text-slate-800 shadow">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 text-white">
          <BellRing className="h-3.5 w-3.5" />
        </span>
        Ayesha hasn&apos;t replied in 3 hours
      </div>
      <p className="animate-pop-in rounded-2xl rounded-tr-md bg-white px-3 py-2 text-xs text-slate-800 shadow" style={{ animationDelay: "0.2s" }}>
        “Hope you&apos;re well. Just checking in on your quotation. Shall we go ahead with the order?”
      </p>
    </div>
  );
}

function SettingsArt({ name, city }: { name: string; city: string }) {
  return (
    <div className="animate-pop-in w-full max-w-[16rem] rounded-2xl bg-white p-4 text-slate-800 shadow-xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-sm font-semibold text-amber-700">{name.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3" /> {city || "Your city"}
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Phone className="h-3 w-3" /> Signed on every reply and PDF
      </p>
    </div>
  );
}

/* ---------- Steps ---------- */

type Step = { eyebrow: string; title: string; text: string; banner: string; art: (biz: { name: string; city: string }) => React.ReactNode };

const steps: Step[] = [
  {
    eyebrow: "Welcome",
    title: "Meet your AI team",
    text: "Three AI employees now work for you: Support reads customer messages, Inventory checks your stock and Sales prepares quotations. Here's a one-minute tour.",
    banner: "from-teal-500 via-teal-600 to-emerald-800",
    art: () => <WelcomeArt />,
  },
  {
    eyebrow: "AI Operations",
    title: "Paste a customer request",
    text: "Copy a message from WhatsApp or email into AI Operations. Your agents understand it, check stock and draft a quotation with GST in a few seconds.",
    banner: "from-blue-500 via-blue-600 to-indigo-700",
    art: () => <OperationsArt />,
  },
  {
    eyebrow: "Approval Center",
    title: "You approve, always",
    text: "Nothing reaches a customer until you press Approve. Then send the AI-written reply on WhatsApp, by email or as a branded PDF.",
    banner: "from-lime-500 via-green-600 to-teal-700",
    art: () => <ApproveArt />,
  },
  {
    eyebrow: "Follow-ups",
    title: "No customer forgotten",
    text: "The Follow-up Agent reminds you about quotes waiting for a decision and drafts friendly check-ins. Customers and Reports show the bigger picture.",
    banner: "from-pink-500 via-rose-500 to-fuchsia-600",
    art: () => <FollowUpArt />,
  },
  {
    eyebrow: "Settings",
    title: "Make it yours",
    text: "Add your business name, city and phone in Settings so every reply and PDF is signed by you. You can replay this tour from Settings any time.",
    banner: "from-amber-400 via-orange-500 to-orange-600",
    art: (biz) => <SettingsArt name={biz.name} city={biz.city} />,
  },
];

export function WelcomeTour() {
  const user = useSessionUser();
  const biz = useBusiness();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Show once per owner, the first time they reach the app.
  useEffect(() => {
    if (!user) return;
    let seen = true;
    try {
      seen = localStorage.getItem(doneKey(user.id)) === "1";
    } catch {
      // Storage blocked: don't nag on every page load.
    }
    if (!seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit check needs localStorage, only available after mount
      setStep(0);
      setOpen(true);
    }
  }, [user]);

  useEffect(() => {
    const replay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR, replay);
    return () => window.removeEventListener(OPEN_TOUR, replay);
  }, []);

  function finish(goToOperations = false) {
    if (user) {
      try {
        localStorage.setItem(doneKey(user.id), "1");
      } catch {
        // Ignore: worst case the tour shows again next visit.
      }
    }
    setOpen(false);
    if (goToOperations) router.push("/operations");
  }

  const s = steps[step];
  const last = step === steps.length - 1;
  const go = (to: number) => setStep(Math.max(0, Math.min(steps.length - 1, to)));

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      if (last) finish(true);
      else go(step + 1);
    }
    if (e.key === "ArrowLeft") go(step - 1);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && finish()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            nextRef.current?.focus({ preventScroll: true });
          }}
          className="animate-pop-in fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[30rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-surface shadow-pop outline-none"
        >
          {/* Illustrated banner */}
          <div key={`art-${step}`} className={cn("relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br px-6", s.banner)}>
            <Grid />
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/20 blur-2xl" aria-hidden />
            <div className="relative flex w-full justify-center">{s.art({ name: biz.name, city: biz.city })}</div>
            <DialogPrimitive.Close
              className="absolute right-3 top-3 rounded-full bg-black/15 p-1.5 text-white transition-colors hover:bg-black/25 outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Text */}
          {/* Fixed minimum height so the dialog doesn't jump between steps of different length. */}
          <div key={`text-${step}`} className="animate-step-in min-h-[9.5rem] px-7 pb-2 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {s.eyebrow} · {step + 1} of {steps.length}
            </p>
            <DialogPrimitive.Title className="mt-1.5 text-xl font-semibold tracking-tight text-fg">{s.title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted">{s.text}</DialogPrimitive.Description>
          </div>

          {/* Progress + controls */}
          <div className="px-7 pb-6 pt-5">
            <div className="mb-5 flex gap-1.5" aria-hidden>
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  onClick={() => go(i)}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 cursor-pointer"
                >
                  <span className={cn("block h-full rounded-full bg-primary transition-all duration-500", i <= step ? "w-full" : "w-0")} />
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              {step === 0 ? (
                <Button variant="ghost" size="sm" onClick={() => finish()}>Skip tour</Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => go(step - 1)}>
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                </Button>
              )}
              {last ? (
                <Button ref={nextRef} onClick={() => finish(true)}>
                  <Play className="h-4 w-4" aria-hidden /> Try an example
                </Button>
              ) : (
                <Button ref={nextRef} onClick={() => go(step + 1)}>
                  Next <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
