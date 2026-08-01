"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useStore } from "@/store/store";
import { toast } from "sonner";

type LineDraft = {
  rfqLineId: string;
  quotedMpn: string;
  stockQty: string;
  unitPrice: string;
  leadTimeDays: string;
  moq: string;
  spq: string;
  packaging: string;
  dateCode: string;
  paymentTerms: string;
};

export default function SupplierRfqPortalPage() {
  const params = useParams();
  const bundleId = params.bundleId as string;
  const token = params.token as string;
  const store = useStore();

  const bundle = store.rfqBundles[bundleId];
  const invite = bundle?.invites.find((i) => i.portalToken === token);
  const existingQuote = Object.values(store.supplierQuotes).find(
    (q) => q.rfqBundleId === bundleId && q.supplierEmail === invite?.supplierEmail,
  );

  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [submitted, setSubmitted] = useState(false);
  const [questionText, setQuestionText] = useState("");

  useEffect(() => {
    if (invite) {
      store.markInviteViewed(bundleId, token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleId, token, invite?.id]);

  const lines = useMemo(() => bundle?.lines ?? [], [bundle]);

  const updateDraft = (rfqLineId: string, patch: Partial<LineDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [rfqLineId]: {
        rfqLineId,
        quotedMpn: prev[rfqLineId]?.quotedMpn ?? "",
        stockQty: prev[rfqLineId]?.stockQty ?? "",
        unitPrice: prev[rfqLineId]?.unitPrice ?? "",
        leadTimeDays: prev[rfqLineId]?.leadTimeDays ?? "",
        moq: prev[rfqLineId]?.moq ?? "1",
        spq: prev[rfqLineId]?.spq ?? "1",
        packaging: prev[rfqLineId]?.packaging ?? "Tape & Reel",
        dateCode: prev[rfqLineId]?.dateCode ?? "",
        paymentTerms: prev[rfqLineId]?.paymentTerms ?? "Advance via T/T",
        ...patch,
      },
    }));
  };

  if (!bundle || !invite) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-semibold">Invalid or expired link</h1>
        <p className="mt-2 text-sm text-muted-foreground">This RFQ link is not valid. Please contact Sharpbuy sourcing for a new invite.</p>
      </div>
    );
  }

  if (invite.expiresAt < new Date().toISOString().slice(0, 10)) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-semibold">This RFQ has expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">Deadline was {invite.expiresAt}. Please contact Sharpbuy sourcing.</p>
      </div>
    );
  }

  const handleSubmit = () => {
    const quoteLines = lines
      .map((line) => drafts[line.id])
      .filter((d) => d && d.unitPrice && d.stockQty)
      .map((d) => ({
        rfqLineId: d.rfqLineId,
        quotedMpn: d.quotedMpn || lines.find((l) => l.id === d.rfqLineId)?.mpn || "",
        stockQty: +d.stockQty,
        unitPrice: +d.unitPrice,
        currency: "USD",
        leadTimeDays: +d.leadTimeDays || 7,
        moq: +d.moq || 1,
        spq: +d.spq || 1,
        packaging: d.packaging,
        dateCode: d.dateCode,
        paymentTerms: d.paymentTerms,
      }));

    if (quoteLines.length === 0) {
      toast.error("Enter at least one quote (unit price + stock qty)");
      return;
    }

    store.submitSupplierQuote({
      rfqBundleId: bundleId,
      supplierEmail: invite.supplierEmail,
      lines: quoteLines,
    });
    setSubmitted(true);
  };

  const handleAskQuestion = () => {
    const question = questionText.trim();
    if (!question) {
      toast.error("Enter a question before sending");
      return;
    }
    store.askSupplierQuestion(bundleId, token, question);
    setQuestionText("");
  };

  const alreadyQuoted = !!existingQuote || submitted;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sharpbuy Sourcing</div>
          <h1 className="mt-1 text-xl font-semibold">Request for Quotation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bundle {bundleId.slice(0, 16)} · Deadline {bundle.deadline} · {lines.length} component(s)
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Ask a question</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Spec unclear on an MPN or packaging before you quote? Ask Sharpbuy sourcing here — your question and their answer will show up on this page.
          </p>

          {(invite.questions?.length ?? 0) > 0 && (
            <div className="mb-3 space-y-2">
              {(invite.questions ?? []).map((q) => (
                <div key={q.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">You asked · {q.askedAt}</div>
                  <div className="mt-1">{q.question}</div>
                  {q.answer ? (
                    <div className="mt-2 rounded-lg border bg-ok-bg p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-ok">Sharpbuy sourcing replied · {q.answeredAt}</div>
                      <div className="mt-0.5">{q.answer}</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs italic text-muted-foreground">Awaiting response…</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="e.g. Can you confirm packaging for line 2 — tape & reel or tray?"
              rows={2}
              className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
            />
            <button
              onClick={handleAskQuestion}
              disabled={!questionText.trim()}
              className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none"
            >
              Send
            </button>
          </div>
        </div>

        {alreadyQuoted ? (
          <div className="rounded-lg border bg-ok-bg p-6 text-center">
            <div className="text-lg font-semibold text-ok">Quote submitted</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you — your quote has been received. Sharpbuy sourcing will follow up if selected or if a counter-offer is proposed.
            </p>
            {existingQuote && (
              <div className="mt-4 space-y-1 text-left text-xs text-muted-foreground">
                {existingQuote.lines.map((l) => (
                  <div key={l.id} className="flex justify-between rounded border bg-card px-3 py-2">
                    <span>{l.quotedMpn}</span>
                    <span>{l.stockQty} units @ ${l.unitPrice.toFixed(2)}</span>
                    <span className="font-medium">{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {lines.map((line) => {
              const d = drafts[line.id];
              return (
                <div key={line.id} className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="font-mono text-sm font-semibold text-primary">{line.mpn}</div>
                    <div className="text-xs text-muted-foreground">Requested qty: {line.aggregatedQty} · Target ${line.targetPrice.toFixed(2)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Quoted MPN</label>
                      <input
                        type="text"
                        placeholder={line.mpn}
                        value={d?.quotedMpn ?? ""}
                        onChange={(e) => updateDraft(line.id, { quotedMpn: e.target.value })}
                        className="w-full rounded-lg border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Stock Qty *</label>
                      <input
                        type="number"
                        value={d?.stockQty ?? ""}
                        onChange={(e) => updateDraft(line.id, { stockQty: e.target.value })}
                        className="w-full rounded-lg border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Unit Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={d?.unitPrice ?? ""}
                        onChange={(e) => updateDraft(line.id, { unitPrice: e.target.value })}
                        className="w-full rounded-lg border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Lead Time (days)</label>
                      <input
                        type="number"
                        value={d?.leadTimeDays ?? ""}
                        onChange={(e) => updateDraft(line.id, { leadTimeDays: e.target.value })}
                        className="w-full rounded-lg border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase text-muted-foreground">MOQ</label>
                      <input
                        type="number"
                        value={d?.moq ?? "1"}
                        onChange={(e) => updateDraft(line.id, { moq: e.target.value })}
                        className="w-full rounded-lg border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase text-muted-foreground">SPQ</label>
                      <input
                        type="number"
                        value={d?.spq ?? "1"}
                        onChange={(e) => updateDraft(line.id, { spq: e.target.value })}
                        className="w-full rounded-lg border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Date Code</label>
                      <input
                        type="text"
                        placeholder="25+"
                        value={d?.dateCode ?? ""}
                        onChange={(e) => updateDraft(line.id, { dateCode: e.target.value })}
                        className="w-full rounded-lg border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Packaging</label>
                      <select
                        value={d?.packaging ?? "Tape & Reel"}
                        onChange={(e) => updateDraft(line.id, { packaging: e.target.value })}
                        className="w-full rounded-lg border px-2 py-1.5 text-sm"
                      >
                        <option>Tape & Reel</option>
                        <option>Tube</option>
                        <option>Tray</option>
                        <option>Bulk</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:brightness-110"
              >
                Submit Quote
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
