"use client";

import Link from "next/link";
import { Mail, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader, Panel, Button, DataTable, StatusPill, Pill, type Col } from "@/components/ui/primitives";
import { DemandLine } from "@/types";
import { useStore } from "@/store/store";
import { demandRemaining } from "@/store/selectors";
import { BUYERS } from "@/data/directory";

// Same "how much of this demand line is already spoken for" convention used on
// the Demand Intake queue and the New RFQ Bundle "Select Lines" tab.
function bundledPill(remaining: number, qty: number) {
  if (remaining <= 0) return <Pill tone="neutral">Fully bundled</Pill>;
  if (remaining < qty) return <Pill tone="warn">Partial · {remaining} left</Pill>;
  return <Pill tone="ok">Open</Pill>;
}

export default function ClientRfqPage() {
  const demandLines = Object.values(useStore((s) => s.demandLines || {}));
  const rfqBundles = useStore((s) => s.rfqBundles || {});
  const [showImport, setShowImport] = useState(false);

  const buyerName = (clientPoId?: string) => BUYERS.find((b) => b.id === clientPoId)?.name || clientPoId || "Unknown Buyer";

  // Group demands by buyer
  const groupedByBuyer = demandLines.reduce(
    (acc, line) => {
      const buyer = line.clientPoId || "Unknown Buyer";
      if (!acc[buyer]) acc[buyer] = [];
      acc[buyer].push(line);
      return acc;
    },
    {} as Record<string, DemandLine[]>
  );

  const cols: Col<DemandLine>[] = [
    {
      key: "buyer",
      header: "Buyer",
      render: (d) => <span className="text-sm font-medium">{buyerName(d.clientPoId)}</span>,
    },
    {
      key: "mpn",
      header: "MPN",
      render: (d) => <span className="font-mono font-medium text-primary">{d.mpn}</span>,
    },
    {
      key: "qty",
      header: "Qty Required",
      render: (d) => <span className="text-sm font-medium">{d.qty}</span>,
    },
    {
      key: "targetPrice",
      header: "Target Price",
      render: (d) => <span className="text-sm">${d.targetPrice.toFixed(2)}</span>,
    },
    {
      key: "requiredByDate",
      header: "Required By",
      render: (d) => <span className="text-xs text-muted-foreground">{d.requiredByDate}</span>,
    },
    {
      key: "source",
      header: "Source",
      render: (d) => (
        <StatusPill
          status={d.source === "email" ? "PENDING" : d.source === "manual" ? "ACTIVE" : "INFO"}
        />
      ),
    },
    {
      key: "bundled",
      header: "Bundled",
      render: (d) => bundledPill(demandRemaining(d, rfqBundles), d.qty),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client RFQs"
        description="Incoming requests from buyers. Parse from emails or enter manually, then aggregate into supplier RFQs."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowImport(true)} variant="outline">
              <Mail className="h-4 w-4" /> Import from Email
            </Button>
            <Link href="/fulfilment/demand-intake">
              <Button>
                <Plus className="h-4 w-4" /> New Demand
              </Button>
            </Link>
          </div>
        }
      />

      {showImport && (
        <Panel title="Import Client RFQ from Email">
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-primary bg-primary/5 p-6 text-center">
              <Mail className="mx-auto mb-3 h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-medium text-foreground mb-2">Paste RFQ Email Details</div>
                <textarea
                  placeholder="From: buyer@acme.com
Subject: RFQ for STM32 microcontrollers
Body: We need 500x STM32F407VG at $8.50/unit, required by 2026-08-31..."
                  className="w-full min-h-[150px] rounded-lg border px-3 py-2 text-xs"
                />
              </div>
              <div className="mt-4 flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowImport(false)}>
                  Cancel
                </Button>
                <Button onClick={() => alert("Email parsing would happen here via rfq-intake adapter")}>
                  Parse & Create Demands
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      )}

      <Panel title={`All Client RFQs (${demandLines.length})`}>
        {demandLines.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No client RFQs yet. Import from email or create manually.
          </div>
        ) : (
          <DataTable columns={cols} rows={demandLines} />
        )}
      </Panel>

      {Object.entries(groupedByBuyer).map(([buyer, lines]) => (
        <Panel key={buyer} title={`RFQ from ${buyerName(buyer)} (${lines.length} lines)`}>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {lines.length} component(s) requested · Total demand: {lines.reduce((a, l) => a + l.qty, 0)} units
            </div>
            <DataTable columns={cols} rows={lines} />
            <Link href="/fulfilment/rfq-bundles/new">
              <Button className="w-full">
                <FileText className="h-4 w-4" /> Aggregate into Supplier RFQ
              </Button>
            </Link>
          </div>
        </Panel>
      ))}

      <Panel title="Next Steps">
        <ol className="space-y-2 text-sm list-decimal list-inside text-muted-foreground">
          <li>Receive client RFQs via email or manual entry</li>
          <li>Review and confirm demand details on this page</li>
          <li>Aggregate multiple client RFQs into a Supplier RFQ Bundle</li>
          <li>Send RFQ Bundle to multiple suppliers for competitive quotes</li>
          <li>Collect supplier quotes and compare</li>
          <li>Send client quote back to buyer</li>
        </ol>
      </Panel>
    </div>
  );
}
