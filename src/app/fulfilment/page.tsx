"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useStore } from "@/store/store";
import { kpis, allApprovals, allLots } from "@/store/selectors";
import { KpiCard, Panel, StatusPill, Pill, DataTable, PageHeader, type Col } from "@/components/ui/primitives";
import { money } from "@/lib/utils";
import type { Order } from "@/types";

export default function DashboardPage() {
  const orders = useStore((s) => s.orders);
  const k = kpis(orders);
  const list = Object.values(orders).sort((a, b) => (a.orderNo < b.orderNo ? 1 : -1));
  const recent = list.slice(0, 6);

  const cols: Col<Order>[] = [
    { key: "no", header: "Order", render: (o) => <Link href={`/fulfilment/orders/${o.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{o.orderNo}</Link> },
    { key: "parties", header: "Buyer → Supplier", render: (o) => <span className="text-sm">{o.buyer.name} <span className="text-faint">→</span> {o.supplier.name}</span> },
    { key: "route", header: "Route", render: (o) => <Pill tone={o.tradeType === "INTERNATIONAL" ? "info" : "neutral"}>{o.tradeType === "INTERNATIONAL" ? "Intl" : "Domestic"}</Pill> },
    { key: "pay", header: "Payment", render: (o) => <span className="text-xs text-muted-foreground">{o.paymentMode}</span> },
    { key: "value", header: "Value", align: "right", render: (o) => money(o.sellTotal, o.currency) },
    { key: "status", header: "Status", render: (o) => <StatusPill status={o.status} /> },
  ];

  const attention = [
    ...list.filter((o) => o.status === "ON_HOLD" || o.journey.some((s) => s.status === "BLOCKED"))
      .map((o) => ({ id: o.id, orderNo: o.orderNo, text: `Blocked / on hold (${o.supplier.name})`, tone: "bad" as const })),
    ...allApprovals(orders).filter((a) => a.status === "PENDING")
      .map((a) => ({ id: a.orderId, orderNo: a.orderNo, text: `${a.kind === "PO_REVIEW" ? "PO review" : "Payment release"} pending — ${a.party}`, tone: "warn" as const })),
    ...allLots(orders).filter((l) => l.testStatus === "MAYBE")
      .map((l) => ({ id: l.orderId, orderNo: l.orderNo, text: `Lot ${l.lotCode} flagged MAYBE — needs client decision`, tone: "warn" as const })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Fulfilment" description="1Buy internal ops &amp; management console — the operator&apos;s command center (Mode 4)." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="Open orders" value={k.open} />
        <KpiCard label="Approvals" value={k.pendingApprovals} hint="pending" tone="warn" />
        <KpiCard label="Payments due" value={k.paymentsDue} hint="action" tone="warn" />
        <KpiCard label="Tests pending" value={k.testsPending} hint="quality" tone="warn" />
        <KpiCard label="Blocked" value={k.blocked} hint="on hold" tone="bad" />
        <KpiCard label="Escrow to release" value={money(k.escrowToRelease)} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Recent orders" actions={<Link href="/fulfilment/orders" className="text-xs font-medium text-primary hover:underline">View all →</Link>}>
            <DataTable columns={cols} rows={recent} />
          </Panel>
        </div>
        <Panel title="Needs attention">
          {attention.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">All clear 🎉</div> : (
            <ul className="space-y-2">
              {attention.map((a, i) => (
                <li key={i}>
                  <Link href={`/fulfilment/orders/${a.id}`} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm hover:border-primary">
                    <AlertTriangle className={a.tone === "bad" ? "mt-0.5 h-4 w-4 shrink-0 text-bad" : "mt-0.5 h-4 w-4 shrink-0 text-warn"} />
                    <span className="min-w-0"><span className="font-mono text-[11px] text-muted-foreground">{a.orderNo}</span><span className="block leading-snug">{a.text}</span></span>
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
