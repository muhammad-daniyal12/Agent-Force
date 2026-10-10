"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Mail, MessageCircle, RotateCcw } from "lucide-react";
import type { Quotation } from "@/types";
import { draftReply, emailLink, printQuotation, whatsappLink } from "@/lib/quotation-docs";
import { customerPhoneFor, useBusiness } from "@/lib/business";
import { Badge, Button, Textarea } from "@/components/ui";
import { AgentAvatar } from "@/components/agent-meta";

/** Support Agent's reply draft. Editable while pending; send actions unlock after approval. */
export function CustomerReply({ quotation, phone }: { quotation: Quotation; phone?: string }) {
  const biz = useBusiness();
  const [text, setText] = useState(() => draftReply(quotation, biz));
  const customerPhone = phone || customerPhoneFor(quotation.id);
  const approved = quotation.status === "approved";
  const rejected = quotation.status === "rejected";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Reply copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  function pdf() {
    if (!printQuotation(quotation, biz)) toast.error("Allow pop-ups to download the PDF");
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <AgentAvatar type="support" size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg">Reply to {quotation.customerName.split(" ")[0]}</p>
          <p className="text-xs text-muted">Drafted by Support Agent{approved || rejected ? "" : " · you can edit it"}</p>
        </div>
        {approved ? <Badge tone="success" dot>Ready to send</Badge> : rejected ? <Badge tone="danger" dot>Won&apos;t be sent</Badge> : <Badge tone="warning" dot>Sends after approval</Badge>}
      </div>

      <div className="p-4">
        <Textarea
          aria-label="Customer reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          disabled={rejected}
          className="font-mono text-[12.5px] leading-relaxed"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {approved && (
            <>
              <Button asChild size="sm" className="bg-[#25D366] text-white hover:opacity-90">
                <a href={whatsappLink(text, customerPhone)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" aria-hidden /> {customerPhone ? "WhatsApp customer" : "Send on WhatsApp"}
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={emailLink(quotation, text, biz)}>
                  <Mail className="h-4 w-4" aria-hidden /> Email
                </a>
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={copy} disabled={rejected}>
            <Copy className="h-4 w-4" aria-hidden /> Copy
          </Button>
          <Button size="sm" variant="secondary" onClick={pdf}>
            <Download className="h-4 w-4" aria-hidden /> PDF
          </Button>
          {!approved && !rejected && (
            <Button size="sm" variant="ghost" onClick={() => setText(draftReply(quotation, biz))} className="ml-auto">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset draft
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
