"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useStore } from "@/store/store";
import { demandRemaining } from "@/store/selectors";
import { PageHeader, Panel, Button, DataTable, Pill, type Col } from "@/components/ui/primitives";
import { lookupComponentStock } from "@/integrations/component-intelligence";
import { BUYERS } from "@/data/directory";
import type { DemandLine } from "@/types";

// Same "how much of this demand line is already spoken for" convention used on
// the Client RFQ queue and the New RFQ Bundle "Select Lines" tab.
function bundledPill(remaining: number, qty: number) {
  if (remaining <= 0) return <Pill tone="neutral">Fully bundled</Pill>;
  if (remaining < qty) return <Pill tone="warn">Partial · {remaining} left</Pill>;
  return <Pill tone="ok">Open</Pill>;
}

export default function DemandIntakePage() {
  const store = useStore();
  const demandLines = Object.values(store.demandLines).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ buyerId: "", mpn: "", qty: 100, targetPrice: 10, currency: "USD", requiredByDate: "2026-08-31" });
  const [lookingUp, setLookingUp] = useState(false);
  const [stockResults, setStockResults] = useState<any[]>([]);

  const handleLookupStock = async () => {
    if (!formData.mpn.trim()) return;
    setLookingUp(true);
    try {
      const result = await lookupComponentStock({ mpn: formData.mpn });
      setStockResults(result.results);
    } catch (e) {
      alert("Stock lookup failed: " + (e instanceof Error ? e.message : "Unknown error"));
      setStockResults([]);
    } finally {
      setLookingUp(false);
    }
  };

  const handleCreateDemand = () => {
    if (!formData.buyerId || !formData.mpn.trim() || formData.qty <= 0) {
      alert("Select a buyer, MPN, and Qty required");
      return;
    }
    store.createDemandLine({
      mpn: formData.mpn,
      qty: formData.qty,
      targetPrice: formData.targetPrice,
      currency: formData.currency,
      requiredByDate: formData.requiredByDate,
      source: "manual",
      clientPoId: formData.buyerId,
    });
    setFormData({ buyerId: "", mpn: "", qty: 100, targetPrice: 10, currency: "USD", requiredByDate: "2026-08-31" });
    setShowForm(false);
    setStockResults([]);
  };

  const cols: Col<DemandLine>[] = [
    { key: "buyer", header: "Buyer", render: (d) => {
      const buyer = BUYERS.find(b => b.id === d.clientPoId);
      return <span className="text-sm font-medium">{buyer?.name || d.clientPoId || "Unknown"}</span>;
    }},
    { key: "mpn", header: "MPN", render: (d) => <span className="font-mono text-xs font-semibold text-primary">{d.mpn}</span> },
    { key: "qty", header: "Qty", render: (d) => <span className="text-sm font-medium">{d.qty}</span> },
    { key: "targetPrice", header: "Target $", render: (d) => <span className="text-sm">${d.targetPrice.toFixed(2)}</span> },
    { key: "required", header: "Required by", render: (d) => <span className="text-xs text-muted-foreground">{d.requiredByDate}</span> },
    { key: "source", header: "Source", render: (d) => <span className="text-xs capitalize">{d.source}</span> },
    { key: "bundled", header: "Bundled", render: (d) => bundledPill(demandRemaining(d, store.rfqBundles), d.qty) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demand Intake"
        description="Raw client demand before RFQ bundling. Check distributor stock, then float to suppliers."
        actions={<Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4" /> New Demand</Button>}
      />

      {showForm && (
        <Panel title="Create Demand">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Buyer</label>
              <select
                value={formData.buyerId}
                onChange={(e) => setFormData({ ...formData, buyerId: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">-- Select a buyer --</option>
                {BUYERS.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>{buyer.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="MPN"
                value={formData.mpn}
                onChange={(e) => setFormData({ ...formData, mpn: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Qty"
                value={formData.qty}
                onChange={(e) => setFormData({ ...formData, qty: +e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Target Price"
                value={formData.targetPrice}
                onChange={(e) => setFormData({ ...formData, targetPrice: +e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
                <option>USD</option>
                <option>EUR</option>
                <option>INR</option>
              </select>
              <input
                type="date"
                value={formData.requiredByDate}
                onChange={(e) => setFormData({ ...formData, requiredByDate: e.target.value })}
                className="col-span-2 rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleLookupStock} disabled={lookingUp}>
                <Search className="h-4 w-4" /> {lookingUp ? "Looking up..." : "Look up stock"}
              </Button>
              <Button onClick={handleCreateDemand}>Create Demand</Button>
            </div>

            {stockResults.length > 0 && (
              <div className="rounded-lg border bg-info-bg p-3">
                <div className="text-xs font-medium mb-2">Found {stockResults.length} distributor(s):</div>
                <div className="space-y-1">
                  {stockResults.map((r, i) => (
                    <div key={i} className="text-xs text-info">
                      <span className="font-semibold">{r.vendor}</span> • {r.stockQty} units • ${r.unitPrice.toFixed(2)} • {r.leadTimeDays}d
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}

      <Panel title={`Demand Queue (${demandLines.length})`}>
        {demandLines.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No demands yet. Create one above.</div>
        ) : (
          <DataTable columns={cols} rows={demandLines} />
        )}
      </Panel>
    </div>
  );
}
