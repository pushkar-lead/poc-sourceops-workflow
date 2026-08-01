"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/store/store";
import { quotesForLine, calculateLineMargin, bestQuotePerLine } from "@/store/selectors";
import { PageHeader, Panel, Button, StatusPill } from "@/components/ui/primitives";
import { SUPPLIERS } from "@/data/directory";

// Look up the supplier's display name by email (case-insensitive). Falls back to the
// full email address (never a truncation) when the email isn't in the directory, so
// suppliers sharing a local-part (e.g. two "export@..." addresses) stay distinguishable.
function getSupplierDisplayName(supplierEmail: string): string {
  const match = SUPPLIERS.find((s) => s.email?.toLowerCase() === supplierEmail.toLowerCase());
  return match?.name ?? supplierEmail;
}

export default function DecideQuotePage() {
  const router = useRouter();
  const params = useParams();
  const bundleId = params.id as string;
  const store = useStore();

  const bundle = store.rfqBundles[bundleId];
  const quotes = store.supplierQuotes;

  const [tab, setTab] = useState(0);
  const [selectedQuoteLineIds, setSelectedQuoteLineIds] = useState<string[]>([]);
  const [markup, setMarkup] = useState(25);

  if (!bundle) {
    return <div className="p-6 text-center">RFQ Bundle not found</div>;
  }

  const tabs = ["Compare", "P&L", "Review", "Submit"];

  const handleSubmitDecision = () => {
    if (selectedQuoteLineIds.length === 0) {
      toast.error("Select at least one quote line");
      return;
    }
    const decisionId = store.createClientQuoteDecision({
      rfqBundleId: bundleId,
      selectedQuoteLineIds,
      markupPercent: markup,
    });
    if (decisionId) {
      store.submitQuoteForApproval(bundleId);
      router.push("/fulfilment/quote-approvals");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Quote Comparison & Decision`} description={`RFQ Bundle ${bundleId.slice(0, 12)}`} />

      <div className="border-b flex gap-1">
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === i ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <Panel title="Compare Supplier Quotes">
          <div className="space-y-6">
            {bundle.lines.map((line) => {
              const lineQuotes = quotesForLine(quotes, line.id);
              const best = bestQuotePerLine(quotes, line.id);
              return (
                <div key={line.id} className="border rounded-lg p-4">
                  <div className="font-semibold mb-3">{line.mpn} · Qty {line.aggregatedQty}</div>
                  {lineQuotes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No quotes yet</div>
                  ) : (
                    <div className="space-y-2">
                      {lineQuotes.map((q) => (
                        <label key={q.id} className="flex items-center gap-3 rounded-lg border p-2 cursor-pointer hover:border-primary">
                          <input
                            type="radio"
                            name={`quote-${line.id}`}
                            checked={selectedQuoteLineIds.includes(q.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedQuoteLineIds([...selectedQuoteLineIds.filter((id) => !lineQuotes.map((l) => l.id).includes(id)), q.id]);
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">
                              <span className="font-medium">{getSupplierDisplayName(q.supplierEmail)}</span>
                              {best?.id === q.id && <span className="ml-2 text-xs text-ok">★ Best Price</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ${q.unitPrice.toFixed(2)} · {q.leadTimeDays}d · {q.packaging} · MOQ {q.moq}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setTab(1)}>Next: Review P&L →</Button>
          </div>
        </Panel>
      )}

      {tab === 1 && (
        <Panel title="P&L Summary">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Markup %</div>
                <input
                  type="number"
                  value={markup}
                  onChange={(e) => setMarkup(+e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>

            {bundle.lines.map((line) => {
              const selectedQuoteId = selectedQuoteLineIds.find((id) => {
                for (const q of Object.values(quotes)) {
                  for (const l of q.lines) {
                    if (l.id === id && l.rfqLineId === line.id) return true;
                  }
                }
                return false;
              });

              let costRow = null;
              if (selectedQuoteId) {
                for (const q of Object.values(quotes)) {
                  for (const l of q.lines) {
                    if (l.id === selectedQuoteId) {
                      const margin = calculateLineMargin(l.unitPrice, line.aggregatedQty, markup);
                      costRow = (
                        <div key={line.id} className="border-t pt-3">
                          <div className="font-semibold mb-1">{line.mpn}</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>Vendor Cost: ${margin.vendorCost.toFixed(2)}</div>
                            <div>Client Price: ${margin.clientRevenue.toFixed(2)}</div>
                            <div className="col-span-2 font-medium text-ok">Gross Margin: ${margin.grossMarginDollar.toFixed(2)} ({margin.grossMarginPercent.toFixed(1)}%)</div>
                          </div>
                        </div>
                      );
                    }
                  }
                }
              }
              return costRow;
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setTab(0)}>← Back</Button>
            <Button onClick={() => setTab(2)}>Next: Review →</Button>
          </div>
        </Panel>
      )}

      {tab === 2 && (
        <Panel title="Review Decision">
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Quotes Selected:</span> {selectedQuoteLineIds.length} / {bundle.lines.length} lines
            </div>
            <div>
              <span className="font-medium">Markup:</span> {markup}%
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setTab(1)}>← Back</Button>
            <Button onClick={() => setTab(3)}>Next: Submit →</Button>
          </div>
        </Panel>
      )}

      {tab === 3 && (
        <Panel title="Submit for Approval">
          <div className="space-y-3 text-sm mb-6">
            <p className="text-muted-foreground">This will submit the quote decision to Finance for approval. Once approved, client quote will be generated and sent.</p>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setTab(2)}>← Back</Button>
            <Button onClick={handleSubmitDecision}>Submit for Finance Review</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
