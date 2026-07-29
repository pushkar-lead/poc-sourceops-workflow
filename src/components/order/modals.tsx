"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Labeled, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { useStore } from "@/store/store";
import { remainingToShipLeg, remainingToAllocate, sourcedForClientLine, orderSourcedForClient, deliveredForClientLine } from "@/store/selectors";
import { computeDuty } from "@/lib/fx";
import { money, fmtAddress } from "@/lib/utils";
import type {
  PaymentDirection, PaymentMode, ShipmentLeg, JourneyPhase, TradeType, TestingMode,
} from "@/types";

const PHASES: JourneyPhase[] = ["KICKOFF", "PAYMENT", "TESTING", "EXPORT", "IMPORT", "CUSTOMS", "RELABEL", "DELIVERY", "CLOSE"];
const OWNERS = ["SC", "Supplier", "Lab", "CHA", "Finance", "Approver"];

function Footer({ onClose, onSave, saveLabel = "Save", disabled }: { onClose: () => void; onSave: () => void; saveLabel?: string; disabled?: boolean }) {
  return (<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onSave} disabled={disabled}>{saveLabel}</Button></>);
}

export function AddStepModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const addStep = useStore((s) => s.addStep);
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<string>("DELIVERY");
  const [owner, setOwner] = useState("SC");
  const [gate, setGate] = useState(false);
  const save = () => { if (!name.trim()) return; addStep(orderId, { name, phase, owner, isGate: gate }); onClose(); };
  return (
    <Dialog open onClose={onClose} title="Add journey step" footer={<Footer onClose={onClose} onSave={save} saveLabel="Add step" disabled={!name.trim()} />}>
      <div className="space-y-3">
        <Labeled label="Step name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Re-inspect at hub" /></Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Phase"><Select value={phase} onChange={(e) => setPhase(e.target.value)}>{PHASES.map((p) => <option key={p}>{p}</option>)}</Select></Labeled>
          <Labeled label="Owner"><Select value={owner} onChange={(e) => setOwner(e.target.value)}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</Select></Labeled>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={gate} onChange={(e) => setGate(e.target.checked)} /> This step is a gate (blocks progress)</label>
      </div>
    </Dialog>
  );
}

export function AddLotModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const b = useStore((s) => s.orders[orderId]);
  const addLot = useStore((s) => s.addLot);
  const [mpn, setMpn] = useState(b?.lines[0]?.mpn ?? "");
  const [lotCode, setLotCode] = useState("");
  const [dateCode, setDateCode] = useState("");
  const [qty, setQty] = useState(0);
  const [sampleQty, setSampleQty] = useState(0);
  if (!b) return null;
  const save = () => { if (!mpn || !lotCode.trim()) return; addLot(orderId, { orderLineMpn: mpn, lotCode, dateCode, qty, sampleQty, lab: "WHL Shenzhen" }); onClose(); };
  return (
    <Dialog open onClose={onClose} title="Add test lot" footer={<Footer onClose={onClose} onSave={save} saveLabel="Add lot" disabled={!lotCode.trim()} />}>
      <div className="space-y-3">
        <Labeled label="MPN"><Select value={mpn} onChange={(e) => setMpn(e.target.value)}>{b.lines.map((l) => <option key={l.id} value={l.mpn}>{l.mpn}</option>)}</Select></Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Lot code"><Input value={lotCode} onChange={(e) => setLotCode(e.target.value)} placeholder="LOT-C" /></Labeled>
          <Labeled label="Date code"><Input value={dateCode} onChange={(e) => setDateCode(e.target.value)} placeholder="2410" /></Labeled>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Lot qty"><Input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} /></Labeled>
          <Labeled label="Sample qty"><Input type="number" value={sampleQty} onChange={(e) => setSampleQty(+e.target.value)} /></Labeled>
        </div>
      </div>
    </Dialog>
  );
}

