"use client";

import Link from "next/link";
import { useStore } from "@/store/store";
import { allEscrow } from "@/store/selectors";
import { Panel, Button, StatusPill, DataTable, PageHeader, type Col } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export default function EscrowBoardPage() {
  const orders = useStore((s) => s.orders);
  const fund = useStore((s) => s.fundEscrow);
  const release = useStore((s) => s.releaseEscrow);
  const refund = useStore((s) => s.refundEscrow);
  const rows = allEscrow(orders);

  const cols: Col<(typeof rows)[number]>[] = [
    { key: "no", header: "Order", render: (r) => <Link href={`/fulfilment/orders/${r.orderId}?`} className="font-mono text-xs text-primary hover:underline">{r.orderNo}</Link> },
    { key: "party", header: "Supplier", render: (r) => r.party },
    { key: "prov", header: "Provider", render: (r) => r.e.provider },
    { key: "si", header: "Super-invoice", align: "right", render: (r) => money(r.e.superInvoiceTotal, r.e.currency) },
    { key: "rel", header: "Released", align: "right", render: (r) => money(r.released, r.e.currency) },
    { key: "rem", header: "Remaining", align: "right", render: (r) => money(r.remaining, r.e.currency) },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.e.status} /> },
    { key: "act", header: "", align: "right", render: (r) => {
      const isOpen = r.e.status === "OPEN";
      const hasPass = !!orders[r.orderId]?.lots.some((l) => l.testStatus === "PASS");
      const canRelease = !isOpen && hasPass && r.remaining > 0;
      return (
        <span className="flex justify-end gap-1">
          {isOpen
            ? <Button variant="outline" onClick={() => fund(r.orderId, { provider: r.e.provider, material: r.e.materialAmount, charges: r.e.chargesAmount })}>Fund</Button>
            : <Button variant="outline" onClick={() => canRelease && release(r.orderId, r.remaining, "Board release")} disabled={!canRelease}
                title={!hasPass ? "Needs a lab PASS first" : r.remaining <= 0 ? "Fully released" : ""}>Release</Button>}
          <Button variant="ghost" onClick={() => refund(r.orderId, r.remaining || r.e.materialAmount, "Board refund")}>Refund</Button>
        </span>
      );
    } },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Escrow board" description="3-party escrow across all orders (super-invoice A1+A2). Release on lab PASS; refund on FAIL." />
      <Panel><DataTable columns={cols} rows={rows} empty="No escrow accounts." /></Panel>
    </div>
  );
}
