"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { calculateLineMargin } from "@/store/selectors";
import { PageHeader, Panel, Button, Pill, DataTable, StatusPill, type Col } from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/form";
import { qtyfmt } from "@/lib/utils";
import { SUPPLIERS, BUYERS } from "@/data/directory";
import type { ClientQuoteDecision, QuoteLine } from "@/types";

// Look up the supplier's display name by email (case-insensitive). Falls back to the
// full email address (never a truncation) when the email isn't in the directory, so
// suppliers sharing a local-part (e.g. two "export@..." addresses) stay distinguishable.
function getSupplierDisplayName(supplierEmail: string): string {
  const match = SUPPLIERS.find((s) => s.email?.toLowerCase() === supplierEmail.toLowerCase());
  return match?.name ?? supplierEmail;
}

// Buyer allocations key off the directory id (e.g. "buyer-001"), not an email — resolve to name.
function getBuyerDisplayName(clientPoId: string): string {
  return BUYERS.find((b) => b.id === clientPoId)?.name ?? clientPoId;
}

interface LineBreakdownRow {
  rfqLineId: string;
  quoteLineId: string;
  mpn: string;
  supplierName: string;
  qty: number;
  qtyMissing: boolean; // stockQty was 0/undefined on the quote line — never silently treated as a fake qty
  vendorUnitPrice: number;
  clientUnitPrice: number;
  vendorCost: number;
  clientRevenue: number;
  marginDollar: number;
  marginPercent: number;
}

const money2 = (n: number) => `$${n.toFixed(2)}`;

// Per-line P&L table. Reused for every pending decision's expanded view.
const lineCols: Col<LineBreakdownRow>[] = [
  { key: "mpn", header: "MPN", render: (r) => <span className="font-medium">{r.mpn}</span> },
  { key: "supplier", header: "Supplier", render: (r) => <span>{r.supplierName}</span> },
  {
    key: "qty",
    header: "Qty",
    align: "right",
    render: (r) =>
      r.qtyMissing ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">—</span>
          <Pill tone="warn" className="text-[10px]">no stock qty</Pill>
        </span>
      ) : (
        <span>{qtyfmt(r.qty)}</span>
      ),
  },
  { key: "vendorUnit", header: "Vendor Unit Price", align: "right", render: (r) => <span>{money2(r.vendorUnitPrice)}</span> },
  { key: "clientUnit", header: "Client Unit Price", align: "right", render: (r) => <span>{money2(r.clientUnitPrice)}</span> },
  { key: "vendorCost", header: "Vendor Cost", align: "right", render: (r) => <span>{r.qtyMissing ? "—" : money2(r.vendorCost)}</span> },
  { key: "clientRevenue", header: "Client Revenue", align: "right", render: (r) => <span>{r.qtyMissing ? "—" : money2(r.clientRevenue)}</span> },
  {
    key: "marginDollar",
    header: "Margin $",
    align: "right",
    render: (r) => <span className={r.qtyMissing ? "text-muted-foreground" : "font-medium text-ok"}>{r.qtyMissing ? "—" : money2(r.marginDollar)}</span>,
  },
  {
    key: "marginPercent",
    header: "Margin %",
    align: "right",
    render: (r) => <span className={r.qtyMissing ? "text-muted-foreground" : "font-medium text-ok"}>{r.qtyMissing ? "—" : `${r.marginPercent.toFixed(1)}%`}</span>,
  },
];