export function EscrowAmountModal({ orderId, mode, onClose }: { orderId: string; mode: "fund" | "release" | "refund"; onClose: () => void }) {
  const b = useStore((s) => s.orders[orderId]);
  const fundEscrow = useStore((s) => s.fundEscrow);
  const releaseEscrow = useStore((s) => s.releaseEscrow);
  const refundEscrow = useStore((s) => s.refundEscrow);
  const [amount, setAmount] = useState(mode === "fund" ? (b?.buyTotal ?? 0) : 0);
  const [charges, setCharges] = useState(b?.escrow?.chargesAmount ?? Math.round((b?.buyTotal ?? 0) * 0.02));
  const [banking, setBanking] = useState(b?.escrow?.bankingCharges ?? Math.round((b?.buyTotal ?? 0) * 0.005));
  if (!b) return null;
  const title = mode === "fund" ? "Fund escrow (super-invoice)" : mode === "release" ? "Release escrow tranche" : "Refund escrow";
  const save = () => {
    if (mode === "fund") fundEscrow(orderId, { provider: "HKIN", material: amount, charges, bankingCharges: banking });
    else if (mode === "release") releaseEscrow(orderId, amount, b.escrow?.releaseTrigger ?? "Manual release (lab PASS)");
    else refundEscrow(orderId, amount, "Refund on FAIL");
    onClose();
  };
  const siPreview = amount + charges + banking + 450;
  return (
    <Dialog open onClose={onClose} title={title} footer={<Footer onClose={onClose} onSave={save} saveLabel={title.split(" ")[0]} disabled={amount <= 0} />}>
      <div className="space-y-3">
        <Labeled label={mode === "fund" ? "Material amount (A1)" : "Amount"}><Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} /></Labeled>
        {mode === "fund" && <>
          <Labeled label="Escrow charges (A2)"><Input type="number" value={charges} onChange={(e) => setCharges(+e.target.value)} /></Labeled>
          <Labeled label="Banking charges (wire / FX)"><Input type="number" value={banking} onChange={(e) => setBanking(+e.target.value)} /></Labeled>
          <p className="text-xs text-muted-foreground">{b.currency} · super-invoice = A1 + A2 + banking + fees ≈ <b className="text-foreground tnum">{money(siPreview, b.currency)}</b>. Only A1 is releasable to the supplier.</p>
        </>}
        {mode === "release" && b.escrow && <p className="text-xs text-muted-foreground">Release trigger: <b className="text-foreground">{b.escrow.releaseTrigger}</b>{b.termsConditions?.length ? " — fulfilled per the agreed T&Cs." : "."}</p>}
        {mode === "refund" && <p className="text-xs text-muted-foreground">{b.currency} · refunds return held funds to the buyer.</p>}
      </div>
    </Dialog>
  );
}

export function ExtendEscrowModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const b = useStore((s) => s.orders[orderId]);
  const requestEscrowExtension = useStore((s) => s.requestEscrowExtension);
  const [reason, setReason] = useState("Lab TAT longer than planned; need more time before release.");
  const [newDate, setNewDate] = useState(b?.escrow?.expiryDate ?? "");
  if (!b || !b.escrow) return null;
  const save = () => { if (!newDate.trim() || !reason.trim()) return; requestEscrowExtension(orderId, { reason, newDate }); onClose(); };
  return (
    <Dialog open onClose={onClose} title="Request escrow-window extension" footer={<Footer onClose={onClose} onSave={save} saveLabel="Email request" disabled={!newDate.trim() || !reason.trim()} />}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Current expiry: <b className="text-foreground">{b.escrow.expiryDate ?? "—"}</b>. We email the counterparty; the reply (approve / decline) is recorded on the escrow.</p>
        <Labeled label="New expiry date"><Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></Labeled>
        <Labeled label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the window needs extending…" /></Labeled>
      </div>
    </Dialog>
  );
}

