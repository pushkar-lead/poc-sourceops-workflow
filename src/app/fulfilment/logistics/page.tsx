"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Truck, FlaskConical } from "lucide-react";
import { useStore } from "@/store/store";
import { allShipments, currentReport, remainingToShipLeg } from "@/store/selectors";
import { Panel, Pill, StatusPill, Button, DataTable, PageHeader, type Col } from "@/components/ui/primitives";
import { CreateShipmentModal } from "@/components/order/modals";
import { qtyfmt } from "@/lib/utils";

export default function LogisticsBoardPage() {
  return (
    <Suspense fallback={<PageHeader title="Logistics" description="Loading…" />}>
      <LogisticsBoard />
    </Suspense>
  );
}

function LogisticsBoard() {
  const orders = useStore((s) => s.orders);
  const poll = useStore((s) => s.pollShipmentTracking);
  const rows = allShipments(orders);
  const router = useRouter();
  const params = useSearchParams();

  // deep link from the testing screen: ?order=…&lot=… (one lot) or ?order=…&lots=a,b,c (bulk)
  const orderId = params.get("order") ?? "";
  const lotIds = (params.get("lots") ?? params.get("lot") ?? "").split(",").filter(Boolean);
  const order = orders[orderId];
  const lots = (order?.lots ?? []).filter((l) => lotIds.includes(l.id));
  const [modalOpen, setModalOpen] = useState(lots.length > 0);

  const clearLink = () => { setModalOpen(false); router.replace("/fulfilment/logistics"); };

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

  // several lots of the same MPN collapse into one shipment line, capped by what's left to move
  const perMpn = order
    ? Array.from(new Set(lots.map((l) => l.orderLineMpn))).map((mpn) => {
        const want = lots.filter((l) => l.orderLineMpn === mpn).reduce((a, l) => a + l.qty, 0);
        const cap = remainingToShipLeg(order, mpn, "INBOUND");
        return { mpn, want, qty: Math.max(0, Math.min(want, cap)), cap };
      })
    : [];
  const totalToMove = perMpn.reduce((a, r) => a + r.qty, 0);
  const origins = Array.from(new Set(lots.map((l) => l.lab ?? order?.supplier.name ?? "—")));
  const failed = lots.filter((l) => l.testStatus === "FAIL");
  const noReport = lots.filter((l) => (l.reports ?? []).length === 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Logistics" description={<>Every carrier AWB across orders (inbound &amp; outbound). <b className="text-foreground">Refresh tracking</b> polls the carrier (mock) and advances the checkpoint. Inbound AWBs are hidden from the client; outbound from the supplier.</>} />

      {/* arrived here from the testing screen — book the movement without hunting for the order */}
      {lots.length > 0 && order && (
        <Panel title={`Create logistics for ${lots.length === 1 ? "a tested lot" : `${lots.length} tested lots`}`}
          actions={<div className="flex gap-2">
            <Button variant="ghost" onClick={clearLink}>Dismiss</Button>
            <Button onClick={() => setModalOpen(true)} disabled={totalToMove <= 0}>
              <Truck className="h-4 w-4" /> {totalToMove > 0 ? "Create shipment" : "Fully shipped"}
            </Button>
          </div>}>
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-muted-foreground">order <Link href={`/fulfilment/orders/${order.id}`} className="font-mono text-primary hover:underline">{order.orderNo}</Link></span>
            <span className="text-muted-foreground">lots <b className="text-foreground">{lots.length}</b></span>
            <span className="text-muted-foreground">to move <b className="text-foreground tnum">{qtyfmt(totalToMove)}</b> across <b className="text-foreground">{perMpn.length}</b> MPN(s)</span>
            <span className="text-muted-foreground">from <b className="text-foreground">{origins.join(" · ")}</b></span>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-card-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left">Lot</th>
                  <th className="px-3 py-2 text-left">MPN</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-left">Verdict</th>
                  <th className="px-3 py-2 text-left">Report</th>
                  <th className="px-3 py-2 text-left">Currently at</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const r = currentReport(l);
                  return (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">
                        <span className="inline-flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5 text-primary" />{l.lotCode}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{l.orderLineMpn}</td>
                      <td className="px-3 py-2 text-right tnum">{qtyfmt(l.qty)}</td>
                      <td className="px-3 py-2"><StatusPill status={l.testStatus} /></td>
                      <td className="px-3 py-2 text-xs">{r ? <span className="font-mono">{r.reportNo}</span> : <span className="text-warn">none</span>}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{l.lab ?? order.supplier.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Lots of the same MPN are merged into one shipment line: {perMpn.map((r) => `${r.mpn} ×${qtyfmt(r.qty)}${r.want > r.cap ? ` (capped from ${qtyfmt(r.want)} — rest already shipped)` : ""}`).join(" · ") || "—"}.
            Destination is the 1Buy hub for relabelling.
          </p>
          {origins.length > 1 && <p className="mt-1 text-xs text-warn">These lots sit at {origins.length} different locations — one AWB can only collect from one origin. Book them separately, or edit the origin before saving.</p>}
          {failed.length > 0 && <p className="mt-1 text-xs text-bad">{failed.map((l) => l.lotCode).join(", ")} did not pass — book the return leg to the supplier rather than an onward shipment.</p>}
          {noReport.length > 0 && <p className="mt-1 text-xs text-warn">{noReport.map((l) => l.lotCode).join(", ")} have no report yet — moving them now pre-empts the result.</p>}
        </Panel>
      )}

      <Panel><DataTable columns={cols} rows={rows} empty="No shipments yet — book one from an order's Shipments tab." /></Panel>

      {modalOpen && lots.length > 0 && order && (
        <CreateShipmentModal orderId={order.id}
          prefill={{
            lotCodes: lots.map((l) => l.lotCode),
            lines: perMpn.map((r) => ({ mpn: r.mpn, qty: r.qty })),
            from: origins[0], leg: "INBOUND",
          }}
          onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
