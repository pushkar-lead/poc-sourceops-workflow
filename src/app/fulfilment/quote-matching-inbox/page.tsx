"use client";

import { useState } from "react";
import { useStore } from "@/store/store";
import { unassignedQuoteEmails } from "@/store/selectors";
import { PageHeader, Panel, Button, StatusPill } from "@/components/ui/primitives";
import { SUPPLIERS } from "@/data/directory";

// Look up the supplier's display name by email (case-insensitive). Falls back to the
// full email address (never a truncation) when the email isn't in the directory, so
// suppliers sharing a local-part (e.g. two "export@..." addresses) stay distinguishable.
function getSupplierDisplayName(supplierEmail: string): string {
  const match = SUPPLIERS.find((s) => s.email?.toLowerCase() === supplierEmail.toLowerCase());
  return match?.name ?? supplierEmail;
}

export default function QuoteMatchingInboxPage() {
  const store = useStore();
  const bundles = Object.values(store.rfqBundles);

  // For demo: create mock unmatched emails (in real impl, these come from email integration)
  const [unmatchedEmails] = useState([
    {
      id: "email-1",
      bundleId: bundles[0]?.id || "",
      supplierEmail: "supplier@acme.com",
      subject: "RE: RFQ Bundle - Quote Response",
      body: "We can provide STM32F407VG at $8.50 per unit, MOQ 100...",
      parsed: { lines: [{ quotedMpn: "STM32F407VG", unitPrice: 8.5, stockQty: 500 }] },
      status: "UNMATCHED" as const,
    },
  ]);

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const selectedEmail = unmatchedEmails.find((e) => e.id === selectedEmailId);
  const selectedBundle = selectedEmail ? store.rfqBundles[selectedEmail.bundleId] : null;

  const handleMatchEmail = (rfqLineId: string) => {
    if (!selectedEmail) return;
    store.matchQuoteEmail(selectedEmail.bundleId, selectedEmail.id, rfqLineId);
    alert(`Email matched to RfqLine ${rfqLineId}`);
    setSelectedEmailId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote Matching Inbox"
        description="Supplier emails that couldn't auto-parse. Match them to RFQ lines manually, or mark as escalated."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={`Unmatched Emails (${unmatchedEmails.length})`} className="lg:col-span-1">
          {unmatchedEmails.length === 0 ? (
            <div className="text-sm text-muted-foreground">All supplier emails matched! 🎉</div>
          ) : (
            <div className="space-y-2">
              {unmatchedEmails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmailId(email.id)}
                  className={`w-full text-left p-2 rounded-lg border transition ${
                    selectedEmailId === email.id ? "border-primary bg-primary-bg" : "hover:border-primary"
                  }`}
                >
                  <div className="font-mono text-xs text-primary">{getSupplierDisplayName(email.supplierEmail)}</div>
                  <div className="text-xs text-muted-foreground truncate">{email.subject}</div>
                  <StatusPill status={email.status} />
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Email Details" className="lg:col-span-2">
          {!selectedEmail ? (
            <div className="text-sm text-muted-foreground text-center py-8">Select an email to view details</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">From</div>
                <div className="font-mono text-sm">{selectedEmail.supplierEmail}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Subject</div>
                <div className="text-sm">{selectedEmail.subject}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <div className="text-sm bg-gray-50 dark:bg-gray-900 rounded p-2 text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {selectedEmail.body}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Parsed Lines</div>
                <div className="space-y-1 text-xs">
                  {selectedEmail.parsed.lines.map((line, i) => (
                    <div key={i} className="bg-info-bg p-2 rounded">
                      {line.quotedMpn} @ ${line.unitPrice} · {line.stockQty} units
                    </div>
                  ))}
                </div>
              </div>

              {selectedBundle && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Match to RFQ Line</div>
                  <div className="space-y-1">
                    {selectedBundle.lines.map((line) => (
                      <button
                        key={line.id}
                        onClick={() => handleMatchEmail(line.id)}
                        className="w-full text-left p-2 rounded-lg border border-primary text-primary hover:bg-primary-bg text-xs font-mono"
                      >
                        {line.mpn} · Qty {line.aggregatedQty}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1 text-xs">Mark Escalated</Button>
                <Button variant="outline" className="flex-1 text-xs">Delete</Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
