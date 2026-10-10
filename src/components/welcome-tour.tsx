"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BellRing, CheckCircle2, Play, Settings, Workflow, type LucideIcon } from "lucide-react";
import { useSessionUser } from "@/components/session";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Fire this to replay the tour (e.g. from Settings). */
export const OPEN_TOUR = "agentforce:open-tour";
const doneKey = (userId: string) => `agentforce.tour-done.${userId}`;

const steps: { icon: LucideIcon | "logo"; title: string; text: string; tint: string }[] = [
  {
    icon: "logo",
    title: "Welcome to AgentForce",
    text: "You now have three AI employees: Support reads customer messages, Inventory checks your stock and Sales prepares quotations. This quick tour shows you around.",
    tint: "bg-primary-soft text-primary",
  },
  {
    icon: Workflow,
    title: "Paste a customer request",
    text: "In AI Operations, paste a message from WhatsApp or email. Your agents understand it, check stock and draft a quotation with GST in a few seconds.",
    tint: "bg-support-soft text-support",
  },
  {
    icon: CheckCircle2,
    title: "You approve, always",
    text: "Nothing reaches a customer until you approve it in the Approval Center. Then send the reply on WhatsApp, by email or as a PDF.",
    tint: "bg-success-soft text-success",
  },
  {
    icon: BellRing,
    title: "No customer forgotten",
    text: "The Follow-up Agent reminds you about quotes waiting for a decision and drafts check-ins for customers. Customers and Reports show the bigger picture.",
    tint: "bg-[#fde7f1] text-[#db2777] dark:bg-[#33142a] dark:text-[#f472b6]",
  },
  {
    icon: Settings,
    title: "Make it yours",
    text: "Add your business name, city and phone in Settings so every reply and PDF is signed by you. You can replay this tour from Settings any time.",
    tint: "bg-inventory-soft text-inventory",
  },
];

export function WelcomeTour() {
  const user = useSessionUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

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
  const Icon = s.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent title={s.title} description={`Step ${step + 1} of ${steps.length}`} className="max-w-md">
        <div key={step} className="animate-step-in">
          <div className={cn("mb-4 flex h-14 w-14 items-center justify-center rounded-2xl", s.tint)}>
            {Icon === "logo" ? <BrandMark className="h-9 w-9" /> : <Icon className="h-6 w-6" aria-hidden />}
          </div>
          <p className="text-sm leading-relaxed text-muted">{s.text}</p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i === step ? "w-5 bg-primary" : "w-1.5 bg-border-strong")} />
            ))}
          </div>
          <div className="flex gap-2">
            {step === 0 ? (
              <Button variant="ghost" size="sm" onClick={() => finish()}>Skip</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back
              </Button>
            )}
            {last ? (
              <Button size="sm" onClick={() => finish(true)}>
                <Play className="h-4 w-4" aria-hidden /> Try an example
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
