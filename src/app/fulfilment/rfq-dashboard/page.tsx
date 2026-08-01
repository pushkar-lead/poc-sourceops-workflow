"use client";

import { useStore } from "@/store/store";
import { PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { SUPPLIERS } from "@/data/directory";

// Look up the supplier's display name by email (case-insensitive). Falls back to the
// full email address (never a truncation) when the email isn't in the directory, so
// suppliers sharing a local-part (e.g. two "export@..." addresses) stay distinguishable.
function getSupplierDisplayName(supplierEmail: string): string {
  const match = SUPPLIERS.find((s) => s.email?.toLowerCase() === supplierEmail.toLowerCase());
  return match?.name ?? supplierEmail;
}

export default function RfqDashboardPage() {
  const store = useStore();

  // Metrics
  const demandLines = Object.values(store.demandLines || {});
  const rfqBundles = Object.values(store.rfqBundles || {});
  const supplierQuotes = Object.values(store.supplierQuotes || {});
  const clientQuotes = Object.values(store.clientQuotes || {});

  const pendingDemand = Math.max(0, demandLines.length - rfqBundles.reduce((acc, b) => acc + b.lines.length, 0));
  const openRfqs = rfqBundles.filter((b) => ["DRAFT", "FLOATED", "RECEIVING_QUOTES", "QUOTES_IN"].includes(b.status)).length;
  const decidedRfqs = rfqBundles.filter((b) => b.status === "DECIDED").length;
  const pendingApprovals = Object.values(store.clientQuoteDecisions || {}).filter((d) => d.status === "PENDING_APPROVAL").length;
  const acceptedQuotes = clientQuotes.filter((q) => q.status === "ACCEPTED").length;

  // Quote response rate
  const quoteResponseRate = rfqBundles.length > 0 ? Math.round((supplierQuotes.length / rfqBundles.length) * 100) : 0;

  // Average margin
  const margins = Object.values(store.clientQuoteDecisions || {})
    .filter((d) => d.status === "APPROVED")
    .map((d) => d.markupPercent);
  const avgMargin = margins.length > 0 ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10 : 0;

  // Timeline metrics (simplified)
  const avgQuoteCycleTime = rfqBundles.filter((b) => ["DECIDED", "CLIENT_CONFIRMED"].includes(b.status)).length > 0 ? 5 : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="RFQ Dashboard" description="Real-time metrics on quote funnel, approval cycle, and margin performance." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Panel title="Pending Demand" className="bg-info-bg border-info">
          <div className="text-3xl font-bold text-info">{pendingDemand}</div>
          <div className="text-xs text-muted-foreground mt-1">lines awaiting RFQ</div>
        </Panel>

        <Panel title="Open RFQs" className="bg-warn-bg border-warn">
          <div className="text-3xl font-bold text-warn">{openRfqs}</div>
          <div className="text-xs text-muted-foreground mt-1">awaiting quotes</div>
        </Panel>

        <Panel title="Quote Response Rate" className="bg-ok-bg border-ok">
          <div className="text-3xl font-bold text-ok">{quoteResponseRate}%</div>
          <div className="text-xs text-muted-foreground mt-1">suppliers responded</div>
        </Panel>

        <Panel title="Pending Approvals" className="bg-bad-bg border-bad">
          <div className="text-3xl font-bold text-bad">{pendingApprovals}</div>
          <div className="text-xs text-muted-foreground mt-1">Finance decisions</div>
        </Panel>

        <Panel title="Accepted Quotes" className="bg-ok-bg border-ok">
          <div className="text-3xl font-bold text-ok">{acceptedQuotes}</div>
          <div className="text-xs text-muted-foreground mt-1">by clients</div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Funnel Summary">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span>Demand Lines</span>
              <Pill>{demandLines.length}</Pill>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>↓ RFQ Bundles</span>
              <Pill>{rfqBundles.length}</Pill>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>↓ Supplier Quotes</span>
              <Pill>{supplierQuotes.length}</Pill>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>↓ Approved Decisions</span>
              <Pill>{decidedRfqs}</Pill>
            </div>
            <div className="flex justify-between items-center text-sm font-medium">
              <span>↓ Client Quotes Sent</span>
              <Pill>{clientQuotes.length}</Pill>
            </div>
            <div className="flex justify-between items-center text-sm font-medium text-ok">
              <span>↓ Accepted</span>
              <Pill className="bg-ok text-white">{acceptedQuotes}</Pill>
            </div>
          </div>
        </Panel>

        <Panel title="Performance Metrics">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Average Markup %</div>
              <div className="text-2xl font-bold text-ok">{avgMargin}%</div>
              <div className="text-xs text-muted-foreground">across approved quotes</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Avg Quote Cycle Time</div>
              <div className="text-2xl font-bold text-info">{avgQuoteCycleTime} days</div>
              <div className="text-xs text-muted-foreground">RFQ → Approval</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Suppliers Engaged</div>
              <div className="text-2xl font-bold text-primary">{new Set(supplierQuotes.map((q) => q.supplierEmail)).size}</div>
              <div className="text-xs text-muted-foreground">unique vendors</div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="RFQ Status Breakdown">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { status: "DRAFT", count: rfqBundles.filter((b) => b.status === "DRAFT").length },
            { status: "FLOATED", count: rfqBundles.filter((b) => b.status === "FLOATED").length },
            { status: "QUOTES_IN", count: rfqBundles.filter((b) => b.status === "QUOTES_IN").length },
            { status: "DECIDED", count: rfqBundles.filter((b) => b.status === "DECIDED").length },
          ].map(({ status, count }) => (
            <div key={status} className="border rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">{status}</div>
              <div className="text-2xl font-bold">{count}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Top Suppliers (by Quote Count)">
        <div className="space-y-2">
          {Array.from(new Set(supplierQuotes.map((q) => q.supplierEmail)))
            .map((email) => ({
              email,
              count: supplierQuotes.filter((q) => q.supplierEmail === email).length,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(({ email, count }) => (
              <div key={email} className="flex justify-between items-center p-2 border rounded-lg text-sm">
                <span className="font-mono text-xs">{getSupplierDisplayName(email)}</span>
                <Pill>{count} quotes</Pill>
              </div>
            ))}
        </div>
      </Panel>
    </div>
  );
}
