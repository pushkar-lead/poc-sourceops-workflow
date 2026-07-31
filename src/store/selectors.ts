import type { OrderBundle, JourneyStep, ClientPO, SupplierPO, Lot, LotTest, WhlReport } from "@/types";
import { toUSD } from "@/lib/fx";
import { WHL_SLA_BUSINESS_DAYS } from "@/data/enums";

export type OrdersMap = Record<string, OrderBundle>;

// ---- per-order allocation math (the N:N guards) ----
export const lineQty = (b: OrderBundle, mpn: string) =>
  b.lines.filter((l) => l.mpn === mpn).reduce((a, l) => a + l.quantity, 0);

// leg-aware: INBOUND (supplier→us) vs OUTBOUND (us→client) are separate pools
export const shippedForLeg = (b: OrderBundle, mpn: string, leg: "INBOUND" | "OUTBOUND") =>
  b.shipments.filter((s) => s.leg === leg).flatMap((s) => s.lines)
    .filter((l) => l.mpn === mpn).reduce((a, l) => a + l.qty, 0);

export const receivedForMpn = (b: OrderBundle, mpn: string) => shippedForLeg(b, mpn, "INBOUND");

export const allocatedForMpn = (b: OrderBundle, mpn: string) =>
  b.deliveries.filter((d) => d.clientLineMpn === mpn).reduce((a, d) => a + d.qty, 0);

// how much of an order line still needs to move on a given leg:
//   INBOUND  = ordered qty − already inbound-shipped
//   OUTBOUND = received (inbound) − already outbound-shipped
export const remainingToShipLeg = (b: OrderBundle, mpn: string, leg: "INBOUND" | "OUTBOUND") =>
  leg === "INBOUND" ? lineQty(b, mpn) - shippedForLeg(b, mpn, "INBOUND")
                    : receivedForMpn(b, mpn) - shippedForLeg(b, mpn, "OUTBOUND");
export const remainingToShip = (b: OrderBundle, mpn: string) => remainingToShipLeg(b, mpn, "INBOUND");
export const remainingToAllocate = (b: OrderBundle, mpn: string) => receivedForMpn(b, mpn) - allocatedForMpn(b, mpn);

// delivery caps tied to what THIS order actually sourced for a client line (segregation guard)
export const orderSourcedForClient = (b: OrderBundle, clientPoNo: string, clientLineMpn: string) =>
  b.sourcingAllocations.filter((a) => a.clientPoNo === clientPoNo && a.clientLineMpn === clientLineMpn).reduce((s, a) => s + a.qty, 0);
export const deliveredForClientLine = (b: OrderBundle, clientPoNo: string, clientLineMpn: string) =>
  b.deliveries.filter((d) => d.clientPoNo === clientPoNo && d.clientLineMpn === clientLineMpn).reduce((s, d) => s + d.qty, 0);

export const escrowReleased = (b: OrderBundle) =>
  (b.escrow?.events ?? []).filter((e) => e.type === "RELEASE").reduce((a, e) => a + e.amount, 0);
export const escrowRefunded = (b: OrderBundle) =>
  (b.escrow?.events ?? []).filter((e) => e.type === "REFUND").reduce((a, e) => a + e.amount, 0);
// Releasable/refundable cap: A1 minus whatever already left the account (released to seller OR refunded to buyer).
// Netting refunds here closes the refund→release and repeat-refund double-spend.
export const escrowRemaining = (b: OrderBundle) =>
  Math.max(0, (b.escrow?.materialAmount ?? 0) - escrowReleased(b) - escrowRefunded(b));

export const journeyPct = (b: OrderBundle) =>
  b.journey.length ? Math.round((b.journey.filter((s) => s.status === "DONE").length / b.journey.length) * 100) : 0;

// A19: WHL lab is abroad → an India-origin part 1Buy tests still crosses customs (both legs)
export const customsApplies = (b: OrderBundle) =>
  b.tradeType === "INTERNATIONAL" || b.lines.some((l) => l.testingMode === "WHL");

