"use client";

import Link from "next/link";
import { useStore } from "@/store/store";
import { allPayments } from "@/store/selectors";
import { Panel, Button, StatusPill, Pill, DataTable, PageHeader, type Col } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export default function PaymentsPage() {
  const orders = useStore((s) => s.orders);
  const setStatus = useStore((s) => s.setPaymentStatus);
  const rows = allPayments(orders);

  const cols: Col<(typeof rows)[number]>[] = [
    { key: "no", header: "Order", render: (r) => <Link href={`/fulfilment/orders/${r.orderId}`} className="font-mono text-xs text-primary hover:underline">{r.orderNo}</Link> },
    { key: "dir", header: "Direction", render: (r) => <Pill tone={r.direction === "CLIENT_TO_1BUY" ? "info" : "neutral"}>{r.direction === "CLIENT_TO_1BUY" ? "Client → 1Buy" : "1Buy → Supplier"}</Pill> },
    { key: "party", header: "Party", render: (r) => r.party },
    { key: "mode", header: "Mode", render: (r) => r.mode },
    { key: "amt", header: "Amount", align: "right", render: (r) => money(r.amount, r.currency) },
    { key: "due", header: "Due", align: "right", render: (r) => <span className="text-xs tnum">{r.dueDate ?? "—"}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "act", header: "", align: "right", render: (r) => r.status !== "PAID" ? <Button variant="outline" onClick={() => setStatus(r.orderId, r.id, "PAID")}>Mark paid</Button> : <span className="text-xs text-ok">✓ paid</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description="Two-sided ledger — client→1Buy and 1Buy→supplier (advance / escrow / credit)." />
      <Panel><DataTable columns={cols} rows={rows} empty="No payment tasks yet." /></Panel>
    </div>
  );
}