export function AddPaymentModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const b = useStore((s) => s.orders[orderId]);
  const addPayment = useStore((s) => s.addPayment);
  const [direction, setDirection] = useState<PaymentDirection>("1BUY_TO_SUPPLIER");
  const [mode, setMode] = useState<PaymentMode>(b?.paymentMode ?? "ADVANCE");
  const [amount, setAmount] = useState(b?.buyTotal ?? 0);
  const [triggerDoc, setTriggerDoc] = useState("Supplier PI");
  if (!b) return null;
  const save = () => { if (amount <= 0) return; addPayment(orderId, { direction, mode, amount, triggerDoc }); onClose(); };
  return (
    <Dialog open onClose={onClose} title="New payment task" footer={<Footer onClose={onClose} onSave={save} saveLabel="Create" disabled={amount <= 0} />}>
      <div className="space-y-3">
        <Labeled label="Direction"><Select value={direction} onChange={(e) => setDirection(e.target.value as PaymentDirection)}>
          <option value="CLIENT_TO_1BUY">Client → 1Buy</option><option value="1BUY_TO_SUPPLIER">1Buy → Supplier</option></Select></Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Mode"><Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}><option>ADVANCE</option><option>ESCROW</option><option>CREDIT</option></Select></Labeled>
          <Labeled label="Amount"><Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} /></Labeled>
        </div>
        <Labeled label="Trigger document"><Input value={triggerDoc} onChange={(e) => setTriggerDoc(e.target.value)} /></Labeled>
      </div>
    </Dialog>
  );
}