/** Why the current gate can't be passed yet (null = ok to advance). */
export function gateReason(b: OrderBundle, step: JourneyStep): string | null {
  if (!step.isGate) return null;
  const n = step.name.toLowerCase();
  if (n.includes("approved")) {
    const a = b.approvals.find((x) => x.kind === "PO_REVIEW");
    return a && a.status === "APPROVED" ? null : "PO review not approved yet.";
  }
  if (n.includes("release escrow")) {
    return escrowReleased(b) > 0 ? null : "No escrow released yet (record a lab PASS, then release the tranche).";
  }
  if (n.includes("collect")) { // collect-before-pay for non-escrow orders
    return b.payments.some((p) => p.direction === "CLIENT_TO_1BUY" && (p.status === "INITIATED" || p.status === "PAID"))
      ? null : "No client collection recorded yet — secure buyer funds before paying the supplier.";
  }
  if (step.phase === "PAYMENT") {
    if (b.escrow) return ["FUNDED", "PARTIALLY_RELEASED", "RELEASED"].includes(b.escrow.status) ? null : "Escrow not funded yet.";
    return b.payments.some((p) => p.direction === "1BUY_TO_SUPPLIER" && (p.status === "INITIATED" || p.status === "PAID")) ? null : "Supplier payment not initiated yet.";
  }
  if (step.phase === "TESTING") {
    const need = b.lines.filter((l) => l.testingMode !== "NONE");
    if (need.length === 0) return null; // nothing on this order needs testing
    return need.every((l) => b.lots.some((lot) => lot.orderLineMpn === l.mpn && lot.testStatus === "PASS"))
      ? null : "Every line that needs testing must have a PASS lot (see the Testing tab).";
  }
  if (step.phase === "IMPORT") return b.shipments.some((s) => s.leg === "INBOUND") ? null : "No inbound shipment yet — create one on the Shipments tab.";
  if (step.phase === "CUSTOMS") return b.customs.some((c) => !!c.icegateRef) ? null : "BOE not filed in ICEGATE yet.";
  if (step.phase === "DELIVERY" && n.includes("dispatch")) { // can't dispatch to client until every line is mapped to demand
    return b.lines.every((l) => unmappedForOrderLine(b, l) === 0) ? null : "Not all order lines are mapped to a client PO yet (Allocations tab).";
  }
  return null; // manual gate (e.g. Supplier ACK + PI)
}

// ---- WHL testing: per-MPN specs, per-lot trackers, reports, correspondence ----

export const specForMpn = (b: OrderBundle, mpn: string) => (b.mpnTests ?? []).find((s) => s.mpn === mpn);

/** Tests done / total on a lot (F.A.R. and Not Conducted are NOT done — they need follow-up). */
export function lotTestProgress(lot: Lot) {
  const tests = lot.tests ?? [];
  const settled = tests.filter((t) => t.status === "PASSED").length;
  return { total: tests.length, settled, far: tests.filter((t) => t.status === "FAR").length,
    failed: tests.filter((t) => t.status === "FAILED").length,
    open: tests.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
    notConducted: tests.filter((t) => t.status === "NOT_CONDUCTED").length };
}

export const currentReport = (lot: Lot): WhlReport | undefined =>
  (lot.reports ?? []).find((r) => r.current) ?? (lot.reports ?? []).slice().sort((a, c) => c.revision - a.revision)[0];

export const lotEmails = (b: OrderBundle, lotId: string) =>
  (b.labEmails ?? []).filter((m) => m.lotId === lotId);

/** Inbound mail the platform couldn't route to a lot — must be matched by hand, never dropped. */
export const unmatchedEmails = (b: OrderBundle) => (b.labEmails ?? []).filter((m) => m.direction === "IN" && !m.lotId);

/** MPNs whose PO parse failed or was never run — "needs manual review". */
export function testAutofillGaps(b: OrderBundle) {
  const testable = b.lines.filter((l) => l.testingMode !== "NONE");
  return testable
    .map((l) => ({ mpn: l.mpn, spec: specForMpn(b, l.mpn) }))
    .filter((x) => !x.spec || x.spec.autofill === "FAILED" || x.spec.tests.length === 0);
}

const businessDaysSince = (iso: string) => {
  const from = new Date(`${iso}T00:00:00`);
  const to = new Date();
  let d = 0;
  for (const t = new Date(from); t < to; t.setDate(t.getDate() + 1)) {
    const day = t.getDay();
    if (day !== 0 && day !== 6) d++;
  }
  return Math.max(0, d - 1);
};

/** "Request Update" sent and still unanswered past the SLA → chase / escalate. */
export function overdueUpdateRequests(b: OrderBundle) {
  return b.lots
    .filter((l) => !!l.lastUpdateRequestAt)
    .map((l) => ({ lot: l, days: businessDaysSince(l.lastUpdateRequestAt!) }))
    .filter((x) => x.days >= WHL_SLA_BUSINESS_DAYS);
}

