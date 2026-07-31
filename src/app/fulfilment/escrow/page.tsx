"use client";

import Link from "next/link";
import { useStore } from "@/store/store";
import { allEscrow } from "@/store/selectors";
import { Panel, Pill, StatusPill, DataTable, PageHeader, type Col } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export default function EscrowBoardPage() {
  const orders = useStore((s) => s.orders);
  const rows = allEscrow(orders);

  const cols: Col<(typeof rows)[number]>[] = [
    { key: "no", header: "Order", render: (r) => <Link href={`/fulfilment/orders/${r.orderId}?`} className="font-mono text-xs text-primary hover:underline">{r.orderNo}</Link> },
    { key: "buyer", header: "Buyer", render: (r) => r.e.buyerContact.company },
    { key: "seller", header: "Seller", render: (r) => r.e.sellerContact.company },
    { key: "inv", header: "Invoice no.", render: (r) => <span className="font-mono text-xs">{r.e.invoice?.invoiceNo ?? "—"}</span> },
    { key: "amt", header: "PO amount", align: "right", render: (r) => money(r.e.poAmount, r.e.currency) },
    { key: "status", header: "Status", render: (r) => r.e.cancelledAt ? <Pill tone="bad">Cancelled</Pill> : <StatusPill status={r.e.status} /> },
    { key: "act", header: "", align: "right", render: (r) => <Link href={`/fulfilment/orders/${r.orderId}?`} className="text-xs font-medium text-primary hover:underline">View →</Link> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Escrow board" description="Every order's escrow order across the 8-state HKin-modelled flow (Draft → Released to Seller). Actions — advance, invoice, terms acknowledgment — live on each order's Escrow tab." />
      <Panel><DataTable columns={cols} rows={rows} empty="No escrow orders." /></Panel>
    </div>
  );
}