export default function QuoteApprovalsPage() {
  const clientQuoteDecisions = useStore((s) => s.clientQuoteDecisions);
  const rfqBundles = useStore((s) => s.rfqBundles);
  const supplierQuotes = useStore((s) => s.supplierQuotes);
  const approveQuoteDecision = useStore((s) => s.approveQuoteDecision);
  const rejectQuoteDecision = useStore((s) => s.rejectQuoteDecision);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const decisions = useMemo(
    () => Object.values(clientQuoteDecisions).filter((d) => d.status === "PENDING_APPROVAL"),
    [clientQuoteDecisions],
  );

  // Nice-to-have: recently approved/rejected decisions, so Finance can see who decided what and why.
  const recentlyDecided = useMemo(
    () =>
      Object.values(clientQuoteDecisions)
        .filter((d) => d.status === "APPROVED" || d.status === "REJECTED")
        .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
        .slice(0, 8),
    [clientQuoteDecisions],
  );

  // Per-line breakdown: MPN + supplier + qty + prices + margin for EACH selected quote line,
  // so a losing line can't hide inside a winning blended average.
  const getLineBreakdown = (decision: ClientQuoteDecision): LineBreakdownRow[] => {
    const bundle = rfqBundles[decision.rfqBundleId];

    return decision.selectedQuoteLines.map((selection) => {
      const rfqLine = bundle?.lines.find((l) => l.id === selection.rfqLineId);

      let quoteLine: QuoteLine | undefined;
      for (const sq of Object.values(supplierQuotes)) {
        const found = sq.lines.find((l) => l.id === selection.quoteLineId);
        if (found) {
          quoteLine = found;
          break;
        }
      }

      const mpn = rfqLine?.mpn ?? quoteLine?.quotedMpn ?? "Unknown MPN";
      const supplierName = quoteLine?.supplierEmail ? getSupplierDisplayName(quoteLine.supplierEmail) : "Unknown supplier";
      const vendorUnitPrice = quoteLine?.unitPrice ?? 0;

      const rawQty = quoteLine?.stockQty ?? 0;
      const qtyMissing = !(rawQty > 0); // covers 0, undefined, and any invalid negative value
      const effectiveQty = qtyMissing ? 0 : rawQty;

      const margin = calculateLineMargin(vendorUnitPrice, effectiveQty, decision.markupPercent);

      return {
        rfqLineId: selection.rfqLineId,
        quoteLineId: selection.quoteLineId,
        mpn,
        supplierName,
        qty: rawQty,
        qtyMissing,
        vendorUnitPrice,
        clientUnitPrice: margin.clientUnitPrice,
        vendorCost: margin.vendorCost,
        clientRevenue: margin.clientRevenue,
        marginDollar: margin.grossMarginDollar,
        marginPercent: margin.grossMarginPercent,
      };
    });
  };

  // Bundle-level aggregate — a TOTAL, shown alongside (never instead of) the per-line rows above.
  const getBundleTotals = (rows: LineBreakdownRow[]) => {
    const vendorCost = rows.reduce((a, r) => a + r.vendorCost, 0);
    const clientRevenue = rows.reduce((a, r) => a + r.clientRevenue, 0);
    const marginDollar = clientRevenue - vendorCost;
    const marginPercent = vendorCost > 0 ? (marginDollar / vendorCost) * 100 : 0;
    const missingCount = rows.filter((r) => r.qtyMissing).length;
    return { vendorCost, clientRevenue, marginDollar, marginPercent, missingCount };
  };

  const handleApprove = async (decisionId: string) => {
    await approveQuoteDecision(decisionId);
  };

  const openReject = (decisionId: string) => {
    setExpandedId(decisionId); // surface the reason textarea inside the card, per existing expand/collapse pattern
    setRejectingId(decisionId);
    setRejectReason("");
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectReason("");
  };

  const confirmReject = (decisionId: string) => {
    if (!rejectReason.trim()) return; // inline guard — button is also disabled until text is entered
    rejectQuoteDecision(decisionId, rejectReason.trim());
    setRejectingId(null);
    setRejectReason("");
  };

  const cols: Col<ClientQuoteDecision>[] = [
    {
      key: "bundle",
      header: "RFQ Bundle",
      render: (d) => <span className="font-mono text-xs font-semibold text-primary">{d.rfqBundleId.substring(0, 8)}</span>,
    },
    {
      key: "lines",
      header: "Lines",
      render: (d) => <span className="text-sm">{d.selectedQuoteLines.length}</span>,
    },
    {
      key: "markup",
      header: "Markup %",
      render: (d) => <span className="text-sm font-medium">{d.markupPercent}%</span>,
    },
    {
      key: "pnl",
      header: "Total Margin",
      render: (d) => {
        const { marginDollar, missingCount } = getBundleTotals(getLineBreakdown(d));
        return (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
            {money2(marginDollar)}
            {missingCount > 0 && <Pill tone="warn" className="text-[10px]">incomplete</Pill>}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Action",
      render: (d) => (
        <div className="flex gap-2">
          <Button onClick={() => handleApprove(d.id)} className="text-xs">
            Approve
          </Button>
          <Button onClick={() => openReject(d.id)} variant="outline" className="text-xs text-bad">
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote Approvals"
        description="Finance review of quote decisions before sending to clients. Check P&L and margin per line."
      />

      {decisions.length === 0 ? (
        <Panel>
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No pending quote approvals.
          </div>
        </Panel>
      ) : (
        <>
          <DataTable columns={cols} rows={decisions} />

          {decisions.map((decision) => {
            const rows = getLineBreakdown(decision);
            const totals = getBundleTotals(rows);
            const isRejecting = rejectingId === decision.id;

            return (
              <div
                key={decision.id}
                className="cursor-pointer rounded-lg border p-4 hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === decision.id ? null : decision.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-mono text-sm font-semibold text-primary">{decision.rfqBundleId.substring(0, 12)}</div>
                    <div className="text-xs text-muted-foreground">{decision.selectedQuoteLines.length} lines • {decision.markupPercent}% markup</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-ok">{money2(totals.marginDollar)}</div>
                    <div className="text-xs text-muted-foreground">Total margin (all lines)</div>
                  </div>
                </div>

                {expandedId === decision.id && (
                  <div className="mt-4 space-y-3 border-t pt-4" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="mb-2 text-xs font-medium">Per-Line P&L:</div>
                      <DataTable columns={lineCols} rows={rows} />
                      {totals.missingCount > 0 && (
                        <div className="mt-1.5 text-[11px] text-warn">
                          ⚠ {totals.missingCount} line{totals.missingCount > 1 ? "s" : ""} missing stock qty — excluded from the
                          cost totals below (shown as “—”, not a substituted guess). Confirm quantity with the supplier before approving.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 rounded bg-muted/30 p-3 text-sm">
                      <div className="col-span-2 text-xs font-medium text-muted-foreground">
                        Bundle Total — sum of {rows.length} line{rows.length !== 1 ? "s" : ""} above (aggregate only, not a substitute for the per-line view)
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Vendor Cost (A1)</div>
                        <div className="font-bold text-primary">{money2(totals.vendorCost)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Client Revenue</div>
                        <div className="font-bold text-ok">{money2(totals.clientRevenue)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground">Gross Margin</div>
                        <div className="font-bold text-ok">{money2(totals.marginDollar)} ({totals.marginPercent.toFixed(1)}%)</div>
                      </div>
                    </div>

                    {decision.allocations.length > 0 && (
                      <div className="rounded bg-info-bg p-2">
                        <div className="mb-2 text-xs font-medium">Client Allocations (multi-buyer):</div>
                        <div className="space-y-1 text-xs">
                          {decision.allocations.map((alloc, i) => (
                            <div key={i} className="flex justify-between text-info">
                              <span>{getBuyerDisplayName(alloc.clientPoId)}: {alloc.qty} units</span>
                              <span>{money2(alloc.qty * alloc.unitPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isRejecting ? (
                      <div className="flex gap-2">
                        <Button onClick={() => handleApprove(decision.id)}>✓ Approve Quote</Button>
                        <Button onClick={() => openReject(decision.id)} variant="outline" className="text-bad">
                          ✗ Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-bad bg-bad-bg/40 p-3">
                        <div className="text-xs font-medium text-bad">Rejection reason (required)</div>
                        <Textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Explain why this quote decision is being rejected (e.g. margin too thin on line X, price mismatch, needs re-quote)…"
                          className="text-xs"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => confirmReject(decision.id)}
                            disabled={!rejectReason.trim()}
                            variant="outline"
                            className="border-bad text-bad hover:bg-bad-bg"
                          >
                            Confirm Reject
                          </Button>
                          <Button variant="outline" onClick={cancelReject}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {recentlyDecided.length > 0 && (
        <Panel title="Recently Decided">
          <div className="space-y-2 text-xs">
            {recentlyDecided.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <div>
                  <span className="font-mono font-semibold text-primary">{d.rfqBundleId.substring(0, 12)}</span>
                  <span className="ml-2 text-muted-foreground">
                    {d.decidedBy ?? "Unknown"} · {d.decidedAt ?? "—"}
                  </span>
                  {d.status === "REJECTED" && d.rejectionReason && (
                    <div className="mt-1 text-bad">Reason: {d.rejectionReason}</div>
                  )}
                </div>
                <StatusPill status={d.status} />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
