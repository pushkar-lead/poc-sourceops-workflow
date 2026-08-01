"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useStore } from "@/store/store";
import { toast } from "sonner";
import type { ClientQuote } from "@/types";

export default function ClientQuotePortalPage() {
  const params = useParams();
  const clientQuoteId = params.clientQuoteId as string;
  const token = params.token as string;

  const quote = useStore((s) => s.clientQuotes[clientQuoteId]);
  const acceptClientQuote = useStore((s) => s.acceptClientQuote);
  const requestQuoteChanges = useStore((s) => s.requestQuoteChanges);

  const [showChangeForm, setShowChangeForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [accepting, setAccepting] = useState(false);

  if (!quote || quote.token !== token) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-semibold">Invalid or expired link</h1>
        <p className="mt-2 text-sm text-muted-foreground">This quote link is not valid. Please contact Sharpbuy sales for a new link.</p>
      </div>
    );
  }

  // Only a still-PENDING quote is bounded by its expiry date — a quote already accepted
  // (or otherwise decided) should never suddenly present as expired.
  const isExpired = quote.expiresAt < new Date().toISOString().slice(0, 10);
  if (quote.status === "PENDING" && isExpired) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-semibold">This quote has expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">Expiry was {quote.expiresAt}. Please contact Sharpbuy sales for an updated quote.</p>
      </div>
    );
  }

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptClientQuote(clientQuoteId);
    } finally {
      setAccepting(false);
    }
  };

  const handleRequestChanges = () => {
    if (!notes.trim()) {
      toast.error("Please describe the change you'd like before submitting");
      return;
    }
    requestQuoteChanges(clientQuoteId, notes.trim());
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sharpbuy Sales</div>
          <h1 className="mt-1 text-xl font-semibold">Proforma Invoice {quote.piNo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dear {quote.clientName} · {quote.lines.length} component(s) · Expires {quote.expiresAt}
          </p>
        </div>

        {quote.status !== "PENDING" ? (
          <StatusPanel quote={quote} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">MPN</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Qty</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Unit Price</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lines.map((l) => (
                      <tr key={l.rfqLineId} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{l.mpn}</td>
                        <td className="px-3 py-2 text-right tnum">{l.qty}</td>
                        <td className="px-3 py-2 text-right tnum">${l.unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium tnum">${(l.qty * l.unitPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">Quote expires {quote.expiresAt}</span>
                <span className="text-base font-semibold">Total: ${quote.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            {!showChangeForm ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setShowChangeForm(true)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Request Changes
                </button>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
                >
                  {accepting ? "Accepting…" : "Accept Quote"}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-4">
                <label className="mb-1 block text-[10px] uppercase text-muted-foreground">What would you like changed?</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="e.g. Can we revisit pricing on line 2, or move qty to 500 units..."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => { setShowChangeForm(false); setNotes(""); }}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestChanges}
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:brightness-110"
                  >
                    Submit Request
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Read-only terminal states: quote already accepted / a change request already sent /
// withdrawn by Sharpbuy / expired-on-record. No action buttons shown again.
function StatusPanel({ quote }: { quote: ClientQuote }) {
  if (quote.status === "ACCEPTED") {
    return (
      <div className="rounded-lg border bg-ok-bg p-6 text-center">
        <div className="text-lg font-semibold text-ok">Quote accepted</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you — you accepted this quote{quote.acceptedAt ? ` on ${quote.acceptedAt}` : ""}. Sharpbuy will be in touch shortly to get your order underway.
        </p>
      </div>
    );
  }

  if (quote.status === "CHANGE_REQUESTED") {
    return (
      <div className="rounded-lg border bg-warn-bg p-6 text-center">
        <div className="text-lg font-semibold text-warn">Change request sent</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you — your requested changes have been sent to Sharpbuy sales. We&apos;ll follow up with a revised quote shortly.
        </p>
        {quote.buyerNotes && (
          <div className="mx-auto mt-4 max-w-md rounded border bg-card px-3 py-2 text-left text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Your note: </span>
            {quote.buyerNotes}
          </div>
        )}
      </div>
    );
  }

  if (quote.status === "WITHDRAWN") {
    return (
      <div className="rounded-lg border bg-bad-bg p-6 text-center">
        <div className="text-lg font-semibold text-bad">Quote withdrawn</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This quote is no longer available for acceptance. Please contact Sharpbuy sales if you have questions.
        </p>
      </div>
    );
  }

  // EXPIRED (or any other non-pending status)
  return (
    <div className="rounded-lg border bg-bad-bg p-6 text-center">
      <div className="text-lg font-semibold text-bad">Quote expired</div>
      <p className="mt-2 text-sm text-muted-foreground">
        This quote has expired and is no longer available for acceptance. Please contact Sharpbuy sales for an updated quote.
      </p>
    </div>
  );
}