/** Report-vs-order mismatches surfaced automatically (MPN, client PO, missing data). */
export function reconciliationAlerts(b: OrderBundle) {
  const out: { lotId: string; lotCode: string; reportNo: string; reportId: string; message: string; kind: "PO" | "MPN" | "DATA" }[] = [];
  for (const lot of b.lots) {
    for (const r of lot.reports ?? []) {
      if (!r.current) continue;
      for (const f of r.parseFlags) {
        const kind = f.toLowerCase().includes("client p/o") ? "PO" : f.toLowerCase().includes("mpn") ? "MPN" : "DATA";
        out.push({ lotId: lot.id, lotCode: lot.lotCode, reportNo: r.reportNo, reportId: r.id, message: f, kind });
      }
    }
  }
  return out;
}

/**
 * Roll-up for the tab header. Pass a lotId to scope every number to one lot
 * (the "view this lot's result" filter); omit it for the order-wide total.
 * Unmatched inbound mail stays order-wide — it isn't attached to a lot yet.
 */
export function testingSummary(b: OrderBundle, lotId?: string) {
  const lots = lotId ? b.lots.filter((l) => l.id === lotId) : b.lots;
  const mpns = new Set(lots.map((l) => l.orderLineMpn));
  const tests = lots.flatMap((l) => l.tests ?? []) as LotTest[];
  const emails = (b.labEmails ?? []).filter((m) => (lotId ? m.lotId === lotId : true));
  return {
    lots: lots.length,
    tests: tests.length,
    passed: tests.filter((t) => t.status === "PASSED").length,
    far: tests.filter((t) => t.status === "FAR").length,
    failed: tests.filter((t) => t.status === "FAILED").length,
    notConducted: tests.filter((t) => t.status === "NOT_CONDUCTED").length,
    open: tests.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
    reports: lots.reduce((a, l) => a + (l.reports?.length ?? 0), 0),
    awaiting: emails.filter((m) => m.status === "AWAITING_RESPONSE").length,
    unmatched: unmatchedEmails(b).length,
    gaps: testAutofillGaps(b).filter((g) => !lotId || mpns.has(g.mpn)).length,
    overdue: overdueUpdateRequests(b).filter((o) => !lotId || o.lot.id === lotId).length,
  };
}

/** One row per lot for the lot-wise results table: verdict, test tally, current report. */
export function lotResults(b: OrderBundle) {
  return b.lots.map((lot) => {
    const p = lotTestProgress(lot);
    const report = currentReport(lot);
    const overdue = overdueUpdateRequests(b).find((o) => o.lot.id === lot.id);
    return {
      lot,
      progress: p,
      pct: p.total ? Math.round((p.settled / p.total) * 100) : 0,
      report,
      revisions: lot.reports?.length ?? 0,
      awaiting: lotEmails(b, lot.id).filter((m) => m.direction === "OUT" && m.status === "AWAITING_RESPONSE").length,
      overdueDays: overdue?.days ?? 0,
      // what still blocks this lot from being releasable, in one phrase
      blocker: p.failed > 0 ? "not-acceptable result"
        : p.far > 0 ? "F.A.R. — needs follow-up"
        : p.notConducted > 0 ? "process not conducted"
        : p.total === 0 ? "no tests on file"
        : p.open > 0 ? `${p.open} test(s) still open`
        : null,
    };
  });
}

// ---- cross-order rollups (queues + boards) ----
export const allApprovals = (o: OrdersMap) =>
  Object.values(o).flatMap((b) => b.approvals.map((a) => ({ ...a, orderId: b.id, orderNo: b.orderNo, party: b.buyer.name })));

export const allPayments = (o: OrdersMap) =>
  Object.values(o).flatMap((b) => b.payments.map((p) => ({
    ...p, orderId: b.id, orderNo: b.orderNo,
    party: p.direction === "CLIENT_TO_1BUY" ? b.buyer.name : b.supplier.name,
  })));

export const allLots = (o: OrdersMap) =>
  Object.values(o).flatMap((b) => b.lots.map((l) => ({ ...l, orderId: b.id, orderNo: b.orderNo })));

export const allEscrow = (o: OrdersMap) =>
  Object.values(o).filter((b) => b.escrow).map((b) => ({
    orderId: b.id, orderNo: b.orderNo, party: b.supplier.name, e: b.escrow!,
    released: escrowReleased(b), remaining: escrowRemaining(b),
  }));

