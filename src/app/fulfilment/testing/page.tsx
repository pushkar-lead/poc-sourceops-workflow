"use client";

import Link from "next/link";
import { useStore } from "@/store/store";
import { allLots } from "@/store/selectors";
import { Panel, StatusPill, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function TestingPage() {
  const orders = useStore((s) => s.orders);
  const setLotStatus = useStore((s) => s.setLotStatus);
  const rows = allLots(orders);

  return (
    <div className="space-y-5">
      <PageHeader title="Testing" description="Lots awaiting a result. A PASS releases the escrow tranche; a FAIL starts the return/refund path." />
      <Panel>
        {rows.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No lots yet.</div> : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Link href={`/fulfilment/orders/${r.orderId}`} className="font-mono text-xs text-primary hover:underline">{r.orderNo}</Link>
                    <span className="text-faint">·</span> <span className="font-mono text-xs">{r.orderLineMpn}</span>
                    <span className="text-faint">·</span> {r.lotCode}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.lab ?? "—"}</div>
                </div>
                <StatusPill status={r.testStatus} />
                <div className="flex gap-1">
                  {(["PASS", "MAYBE", "FAIL"] as const).map((st) => (
                    <button key={st} onClick={() => setLotStatus(r.orderId, r.id, st)}
                      className={cn("rounded-md border px-2 py-1 text-xs font-medium hover:border-primary", r.testStatus === st && "border-primary bg-accent-soft text-primary")}>{st}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
