"use client";

import Link from "next/link";
import { useStore } from "@/store/store";
import { allShipments } from "@/store/selectors";
import { Panel, Pill, StatusPill, DataTable, type Col } from "@/components/ui/primitives";
import { qtyfmt } from "@/lib/utils";

export default function ShipmentsBoardPage() {
  const orders = useStore((s) => s.orders);
  const rows = allShipments(orders);

  const cols: Col<(typeof rows)[number]>[] = [
    { key: "no", header: "Order", render: (r) => <Link href={`/fulfilment/orders/${r.orderId}`} className="font-mono text-xs text-primary hover:underline">{r.orderNo}</Link> },
    { key: "ship", header: "Shipment", render: (r) => <span className="font-mono text-xs">{r.shipmentNo}</span> },
    { key: "leg", header: "Leg", render: (r) => <Pill tone={r.leg === "INBOUND" ? "info" : "neutral"}>{r.leg}</Pill> },
    { key: "awb", header: "AWB", render: (r) => <span className="text-xs">{r.awb}</span> },
    { key: "carrier", header: "Carrier", render: (r) => r.carrier },
    { key: "qty", header: "Qty", align: "right", render: (r) => qtyfmt(r.lines.reduce((a, l) => a + l.qty, 0)) },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "customs", header: "Customs", render: (r) => !r.needsCustoms ? <span className="text-xs text-faint">n/a</span> : r.hasCustoms ? <Pill tone="ok">cleared</Pill> : <Pill tone="warn">pending</Pill> },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shipments board</h1>
        <p className="text-sm text-muted-foreground">All AWBs across orders, inbound &amp; outbound, with customs status.</p>
      </div>
      <Panel><DataTable columns={cols} rows={rows} empty="No shipments yet — create one from an order's Shipments tab." /></Panel>
    </div>
  );
}