export const allShipments = (o: OrdersMap) =>
  Object.values(o).flatMap((b) => b.shipments.map((s) => ({
    ...s, orderId: b.id, orderNo: b.orderNo,
    hasCustoms: b.customs.some((c) => c.shipmentNo === s.shipmentNo && !!c.icegateRef),
    needsCustoms: customsApplies(b), // A19: domestic + WHL-abroad still needs a BOE
  })));

// shipped-but-unallocated, for the delivery queue
export const deliveryWork = (o: OrdersMap) =>
  Object.values(o).flatMap((b) =>
    Array.from(new Set(b.shipments.flatMap((s) => s.lines).map((l) => l.mpn))).map((mpn) => ({
      orderId: b.id, orderNo: b.orderNo, mpn,
      received: receivedForMpn(b, mpn), allocated: allocatedForMpn(b, mpn),
      remaining: remainingToAllocate(b, mpn),
    })).filter((r) => r.received > 0),
  );

export function kpis(o: OrdersMap) {
  const bundles = Object.values(o);
  const open = bundles.filter((b) => !["CLOSED", "CANCELLED"].includes(b.status)).length;
  const pendingApprovals = allApprovals(o).filter((a) => a.status === "PENDING").length;
  const paymentsDue = allPayments(o).filter((p) => p.status === "PENDING" || p.status === "INITIATED").length;
  const testsPending = allLots(o).filter((l) => l.testStatus === "PENDING" || l.testStatus === "MAYBE").length;
  const blocked = bundles.filter((b) => b.status === "ON_HOLD" || b.journey.some((s) => s.status === "BLOCKED")).length;
  const escrowToRelease = bundles.reduce((a, b) => a + (b.escrow && ["FUNDED", "PARTIALLY_RELEASED"].includes(b.escrow.status) ? toUSD(escrowRemaining(b), b.currency) : 0), 0);
  return { open, pendingApprovals, paymentsDue, testsPending, blocked, escrowToRelease };
}

// ---- sourcing coverage: how much of a client-PO line is committed to suppliers ----
// A supplier PO is the sourcing commitment. Each PO contributes ONCE:
//   ORDERED → via its fulfilment order's live allocations (reflects map-later edits)
//   DRAFT   → via its own linked lines (order not created yet)
// The two branches are disjoint (a PO is one or the other) so no double-count.
export const sourcedForClientLine = (
  supplierPos: SupplierPO[], o: OrdersMap, clientPoNo: string, clientLineMpn: string,
) =>
  supplierPos.reduce((total, spo) => {
    if (spo.orderId && o[spo.orderId]) {
      return total + o[spo.orderId].sourcingAllocations
        .filter((a) => a.clientPoNo === clientPoNo && a.clientLineMpn === clientLineMpn)
        .reduce((s, a) => s + a.qty, 0);
    }
    return total + spo.lines
      .filter((l) => l.clientPoNo === clientPoNo && l.clientLineMpn === clientLineMpn)
      .reduce((s, l) => s + l.qty, 0);
  }, 0);

// how much of a supplier-order line has been mapped to client demand (falls back to mpn for legacy rows)
export const mappedForOrderLine = (b: OrderBundle, line: { id: string; mpn: string }) =>
  b.sourcingAllocations
    .filter((a) => (a.orderLineId ? a.orderLineId === line.id : a.orderLineMpn === line.mpn))
    .reduce((s, a) => s + a.qty, 0);
export const unmappedForOrderLine = (b: OrderBundle, line: { id: string; mpn: string; quantity: number }) =>
  line.quantity - mappedForOrderLine(b, line);

export function clientPoStatus(supplierPos: SupplierPO[], o: OrdersMap, cpo: ClientPO): "UNSOURCED" | "PARTIALLY_SOURCED" | "FULLY_SOURCED" {
  let anySourced = false, allFull = true;
  for (const l of cpo.lines) {
    const s = sourcedForClientLine(supplierPos, o, cpo.clientPoNo, l.mpn);
    if (s > 0) anySourced = true;
    if (s < l.qty) allFull = false;
  }
  if (allFull && cpo.lines.length > 0) return "FULLY_SOURCED";
  return anySourced ? "PARTIALLY_SOURCED" : "UNSOURCED";
}

export const usdRollup = (b: OrderBundle) => ({
  buyUSD: toUSD(b.buyTotal, b.currency),
  sellUSD: toUSD(b.sellTotal, b.currency),
  marginUSD: toUSD(b.sellTotal - b.buyTotal, b.currency),
});