export function CreateShipmentModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const b = useStore((s) => s.orders[orderId]);
  const createShipment = useStore((s) => s.createShipment);
  const [leg, setLeg] = useState<ShipmentLeg>("INBOUND");
  const [carrier, setCarrier] = useState<string>("DHL");
  const [from, setFrom] = useState(b?.supplier.name ?? "");
  const [to, setTo] = useState(fmtAddress(b?.hubAddress) || "1Buy hub");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  if (!b) return null;
  const lineRows = b.lines.map((l) => ({ mpn: l.mpn, remaining: remainingToShipLeg(b, l.mpn, leg) }));
  const anyQty = Object.values(qtys).some((q) => q > 0);
  const save = () => {
    const lines = Object.entries(qtys).map(([mpn, qty]) => ({ mpn, qty })).filter((l) => l.qty > 0);
    const id = createShipment(orderId, { leg, carrier, fromLocation: from || "—", toLocation: to || "—", boxCount: 1, grossWeightKg: 0, lines });
    if (id) onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Create shipment (AWB)" footer={<Footer onClose={onClose} onSave={save} saveLabel="Create shipment" disabled={!anyQty} />}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Leg"><Select value={leg} onChange={(e) => {
            const lg = e.target.value as ShipmentLeg; setLeg(lg);
            if (lg === "INBOUND") { setFrom(b.supplier.name); setTo(fmtAddress(b.hubAddress) || "1Buy hub"); }
            else { setFrom(fmtAddress(b.hubAddress) || "1Buy hub"); setTo(fmtAddress(b.buyerAddress) || b.buyer.name); }
          }}><option value="INBOUND">INBOUND (supplier → us)</option><option value="OUTBOUND">OUTBOUND (us → client)</option></Select></Labeled>
          <Labeled label="Carrier" hint="AWB assigned on booking"><Select value={carrier} onChange={(e) => setCarrier(e.target.value)}><option>DHL</option><option>FEDEX</option><option>DELHIVERY</option></Select></Labeled>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="From"><Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="origin" /></Labeled>
          <Labeled label="To"><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="1Buy hub / client" /></Labeled>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lines (qty ≤ remaining)</div>
          <div className="space-y-1.5">
            {lineRows.map((r) => (
              <div key={r.mpn} className="flex items-center gap-2">
                <span className="flex-1 font-mono text-xs">{r.mpn}</span>
                <span className="text-xs text-faint">rem {r.remaining}</span>
                <Input type="number" className="w-24" value={qtys[r.mpn] ?? 0} max={r.remaining}
                  onChange={(e) => setQtys((p) => ({ ...p, [r.mpn]: Math.min(+e.target.value, r.remaining) }))} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export function FileBOEModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const b = useStore((s) => s.orders[orderId]);
  const fileBOE = useStore((s) => s.fileBOE);
  const inbound = (b?.shipments ?? []).filter((s) => s.leg === "INBOUND");
  const [shipmentNo, setShipmentNo] = useState(inbound[0]?.shipmentNo ?? "");
  const [portCode, setPortCode] = useState("INDEL4");
  const [chaName, setChaName] = useState("Speedwing CHA");
  const [assessable, setAssessable] = useState(0);
  if (!b) return null;
  const duty = computeDuty(assessable);
  const save = () => { if (!shipmentNo) return; fileBOE(orderId, { shipmentNo, portCode, chaName, assessableValue: assessable }); onClose(); };
  return (
    <Dialog open onClose={onClose} title="File Bill of Entry (ICEGATE)" footer={<Footer onClose={onClose} onSave={save} saveLabel="File via ICEGATE" disabled={!shipmentNo} />}>
      <div className="space-y-3">
        <Labeled label="Shipment">
          <Select value={shipmentNo} onChange={(e) => setShipmentNo(e.target.value)}>
            {inbound.length === 0 && <option value="">— create an inbound shipment first —</option>}
            {inbound.map((s) => <option key={s.id} value={s.shipmentNo}>{s.shipmentNo} · {s.awb}</option>)}
          </Select>
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Port code"><Input value={portCode} onChange={(e) => setPortCode(e.target.value)} /></Labeled>
          <Labeled label="CHA"><Input value={chaName} onChange={(e) => setChaName(e.target.value)} /></Labeled>
        </div>
        <Labeled label="Assessable value (INR)" hint={`est. duty ≈ ${money(duty, "INR")} — ICEGATE assesses & issues the BE + ref`}><Input type="number" value={assessable} onChange={(e) => setAssessable(+e.target.value)} /></Labeled>
      </div>
    </Dialog>
  );
}

export function AllocateDeliveryModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const b = useStore((s) => s.orders[orderId]);
  const clientPos = useStore((s) => s.clientPos);
  const allocateDelivery = useStore((s) => s.allocateDelivery);
  const mpns = Array.from(new Set((b?.shipments ?? []).flatMap((s) => s.lines).map((l) => l.mpn)))
    .filter((m) => b && remainingToAllocate(b, m) > 0);
  // Owed cap for an (mpn, client-PO) pair — used to prefill qty on open and on change (no effect → respects lint rule).
  function capForSel(m: string, po?: string) {
    if (!b || !m) return 0;
    const opts = Array.from(new Set(b.sourcingAllocations.filter((a) => a.clientLineMpn === m).map((a) => a.clientPoNo)));
    const usePo = po && opts.includes(po) ? po : (opts[0] ?? "");
    const phys = remainingToAllocate(b, m);
    const ow = usePo ? orderSourcedForClient(b, usePo, m) - deliveredForClientLine(b, usePo, m) : 0;
    return Math.max(0, Math.min(phys, ow));
  }
  const [mpn, setMpn] = useState(mpns[0] ?? "");
  const [clientPoNo, setClientPoNo] = useState("");
  const [qty, setQty] = useState(() => capForSel(mpns[0] ?? ""));
  const [err, setErr] = useState("");
  if (!b) return null;
  // you can only deliver to a client line THIS order actually sourced for the received MPN
  const clientOptions = mpn ? Array.from(new Set(b.sourcingAllocations.filter((a) => a.clientLineMpn === mpn).map((a) => a.clientPoNo))) : [];
  const effectivePo = clientOptions.includes(clientPoNo) ? clientPoNo : (clientOptions[0] ?? "");
  const nameFor = (poNo: string) => clientPos.find((c) => c.clientPoNo === poNo)?.client.name ?? poNo;
  const physical = mpn ? remainingToAllocate(b, mpn) : 0;
  const owed = effectivePo ? orderSourcedForClient(b, effectivePo, mpn) - deliveredForClientLine(b, effectivePo, mpn) : 0;
  const cap = Math.max(0, Math.min(physical, owed));
  const shipNo = (b.shipments.find((s) => s.lines.some((l) => l.mpn === mpn))?.shipmentNo) ?? "—";
  const save = () => {
    const ok = allocateDelivery(orderId, { fromShipmentNo: shipNo, clientPoNo: effectivePo, clientLineMpn: mpn, qty });
    if (!ok) { setErr(`Qty must be 1–${cap} (received & owed to this client).`); return; }
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Allocate to client (who gets what)"
      footer={<Footer onClose={onClose} onSave={save} saveLabel="Allocate" disabled={!mpn || !effectivePo || qty <= 0 || qty > cap} />}>
      {mpns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing received to allocate yet — create an inbound shipment first.</p>
      ) : (
        <div className="space-y-3">
          <Labeled label="MPN" hint={`received & unallocated: ${physical}`}><Select value={mpn} onChange={(e) => { const nm = e.target.value; setMpn(nm); setClientPoNo(""); setQty(capForSel(nm)); setErr(""); }}>{mpns.map((m) => <option key={m}>{m}</option>)}</Select></Labeled>
          {clientOptions.length === 0 ? (
            <p className="text-xs text-warn">This order hasn&apos;t sourced <span className="font-mono">{mpn}</span> for any client yet — map it on the Allocations tab first.</p>
          ) : (
            <>
              <Labeled label="Client PO (sourced by this order)"><Select value={effectivePo} onChange={(e) => { const po = e.target.value; setClientPoNo(po); setQty(capForSel(mpn, po)); setErr(""); }}>{clientOptions.map((po) => <option key={po} value={po}>{po} · {nameFor(po)}</option>)}</Select></Labeled>
              <Labeled label="Qty" hint={`owed to this client: ${cap} (prefilled)`}><Input type="number" value={qty} max={cap} onChange={(e) => { setQty(+e.target.value); setErr(""); }} /></Labeled>
            </>
          )}
          {err && <p className="text-xs text-bad">{err}</p>}
        </div>
      )}
    </Dialog>
  );
}

export function AddEventModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const addEvent = useStore((s) => s.addEvent);
  const [eventType, setEventType] = useState("LEAD_TIME_UPDATE");
  const [message, setMessage] = useState("");
  const save = () => { if (!message.trim()) return; addEvent(orderId, { eventType, message }); onClose(); };
  return (
    <Dialog open onClose={onClose} title="Log an event" footer={<Footer onClose={onClose} onSave={save} saveLabel="Log event" disabled={!message.trim()} />}>
      <div className="space-y-3">
        <Labeled label="Type"><Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
          {["LEAD_TIME_UPDATE", "DELAY", "PARTIAL_READY", "SUPPLIER_NOTE", "GENERAL"].map((t) => <option key={t}>{t}</option>)}</Select></Labeled>
        <Labeled label="Message"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Supplier: 1 week to dispatch remaining." /></Labeled>
      </div>
    </Dialog>
  );
}

