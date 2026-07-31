"use client";

import Link from "next/link";
import { FileText, MailQuestion, AlertTriangle } from "lucide-react";
import { useStore } from "@/store/store";
import { allLots, lotTestProgress, currentReport, unmatchedEmails } from "@/store/selectors";
import { Panel, Pill, StatusPill, PageHeader, Progress } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function TestingPage() {
  const orders = useStore((s) => s.orders);
  const setLotStatus = useStore((s) => s.setLotStatus);
  const rows = allLots(orders);
  const unmatched = Object.values(orders).flatMap((b) => unmatchedEmails(b).map((m) => ({ ...m, orderId: b.id, orderNo: b.orderNo })));

  return (
    <div className="space-y-5">
      <PageHeader title="Testing"
        description="Every lot across orders, with its WHL test progress. A PASS releases the escrow tranche; a FAIL starts the return/refund path. Open an order's Testing tab for the per-test tracker, reports and WHL correspondence." />

      {unmatched.length > 0 && (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-warn"><MailQuestion className="h-4 w-4" /> {unmatched.length} inbound WHL email(s) await manual matching.</span>
            <span className="flex flex-wrap gap-2">
              {Array.from(new Set(unmatched.map((m) => m.orderId))).map((oid) => (
                <Link key={oid} href={`/fulfilment/orders/${oid}`} className="font-mono text-xs text-primary hover:underline">
                  {orders[oid]?.orderNo}
                </Link>
              ))}
            </span>
          </div>
        </Panel>
      )}

      <Panel>
        {rows.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No lots yet.</div> : (
          <div className="space-y-2">
            {rows.map((r) => {
              const p = lotTestProgress(r);
              const rep = currentReport(r);
              const pct = p.total ? Math.round((p.settled / p.total) * 100) : 0;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <Link href={`/fulfilment/orders/${r.orderId}`} className="font-mono text-xs text-primary hover:underline">{r.orderNo}</Link>
                      <span className="text-faint">·</span> <span className="font-mono text-xs">{r.orderLineMpn}</span>
                      <span className="text-faint">·</span> {r.lotCode}
                      {p.far > 0 && <Pill tone="warn"><AlertTriangle className="h-3 w-3" /> {p.far} F.A.R.</Pill>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.lab ?? "—"} · WO {r.workOrderNo ?? "—"} · {p.total ? `${p.settled}/${p.total} tests passed` : "no tests on file"}
                      {rep ? <> · <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{rep.reportNo} ({rep.conclusion.replace(/_/g, " ").toLowerCase()})</span></> : " · report not available"}
                    </div>
                    {p.total > 0 && <div className="mt-1.5 max-w-xs"><Progress value={pct} /></div>}
                  </div>
                  <StatusPill status={r.testStatus} />
                  <div className="flex gap-1">
                    {(["PASS", "MAYBE", "FAIL"] as const).map((st) => (
                      <button key={st} onClick={() => setLotStatus(r.orderId, r.id, st)}
                        className={cn("rounded-md border px-2 py-1 text-xs font-medium hover:border-primary", r.testStatus === st && "border-primary bg-accent-soft text-primary")}>{st}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
