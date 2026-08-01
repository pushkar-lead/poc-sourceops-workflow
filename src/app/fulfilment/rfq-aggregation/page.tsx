"use client";

import { useStore } from "@/store/store";
import { PageHeader, Panel } from "@/components/ui/primitives";

export default function RfqAggregationPage() {
  const store = useStore();
  const demandLines = Object.values(store.demandLines || {});
  const rfqBundles = Object.values(store.rfqBundles || {});
  const supplierQuotes = Object.values(store.supplierQuotes || {});
  const clientQuotes = Object.values(store.clientQuotes || {});

  // Calculate statistics
  const totalClientRfqLines = demandLines.length;
  const aggregatedInRfqs = rfqBundles.reduce((a, b) => a + b.lines.length, 0);
  const avgLinesPerRfq = rfqBundles.length > 0 ? (aggregatedInRfqs / rfqBundles.length).toFixed(1) : 0;
  const quotesCollected = supplierQuotes.length;
  // Response rate = quotes collected ÷ supplier invites actually sent — NOT ÷ bundle count.
  // A bundle can carry many invites, so dividing by `rfqBundles.length` under-counted the
  // denominator (e.g. 3 quotes from 1 bundle with 3 invited suppliers showed as "300%").
  // PENDING invites (never floated) are excluded since they never had a chance to respond.
  const totalInvitesSent = rfqBundles.reduce(
    (a, b) => a + b.invites.filter((inv) => inv.status !== "PENDING").length,
    0,
  );
  const quoteResponseRate =
    totalInvitesSent > 0
      ? Math.round((quotesCollected / totalInvitesSent) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFQ Aggregation & Flow"
        description="Track how client RFQs flow through to supplier RFQs and back to client quotes."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Panel title="Client RFQs" className="text-center">
          <div className="text-3xl font-bold text-primary">{totalClientRfqLines}</div>
          <div className="text-xs text-muted-foreground mt-1">demand lines received</div>
        </Panel>

        <Panel title="Aggregated" className="text-center">
          <div className="text-3xl font-bold text-info">{aggregatedInRfqs}</div>
          <div className="text-xs text-muted-foreground mt-1">lines in {rfqBundles.length} RFQ bundles</div>
        </Panel>

        <Panel title="Supplier Responses" className="text-center">
          <div className="text-3xl font-bold text-ok">{quotesCollected}</div>
          <div className="text-xs text-muted-foreground mt-1">{quoteResponseRate}% response rate</div>
        </Panel>

        <Panel title="Client Quotes" className="text-center">
          <div className="text-3xl font-bold text-warn">{clientQuotes.length}</div>
          <div className="text-xs text-muted-foreground mt-1">quotes sent back to buyers</div>
        </Panel>
      </div>

      <Panel title="Data Flow Diagram">
        <div className="space-y-6">
          <div className="relative">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  1
                </div>
                <div className="h-12 w-0.5 bg-primary/20"></div>
              </div>
              <div className="pb-8">
                <div className="font-medium text-foreground">Client RFQ Reception</div>
                <div className="text-sm text-muted-foreground">
                  Buyers send RFQs via email or manual entry
                </div>
                <div className="mt-2 text-xs bg-info/10 border border-info/20 rounded p-2 text-info">
                  📧 Email parsing via rfq-intake adapter
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info text-white text-sm font-bold">
                  2
                </div>
                <div className="h-12 w-0.5 bg-info/20"></div>
              </div>
              <div className="pb-8">
                <div className="font-medium text-foreground">Demand Line Creation</div>
                <div className="text-sm text-muted-foreground">
                  Each RFQ line becomes a DemandLine with MPN, quantity, required date
                </div>
                <div className="mt-2 text-xs">
                  <b>{totalClientRfqLines}</b> demand lines in system
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warn text-white text-sm font-bold">
                  3
                </div>
                <div className="h-12 w-0.5 bg-warn/20"></div>
              </div>
              <div className="pb-8">
                <div className="font-medium text-foreground">RFQ Aggregation</div>
                <div className="text-sm text-muted-foreground">
                  Group demand lines by MPN, currency, required date
                </div>
                <div className="mt-2 text-xs">
                  Aggregate into <b>{rfqBundles.length}</b> RFQ bundles (avg {avgLinesPerRfq} lines each)
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  4
                </div>
                <div className="h-12 w-0.5 bg-primary/20"></div>
              </div>
              <div className="pb-8">
                <div className="font-medium text-foreground">Send RFQ to Suppliers</div>
                <div className="text-sm text-muted-foreground">
                  Float aggregated RFQ bundle to multiple suppliers
                </div>
                <div className="mt-2 text-xs">
                  Suppliers receive via email or portal link
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ok text-white text-sm font-bold">
                  5
                </div>
                <div className="h-12 w-0.5 bg-ok/20"></div>
              </div>
              <div className="pb-8">
                <div className="font-medium text-foreground">Collect Supplier Quotes</div>
                <div className="text-sm text-muted-foreground">
                  Suppliers respond with prices, stock, lead times
                </div>
                <div className="mt-2 text-xs">
                  <b>{quotesCollected}</b> quotes received ({quoteResponseRate}% response)
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-bold">
                  6
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground">Compare & Create Client Quote</div>
                <div className="text-sm text-muted-foreground">
                  SC selects best quotes, calculates margin, sends quote back to buyer
                </div>
                <div className="mt-2 text-xs">
                  <b>{clientQuotes.length}</b> client quotes sent back to buyers
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Key Points">
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Client RFQs are parsed from emails (with fallback to manual entry)</li>
            <li>Multiple client RFQs are aggregated into one supplier RFQ</li>
            <li>Aggregation groups by: MPN, currency, required date (within tolerance)</li>
            <li>One supplier RFQ can reference multiple client RFQs</li>
            <li>Supplier quotes can be compared and best ones selected</li>
            <li>Selected quotes are sent back to original buyers</li>
          </ul>
        </Panel>

        <Panel title="Traceability">
          <div className="space-y-2 text-sm">
            <div>
              <div className="font-medium text-foreground mb-1">Client RFQ → DemandLine</div>
              <div className="text-xs text-muted-foreground">Track source buyer for each line</div>
            </div>
            <div>
              <div className="font-medium text-foreground mb-1">DemandLine → RfqLine</div>
              <div className="text-xs text-muted-foreground">Keep buyer reference through aggregation</div>
            </div>
            <div>
              <div className="font-medium text-foreground mb-1">RfqLine → SupplierQuote</div>
              <div className="text-xs text-muted-foreground">Match quotes to original demands</div>
            </div>
            <div>
              <div className="font-medium text-foreground mb-1">SupplierQuote → ClientQuote</div>
              <div className="text-xs text-muted-foreground">Quote back to buyer with margin</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