export function UploadDocModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const addDocument = useStore((s) => s.addDocument);
  const [docType, setDocType] = useState("PO");
  const [fileName, setFileName] = useState("");
  const save = () => { if (!fileName.trim()) return; addDocument(orderId, { subjectType: "ORDER", docType, fileName }); onClose(); };
  return (
    <Dialog open onClose={onClose} title="Attach document (demo)" footer={<Footer onClose={onClose} onSave={save} saveLabel="Attach" disabled={!fileName.trim()} />}>
      <div className="space-y-3">
        <Labeled label="Type"><Select value={docType} onChange={(e) => setDocType(e.target.value)}>
          {["PO", "PI", "CI", "TAX_INVOICE", "WHL_REPORT", "BOE", "PACKING_LIST", "POD", "ESCROW_INVOICE"].map((t) => <option key={t}>{t}</option>)}</Select></Labeled>
        <Labeled label="File name" hint="no real upload in the POC"><Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="document.pdf" /></Labeled>
      </div>
    </Dialog>
  );
}

export function UploadPIModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const b = useStore((s) => s.orders[orderId]);
  const attachPI = useStore((s) => s.attachPI);
  const [piNo, setPiNo] = useState(b?.piNo ?? "");
  const [fileName, setFileName] = useState("");
  if (!b) return null;
  const canSave = !!piNo.trim() || !!fileName.trim();
  const save = () => { if (!canSave) return; attachPI(orderId, { piNo: piNo.trim(), fileName: fileName.trim() }); onClose(); };
  return (
    <Dialog open onClose={onClose} title="Upload supplier PI" footer={<Footer onClose={onClose} onSave={save} saveLabel="Attach PI" disabled={!canSave} />}>
      <div className="space-y-3">
        <div className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">The PI is confirmed with the supplier on the sourcing platform — attach the accepted PI to this order for the fulfilment record.</div>
        <Labeled label="PI number"><Input value={piNo} onChange={(e) => setPiNo(e.target.value)} placeholder="PI-2026-0112" /></Labeled>
        <Labeled label="File name" hint="no real upload in the POC"><Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="supplier-pi.pdf" /></Labeled>
      </div>
    </Dialog>
  );
}

