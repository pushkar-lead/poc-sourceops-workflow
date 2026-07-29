"use client";

import Link from "next/link";
import { useStore } from "@/store/store";
import { deliveryWork } from "@/store/selectors";
import { Panel, Pill, DataTable, PageHeader, type Col } from "@/components/ui/primitives";
import { qtyfmt } from "@/lib/utils";

export default function DeliveryQueuePage() {
  const orders = useStore((s) => s.orders);
  const rows = deliveryWork(orders);

  const cols: Col<(typeof rows)[number]>[] = [
    { key: "no", header: "Order", render: (r) => <Link href={`/fulfilment/orders/${r.orderId}`} className="font-mono text-xs text-primary hover:underline">{r.orderNo}</Link> },
    { key: "mpn", header: "MPN", render: (r) => <span className="font-mono text-xs">{r.mpn}</span> },
    { key: "recv", header: "Received", align: "right", render: (r) => qtyfmt(r.received) },
    { key: "alloc", header: "Allocated", align: "right", render: (r) => qtyfmt(r.allocated) },
    { key: "rem", header: "To allocate", align: "right", render: (r) => r.remaining > 0 ? <Pill tone="warn">{qtyfmt(r.remaining)}</Pill> : <Pill tone="ok">done</Pill> },
    { key: "act", header: "", align: "right", render: (r) => <Link href={`/fulfilment/orders/${r.orderId}`} className="text-xs font-medium text-primary hover:underline">Allocate →</Link> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Delivery queue" description="Received-but-unallocated quantity across orders — the manual &ldquo;who gets what&rdquo; decision." />
      <Panel><DataTable columns={cols} rows={rows} empty="Nothing received yet — create inbound shipments first." /></Panel>
    </div>
  );
}
