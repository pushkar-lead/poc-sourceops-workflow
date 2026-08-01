"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/store";
import { demandRemaining } from "@/store/selectors";
import { PageHeader, Button, Panel, FormTabBar, Pill } from "@/components/ui/primitives";
import { SUPPLIERS } from "@/data/directory";
import { cn } from "@/lib/utils";

export default function NewRfqBundlePage() {
  const router = useRouter();
  const store = useStore();
  const demands = Object.values(store.demandLines).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const [tab, setTab] = useState("lines");
  const [selectedDemands, setSelectedDemands] = useState<string[]>([]);
  const [supplierEmails, setSupplierEmails] = useState<string[]>(["export@shanghai-elec.com"]);
  const [deadline, setDeadline] = useState("2026-08-15");
  const [dateToleranceDays, setDateToleranceDays] = useState(7);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");

  const tabs = [
    { id: "lines", label: "Select Lines", invalid: selectedDemands.length === 0 },
    { id: "suppliers", label: "Suppliers", invalid: supplierEmails.length === 0 },
    { id: "terms", label: "Terms" },
    { id: "review", label: "Review" },
  ];

  const handleCreateBundle = async () => {
    if (selectedDemands.length === 0) {
      alert("Select at least one demand line");
      return;
    }
    if (supplierEmails.length === 0) {
      alert("Add at least one supplier");
      return;
    }
    const bundleId = store.createRfqBundle({
      demandLineIds: selectedDemands,
      supplierEmails,
      deadline,
      dateToleranceDays,
    });
    if (bundleId) {
      await store.floatRfqToSuppliers(bundleId);
      router.push(`/fulfilment/rfq-bundles/${bundleId}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create RFQ Bundle" description="Select demands, invite suppliers, set terms, then float to get quotes." />

      <FormTabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === "lines" && (
        <Panel title="Select Demand Lines">
          {demands.length === 0 ? (
            <div className="text-sm text-muted-foreground">No demands yet. Create demands on Demand Intake page.</div>
          ) : (
            <div className="space-y-2">
              {demands.map((d) => {
                const remaining = demandRemaining(d, store.rfqBundles);
                const isFullyBundled = remaining <= 0;
                const isPartial = !isFullyBundled && remaining < d.qty;
                const isChecked = selectedDemands.includes(d.id);
                // Fully-bundled lines can't be freshly re-selected, but if one is already
                // checked (e.g. it got bundled elsewhere while this form was open) don't
                // trap the checkbox in a checked state the user can't clear.
                const disableSelection = isFullyBundled && !isChecked;
                return (
                  <label
                    key={d.id}
                    title={
                      disableSelection
                        ? "Already fully committed to an open RFQ bundle. Remove it from that bundle, or wait for it to close, before selecting again."
                        : undefined
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 transition",
                      disableSelection ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={disableSelection}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDemands([...selectedDemands, d.id]);
                        } else {
                          setSelectedDemands(selectedDemands.filter((id) => id !== d.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{d.mpn}</span>
                        {isFullyBundled && <Pill tone="neutral">Fully bundled</Pill>}
                        {isPartial && <Pill tone="warn">Partially bundled — {remaining} remaining</Pill>}
                      </div>
                      <div className="text-xs text-muted-foreground">{d.qty} units • ${d.targetPrice} • By {d.requiredByDate}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setTab("suppliers")}>Next: Suppliers →</Button>
          </div>
        </Panel>
      )}

      {tab === "suppliers" && (
        <Panel title="Add Suppliers">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Select from directory</label>
              <div className="flex gap-2">
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">-- Select a supplier --</option>
                  {SUPPLIERS.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  onClick={() => {
                    const supplier = SUPPLIERS.find((s) => s.id === selectedSupplierId);
                    if (supplier && supplier.email && !supplierEmails.includes(supplier.email)) {
                      setSupplierEmails([...supplierEmails, supplier.email]);
                      setSelectedSupplierId("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Or add custom email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="custom-supplier@example.com"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (newSupplierEmail.includes("@") && !supplierEmails.includes(newSupplierEmail)) {
                      setSupplierEmails([...supplierEmails, newSupplierEmail]);
                      setNewSupplierEmail("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Selected suppliers ({supplierEmails.length})</label>
              <div className="space-y-2">
                {supplierEmails.map((email, i) => {
                  const supplier = SUPPLIERS.find((s) => s.email === email);
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{supplier?.name || "Custom supplier"}</div>
                        <div className="text-xs text-muted-foreground">{email}</div>
                      </div>
                      {supplierEmails.length > 1 && (
                        <button
                          onClick={() => setSupplierEmails(supplierEmails.filter((_, idx) => idx !== i))}
                          className="px-2 py-1 text-xs text-bad hover:bg-bad-bg rounded"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => setTab("lines")}>← Back</Button>
            <Button onClick={() => setTab("terms")}>Next: Terms →</Button>
          </div>
        </Panel>
      )}

      {tab === "terms" && (
        <Panel title="RFQ Terms">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date Tolerance (days)</label>
              <input
                type="number"
                value={dateToleranceDays}
                onChange={(e) => setDateToleranceDays(+e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => setTab("suppliers")}>← Back</Button>
            <Button onClick={() => setTab("review")}>Next: Review →</Button>
          </div>
        </Panel>
      )}

      {tab === "review" && (
        <Panel title="Review & Create">
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Demand Lines:</span> {selectedDemands.length} selected
            </div>
            <div>
              <span className="font-medium">Suppliers:</span> {supplierEmails.join(", ")}
            </div>
            <div>
              <span className="font-medium">Deadline:</span> {deadline}
            </div>
            <div>
              <span className="font-medium">Date Tolerance:</span> {dateToleranceDays} days
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setTab("terms")}>← Back</Button>
            <Button onClick={handleCreateBundle}>Create & Float to Suppliers</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