export function AddAllocationModal({
  orderId, orderLineId, orderLineMpn, unmapped, onClose,
}: { orderId: string; orderLineId: string; orderLineMpn: string; unmapped: number; onClose: () => void }) {
  const clientPos = useStore((s) => s.clientPos);
  const orders = useStore((s) => s.orders);
  const supplierPos = useStore((s) => s.supplierPos);
  const addSourcingAllocation = useStore((s) => s.addSourcingAllocation);
  const [clientPoNo, setClientPoNo] = useState(clientPos[0]?.clientPoNo ?? "");
  const [clientLineMpn, setClientLineMpn] = useState("");
  const [qty, setQty] = useState(0);
  const [marginPct, setMarginPct] = useState(12);
  // only same-MPN client lines can be mapped (you can't fulfil demand for part X with part Y)
  const clientLines = (clientPos.find((c) => c.clientPoNo === clientPoNo)?.lines ?? []).filter((l) => l.mpn === orderLineMpn);
  const clientRemaining = (() => {
    const demand = clientPos.find((c) => c.clientPoNo === clientPoNo)?.lines.find((l) => l.mpn === clientLineMpn)?.qty ?? 0;
    return demand - sourcedForClientLine(supplierPos, orders, clientPoNo, clientLineMpn);
  })();
  const cap = Math.max(0, Math.min(unmapped, clientRemaining));
  const save = () => {
    if (!clientPoNo || !clientLineMpn || qty <= 0) return;
    if (addSourcingAllocation(orderId, { orderLineId, orderLineMpn, clientPoNo, clientLineMpn, qty, marginPct })) onClose();
  };
  return (
    <Dialog open onClose={onClose} title={`Map ${orderLineMpn} → client PO`}
      footer={<Footer onClose={onClose} onSave={save} saveLabel="Map" disabled={!clientLineMpn || qty <= 0} />}>
      <div className="space-y-3">
        <div className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">Order line <b className="font-mono text-foreground">{orderLineMpn}</b> · unmapped <b className="text-foreground">{unmapped}</b></div>
        <Labeled label="Client PO (demand served)"><Select value={clientPoNo} onChange={(e) => { setClientPoNo(e.target.value); setClientLineMpn(""); }}>{clientPos.map((c) => <option key={c.id} value={c.clientPoNo}>{c.clientPoNo} · {c.client.name}</option>)}</Select></Labeled>
        <Labeled label="Client PO line"><Select value={clientLineMpn} onChange={(e) => setClientLineMpn(e.target.value)}><option value="">— select —</option>{clientLines.map((l) => <option key={l.mpn} value={l.mpn}>{l.mpn} (need {l.qty})</option>)}</Select></Labeled>
        {clientLines.length === 0 && <p className="text-xs text-warn">No <span className="font-mono">{orderLineMpn}</span> demand on this client PO — pick a PO that ordered this part.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Qty" hint={`max ${cap}`}><Input type="number" value={qty} max={cap} onChange={(e) => setQty(+e.target.value)} /></Labeled>
          <Labeled label="Margin %"><Input type="number" value={marginPct} onChange={(e) => setMarginPct(+e.target.value)} /></Labeled>
        </div>
      </div>
    </Dialog>
  );
}

export function SourceOrderModal({
  clientPoNo, buyerName, clientLineMpn, unitPrice, remaining, onClose,
}: { clientPoNo: string; buyerName: string; clientLineMpn: string; unitPrice: number; remaining: number; onClose: () => void }) {
  const router = useRouter();
  const createSupplierPo = useStore((s) => s.createSupplierPo);
  const [supplier, setSupplier] = useState("");
  const [qty, setQty] = useState(remaining);
  const [price, setPrice] = useState(0); // buy price — operator enters what the supplier charges (NOT the client's sell price)
  const [trade, setTrade] = useState<TradeType>("INTERNATIONAL");
  const [payment, setPayment] = useState<PaymentMode>("ESCROW");
  const [testing, setTesting] = useState<TestingMode>("WHL");
  const [margin, setMargin] = useState(12);
  const save = () => {
    if (!supplier.trim() || qty <= 0) return;
    const id = createSupplierPo({
      supplier, tradeType: trade, incoterm: trade === "INTERNATIONAL" ? "FOB" : "EXW", currency: "USD",
      sellerPaymentMode: payment, lead: 21, testDays: 6, delivery: 9, testing,
      lines: [{ mpn: clientLineMpn, clientPoNo, clientLineMpn, qty, buyUnitPrice: price, marginPct: margin }],
    });
    if (id) { onClose(); router.push("/fulfilment/supplier-pos"); }
  };
  return (
    <Dialog open onClose={onClose} title={`Source ${clientLineMpn} for ${clientPoNo}`}
      footer={<Footer onClose={onClose} onSave={save} saveLabel="Create supplier PO" disabled={!supplier.trim() || qty <= 0} />}>
      <div className="space-y-3">
        <div className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">Buyer <b className="text-foreground">{buyerName}</b> · line <b className="font-mono text-foreground">{clientLineMpn}</b></div>
        <Labeled label="Supplier"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Shenzhen Micro Co" /></Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Qty" hint={`remaining to source: ${remaining}`}><Input type="number" value={qty} max={remaining} onChange={(e) => setQty(+e.target.value)} /></Labeled>
          <Labeled label="Unit price (buy)" hint={`client sells @ ${money(unitPrice)}`}><Input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} placeholder="supplier's price" /></Labeled>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Trade type"><Select value={trade} onChange={(e) => setTrade(e.target.value as TradeType)}><option value="INTERNATIONAL">INTERNATIONAL</option><option value="DOMESTIC">DOMESTIC</option></Select></Labeled>
          <Labeled label="Payment"><Select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMode)}><option>ADVANCE</option><option>ESCROW</option><option>CREDIT</option></Select></Labeled>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Testing"><Select value={testing} onChange={(e) => setTesting(e.target.value as TestingMode)}><option>NONE</option><option>SUPPLIER_SELF</option><option>WHL</option></Select></Labeled>
          <Labeled label="Margin %"><Input type="number" value={margin} onChange={(e) => setMargin(+e.target.value)} /></Labeled>
        </div>
        <p className="text-xs text-muted-foreground">Creates a <b className="text-foreground">Supplier PO</b> pre-linked to {clientPoNo} · {clientLineMpn}. Create its fulfilment order from the Supplier POs list. Split across suppliers by sourcing again for the rest.</p>
      </div>
    </Dialog>
  );
}
