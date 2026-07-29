"use client";

import Link from "next/link";
import { useStore } from "@/store/store";
import { allShipments } from "@/store/selectors";
import { Panel, Pill, StatusPill, Button, DataTable, PageHeader, type Col } from "@/components/ui/primitives";
import { qtyfmt } from "@/lib/utils";

export default function LogisticsBoardPage() {
  const orders = useStore((s) => s.orders);
  const poll = useStore((s) => s.pollShipmentTracking);
  const rows = allShipments(orders);

  const cols: Col<(typeof rows)[number]>[] = [
    { key: "no", header: "Order", render: (r) => <Link href={`/fulfilment/orders/${r.orderId}`} className="font-mono text-xs text-primary hover:underline">{r.orderNo}</Link> },
    { key: "leg", header: "Leg", render: (r) => <Pill tone={r.leg === "INBOUND" ? "info" : "neutral"}>{r.leg === "INBOUND" ? "Inbound" : "Outbound"}</Pill> },
    { key: "carrier", header: "Carrier", render: (r) => r.carrier },
    { key: "awb", header: "AWB", render: (r) => r.trackingUrl
      ? <a href={r.trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">{r.awb}</a>
      : <span className="font-mono text-xs text-muted-foreground">{r.awb}</span> },
    { key: "qty", header: "Qty", align: "right", render: (r) => qtyfmt(r.lines.reduce((a, l) => a + l.qty, 0)) },
    { key: "status", header: "Tracking", render: (r) => <StatusPill status={r.status} /> },
    { key: "loc", header: "Location", render: (r) => {
      const loc = r.lastLocation || (r.status === "PLANNED" ? r.fromLocation : "");
      return loc ? <span className="text-xs text-muted-foreground">{loc}</span> : <span className="text-xs text-faint">—</span>;
    } },
    { key: "customs", header: "Customs", render: (r) => !r.needsCustoms ? <span className="text-xs text-faint">n/a</span> : r.hasCustoms ? <Pill tone="ok">cleared</Pill> : <Pill tone="warn">pending</Pill> },
    { key: "act", header: "", align: "right", render: (r) => {
      const terminal = r.status === "DELIVERED" || r.status === "CANCELLED";
      const booked = r.awb !== "booking…" && r.awb !== "booking failed";
      return <Button variant="outline" onClick={() => booked && poll(r.orderId, r.id)} disabled={terminal || !booked} title={!booked ? "AWB not booked" : terminal ? "Terminal status" : "Poll carrier"}>Refresh tracking</Button>;
    } },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Logistics" description={<>Every carrier AWB across orders (inbound &amp; outbound). <b className="text-foreground">Refresh tracking</b> polls the carrier (mock) and advances the checkpoint. Inbound AWBs are hidden from the client; outbound from the supplier.</>} />
      <Panel><DataTable columns={cols} rows={rows} empty="No shipments yet — book one from an order's Shipments tab." /></Panel>
    </div>
  );
}
