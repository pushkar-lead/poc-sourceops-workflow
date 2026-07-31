import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import type {
  Order, OrderBundle, OrderLine, ClientPO, SupplierPO, SupplierPoLine, PoTerms, Address, JourneyPhase, TestStatus, TestingMode, PaymentMode, PaymentDirection,
  PaymentStatus, ShipmentLeg, ShipmentStatus, TradeType, ApprovalState,
  LotTest, MpnTestSpec, TestAuditEntry, TestProcessStatus, WhlReport, LabEmail, NotifyParty,
  Lot, TestingStage, LotDispatch,
} from "@/types";
import { ORDERS, CLIENT_POS, SUPPLIER_POS, ONEBUY_HUB, getOrderBundle, buildJourney } from "@/data/fixtures";
import { remainingToShipLeg, remainingToAllocate, escrowRemaining, gateReason, sourcedForClientLine, mappedForOrderLine, orderSourcedForClient, deliveredForClientLine, lotStage } from "@/store/selectors";
import type { OrdersMap } from "@/store/selectors";
// ---- mock external-API adapters (swap for real fetch() in production) ----
import { fileBillOfEntry, getAssessment, getClearanceStatus } from "@/integrations/customs-icegate";
import { bookShipment, getTracking, type Carrier } from "@/integrations/logistics";
import {
  whlSubmitTestJob, whlPollTestReport, mapVerdict, whlFetchReport, whlSendMail, whlPollInbox,
  conclusionToLotStatus, processToTestStatus,
} from "@/integrations/lab-whl";
import { extractPoTestRequirements } from "@/integrations/doc-extract";
import { WHL_CONTACT, whlTemplate, TESTING_STAGE_META, stageIdx } from "@/data/enums";
import { hkinOpenAccount, hkinFundSuperInvoice, hkinReleaseTranche, hkinRefund, hkinRequestExtension, buyerToken, sellerToken } from "@/integrations/escrow-hkin";
import { bankInitiateTransfer, bankGetTransferStatus } from "@/integrations/banking";
import { generateIrn } from "@/integrations/einvoice-irp";
import { sendPartyNotification } from "@/integrations/notify";

const SHARPBUY_GSTIN = "27AASCS1234A1Z5"; // masking entity's GSTIN — the only seller GSTIN sent to the IRP

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

let _n = 0;
const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${(_n++).toString(36)}`;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " "); // audit rows are datetime-precise

// Every manual test edit and every status change (automated or manual) writes one of these.
const auditRow = (a: Omit<TestAuditEntry, "id" | "at">): TestAuditEntry => ({ id: uid("aud"), at: stamp(), ...a });

const ME = "You (demo)";
const WHL_BOT = "WHL inbox (auto)";
const SUPPLIER_RELAY = "Supplier (relayed)";

/**
 * Move a lot forward along the testing lifecycle. Forward-only: a stale interim mail
 * arriving after the report can't rewind a lot, and re-polling the same stage is a
 * no-op rather than a duplicate history row. Returns true if the stage actually moved.
 *
 * Compares against the *recorded* stage, not the displayed one. The displayed stage
 * (`lotStage`) is floored by what the lot's tests/report imply, and that floor can run
 * ahead of what the lab has actually told us — e.g. applying a mail's per-test updates
 * implies "in progress" before the same mail's "testing has started" is recorded. Using
 * the floor here silently swallowed those rows, so a stage the lab genuinely reported
 * never got a timestamp.
 */
function moveStage(
  lot: Lot,
  stage: TestingStage,
  by: string,
  o: { note?: string; sourceEmailId?: string; manual?: boolean } = {},
): boolean {
  const from = stageIdx(lot.stage);
  const to = stageIdx(stage);
  if (to <= from) return false;
  lot.stage = stage;
  (lot.stageHistory ??= []).push({
    id: uid("stg"), stage, at: stamp(), by,
    note: o.note, sourceEmailId: o.sourceEmailId, manual: o.manual,
  });
  return true;
}


function freshSeed(): { orders: OrdersMap; clientPos: typeof CLIENT_POS; supplierPos: SupplierPO[] } {
  const orders: OrdersMap = {};
  for (const o of ORDERS) { const b = getOrderBundle(o.id); if (b) orders[o.id] = b; }
  return JSON.parse(JSON.stringify({ orders, clientPos: CLIENT_POS, supplierPos: SUPPLIER_POS }));
}

export interface ClientPoInput {
  clientName: string; clientPoNo: string; paymentMode: PaymentMode;
  clientGstin?: string; clientState?: string; terms?: PoTerms; deliveryAddress?: Address;
  lines: { mpn: string; make?: string; dateCode?: string; qty: number; unitPrice: number; requiredBy: string }[];
}

export interface SupplierPoInput {
  supplier: string; supplierCountry?: string; supplierGstin?: string; supplierState?: string;
  tradeType: TradeType; incoterm: string; currency: string; sellerPaymentMode: PaymentMode;
  lead: number; testDays: number; delivery: number; testing: TestingMode; terms?: PoTerms;
  creditDays?: number; termsConditions?: string[]; relabelCost?: number;
  // lines may be LINKED to a client-PO line (partial ok, multi-client) or UNLINKED (client ref omitted — map later)
  lines: { mpn: string; make?: string; dateCode?: string; testing?: TestingMode; clientPoNo?: string; clientLineMpn?: string; qty: number; buyUnitPrice: number; marginPct: number }[];
}

/** Standard bundle scaffold used by both create paths. */
function scaffoldBundle(order: Order, lines: OrderLine[], createdEvent: string): OrderBundle {
  return {
    ...order, lines, journey: buildJourney(order), lots: [], mpnTests: [], labEmails: [],
    escrow: order.paymentMode === "ESCROW"
      ? { id: uid("esc"), provider: "HKIN", externalRef: "—", currency: order.currency, materialAmount: order.buyTotal,
          chargesAmount: Math.round(order.buyTotal * 0.02), bankingCharges: Math.round(order.buyTotal * 0.005), feeSeller: 300, feeBuyer: 150,
          superInvoiceTotal: Math.round(order.buyTotal * 1.025) + 450, releaseTrigger: order.termsConditions?.length ? "Per T&C + lab PASS" : "WHL PASS",
          paymentTerms: order.terms?.paymentMethod ?? "Advance via T/T into escrow", expiryDate: addDays(order.createdAt, 45), status: "OPEN", events: [] }
      : undefined,
    payments: [], shipments: [], customs: [], deliveries: [], sourcingAllocations: [], documents: [],
    approvals: [], // PO review happens on the upstream sourcing platform; fulfilment approvals (payment/escrow release) are added later
    events: [{ id: uid("ev"), eventType: "GENERAL", message: createdEvent, source: "SC_MANUAL", occurredAt: today(), recordedBy: "You (demo)" }],
  };
}

interface Store {
  orders: OrdersMap;
  clientPos: typeof CLIENT_POS;
  supplierPos: SupplierPO[];

  resetDemo: () => void;
  createClientPo: (input: ClientPoInput) => string;
  createSupplierPo: (input: SupplierPoInput) => string | null;
  createOrderFromSupplierPo: (supplierPoId: string) => string | null;

  advanceStep: (orderId: string) => void;
  addStep: (orderId: string, step: { phase: string; name: string; owner: string; isGate: boolean }) => void;

  addLot: (orderId: string, lot: { orderLineMpn: string; lotCode: string; dateCode: string; qty: number; sampleQty: number; lab?: string }) => void;
  setLotStatus: (orderId: string, lotId: string, status: TestStatus) => void;
  fetchLabResult: (orderId: string, lotId: string) => void; // WHL adapter — poll the report

  // ---- WHL testing platform ----
  autofillMpnTests: (orderId: string, mpn?: string) => void;          // parse the PO's test table (never hand-typed)
  addMpnTest: (orderId: string, mpn: string, t: { name: string; standard?: string }) => void;  // audited manual override
  removeMpnTest: (orderId: string, mpn: string, testId: string) => void;                        // audited manual override
  setLotTestStatus: (orderId: string, lotId: string, lotTestId: string, status: TestProcessStatus, note?: string) => void;
  // ---- testing lifecycle (the stage chain a lot walks while it's at the lab) ----
  recordSupplierDispatch: (orderId: string, lotId: string, d: Omit<LotDispatch, "recordedBy" | "recordedAt">) => void;
  setLotStage: (orderId: string, lotId: string, stage: TestingStage, note?: string) => void;
  fetchWhlReport: (orderId: string, lotId: string) => void;           // pull (or revise) the report + parse it on screen
  requestWhlUpdate: (orderId: string, lotId: string) => void;         // pre-mapped outbound chase
  sendLabEmail: (orderId: string, m: { lotId?: string; subject: string; body: string }) => void;
  syncWhlInbox: (orderId: string) => void;                            // inbound status mails → test statuses / reports
  matchLabEmail: (orderId: string, emailId: string, lotId: string) => void; // resolve the manual-match queue
  escalateLabEmail: (orderId: string, emailId: string) => void;
  logReportAccess: (orderId: string, lotId: string, reportId: string, action: "VIEW" | "DOWNLOAD") => void;
  reconcileReportPo: (orderId: string, lotId: string, reportId: string) => void;
  // circulate a lot's result: supplier / buyer (masked from each other) / escrow / lab
  notifyLotResult: (orderId: string, lotId: string, m: { party: NotifyParty; to: string; subject: string; body: string; attachReport: boolean }) => void;
  // one digest mail covering many lots — logged against every lot it covered
  notifyLotsResult: (orderId: string, lotIds: string[], m: { party: NotifyParty; to: string; subject: string; body: string; attachReports: boolean }) => void;

  addSourcingAllocation: (orderId: string, a: { orderLineId: string; orderLineMpn: string; clientPoNo: string; clientLineMpn: string; qty: number; marginPct: number }) => boolean;

  fundEscrow: (orderId: string, input: { provider: string; material: number; charges: number; bankingCharges?: number }) => void;
  requestEscrowExtension: (orderId: string, input: { reason: string; newDate: string }) => void;
  releaseEscrow: (orderId: string, amount: number, trigger?: string) => void;
  refundEscrow: (orderId: string, amount: number, trigger?: string) => void;

  addPayment: (orderId: string, p: { direction: PaymentDirection; mode: PaymentMode; amount: number; triggerDoc: string; dueDate?: string }) => void;
  setPaymentStatus: (orderId: string, payId: string, status: PaymentStatus) => void;
  initiatePaymentTransfer: (orderId: string, payId: string) => void; // banking adapter — T/T

  createShipment: (orderId: string, s: { leg: ShipmentLeg; carrier: string; fromLocation: string; toLocation: string; boxCount: number; grossWeightKg: number; lines: { mpn: string; qty: number }[] }) => string | null;
  setShipmentStatus: (orderId: string, shipId: string, status: ShipmentStatus) => void;
  pollShipmentTracking: (orderId: string, shipId: string) => void; // logistics adapter — advance from carrier tracking

  fileBOE: (orderId: string, e: { shipmentNo: string; portCode: string; chaName: string; assessableValue: number }) => void; // ICEGATE adapter

  allocateDelivery: (orderId: string, a: { fromShipmentNo: string; clientPoNo: string; clientLineMpn: string; qty: number }) => boolean;
  recordPoD: (orderId: string, deliveryId: string) => void;

  generateEInvoice: (orderId: string) => void; // GST e-Invoice / IRP adapter
  cancelOrder: (orderId: string) => void;

  addEvent: (orderId: string, e: { eventType: string; message: string }) => void;
  addDocument: (orderId: string, d: { subjectType: string; docType: string; fileName: string }) => void;
  attachPI: (orderId: string, p: { piNo: string; fileName: string }) => void; // upload the supplier PI (received upstream) onto the order
  decideApproval: (orderId: string, approvalId: string, status: ApprovalState) => void;
}

/** Guarantee every array field exists — tolerates older persisted shapes (schema drift). */
function normalizeBundle(raw: unknown): OrderBundle {
  const b = (raw ?? {}) as Partial<OrderBundle>;
  return {
    ...b,
    lines: b.lines ?? [],
    journey: b.journey ?? [],
    lots: (b.lots ?? []).map((l) => ({ ...l, tests: l.tests ?? [], reports: l.reports ?? [], notifications: l.notifications ?? [] })),
    mpnTests: (b.mpnTests ?? []).map((s) => ({ ...s, tests: s.tests ?? [], audit: s.audit ?? [] })),
    labEmails: b.labEmails ?? [],
    payments: b.payments ?? [],
    shipments: b.shipments ?? [],
    customs: b.customs ?? [],
    deliveries: b.deliveries ?? [],
    sourcingAllocations: b.sourcingAllocations ?? [],
    documents: b.documents ?? [],
    approvals: b.approvals ?? [],
    events: b.events ?? [],
    escrow: b.escrow ? { ...b.escrow, events: b.escrow.events ?? [] } : undefined,
  } as OrderBundle;
}

const seed = freshSeed();

export const useStore = create<Store>()(
  persist(
    immer((set, get) => ({
      orders: seed.orders,
      clientPos: seed.clientPos,
      supplierPos: seed.supplierPos,

      resetDemo: () => {
        const s = freshSeed();
        set((st) => { st.orders = s.orders; st.clientPos = s.clientPos; st.supplierPos = s.supplierPos; });
        toast.success("Demo data reset");
      },

      createClientPo: (input) => {
        const st = get();
        let clientPoNo = input.clientPoNo.trim();
        if (clientPoNo && st.clientPos.some((c) => c.clientPoNo === clientPoNo)) {
          toast.error(`Client PO ${clientPoNo} already exists — use a unique number.`);
          return "";
        }
        if (!clientPoNo) { // collision-safe fallback
          let n = st.clientPos.length + 1;
          while (st.clientPos.some((c) => c.clientPoNo === `CPO-${n}`)) n++;
          clientPoNo = `CPO-${n}`;
        }
        const cpo: ClientPO = {
          id: uid("cpo"), clientPoNo, client: { name: input.clientName || "—", country: "—", gstin: input.clientGstin, state: input.clientState },
          paymentMode: input.paymentMode, status: "RECEIVED", terms: input.terms, deliveryAddress: input.deliveryAddress,
          lines: input.lines.map((l) => ({ mpn: l.mpn, make: l.make, dateCode: l.dateCode, qty: l.qty, unitPrice: l.unitPrice, requiredBy: l.requiredBy, status: "OPEN" })),
        };
        set((s) => { s.clientPos.unshift(cpo); });
        toast.success(`Client PO ${clientPoNo} created`);
        return clientPoNo;
      },

      // STEP 2 — create the Supplier PO document (no fulfilment order yet)
      createSupplierPo: (input) => {
        const st = get();
        if (input.lines.length === 0) { toast.error("Add at least one line."); return null; }
        if (input.lines.some((l) => l.qty <= 0 || !l.mpn.trim())) { toast.error("Every line needs an MPN and qty."); return null; }
        const linked = input.lines.filter((l) => l.clientPoNo && l.clientLineMpn);
        // coverage guard for LINKED lines: committed-so-far (all supplier POs) + this draft ≤ client demand
        const draft = new Map<string, number>();
        for (const l of linked) { const k = `${l.clientPoNo}|${l.clientLineMpn}`; draft.set(k, (draft.get(k) ?? 0) + l.qty); }
        for (const [k, q] of draft) {
          const [poNo, mpn] = k.split("|");
          const demand = st.clientPos.find((c) => c.clientPoNo === poNo)?.lines.find((l) => l.mpn === mpn)?.qty ?? 0;
          const already = sourcedForClientLine(st.supplierPos, st.orders, poNo, mpn);
          if (already + q > demand) { toast.error(`${mpn} · ${poNo} exceeds remaining to source (${Math.max(0, demand - already)}).`); return null; }
        }
        const id = uid("spo");
        const poNo = `SPO-2026-0${201 + st.supplierPos.length}`;
        const created = today();
        const buyTotal = input.lines.reduce((a, l) => a + l.qty * l.buyUnitPrice, 0);
        const spo: SupplierPO = {
          id, poNo,
          supplier: { name: input.supplier || "—", country: input.supplierCountry || "—", gstin: input.supplierGstin, state: input.supplierState },
          tradeType: input.tradeType, currency: input.currency, incoterm: input.incoterm, paymentMode: input.sellerPaymentMode,
          testing: input.testing, leadTimeDays: input.lead, testingTimeDays: input.testDays, deliveryTimeDays: input.delivery,
          terms: input.terms, creditDays: input.creditDays, termsConditions: input.termsConditions, relabelCost: input.relabelCost,
          lines: input.lines.map((l) => ({ mpn: l.mpn, make: l.make, dateCode: l.dateCode, testing: l.testing, qty: l.qty, buyUnitPrice: l.buyUnitPrice, marginPct: l.marginPct, clientPoNo: l.clientPoNo, clientLineMpn: l.clientLineMpn })),
          buyTotal: Math.round(buyTotal), createdBy: "You (demo)", createdAt: created, status: "DRAFT",
        };
        set((s) => { s.supplierPos.unshift(spo); });
        toast.success(`Supplier PO ${poNo} created${linked.length < input.lines.length ? " — some lines unlinked" : ""}`);
        return id;
      },

      // STEP 3 — select a Supplier PO and spin up its fulfilment order (the journey)
      createOrderFromSupplierPo: (supplierPoId) => {
        const st = get();
        const spo = st.supplierPos.find((s) => s.id === supplierPoId);
        if (!spo) { toast.error("Supplier PO not found."); return null; }
        if (spo.orderId && st.orders[spo.orderId]) { toast(`Order already created for ${spo.poNo}`); return spo.orderId; }
        const linked = spo.lines.filter((l) => l.clientPoNo && l.clientLineMpn);
        const sellFor = (l: SupplierPoLine) =>
          l.clientPoNo && l.clientLineMpn ? (st.clientPos.find((c) => c.clientPoNo === l.clientPoNo)?.lines.find((x) => x.mpn === l.clientLineMpn)?.unitPrice ?? l.buyUnitPrice) : l.buyUnitPrice;
        const clientNames = new Set(linked.map((l) => st.clientPos.find((c) => c.clientPoNo === l.clientPoNo)?.client.name ?? "—"));
        const buyerName = clientNames.size === 0 ? "Unlinked (map later)" : clientNames.size === 1 ? [...clientNames][0] : "Multiple clients";
        // per-line testing (fallback to the PO default); the order's summary mode drives the journey label + A19 customs
        const lineTesting = (l: SupplierPoLine): TestingMode => l.testing ?? spo.testing;
        const aggTesting: TestingMode = spo.lines.some((l) => lineTesting(l) === "WHL") ? "WHL"
          : spo.lines.some((l) => lineTesting(l) === "SUPPLIER_SELF") ? "SUPPLIER_SELF" : "NONE";
        const buyerAddr = linked.length ? st.clientPos.find((c) => c.clientPoNo === linked[0].clientPoNo)?.deliveryAddress : undefined;
        const id = uid("ord");
        const no = 156 + Object.keys(st.orders).length;
        const created = today();
        const dispatch = addDays(created, spo.leadTimeDays + spo.testingTimeDays);
        const delivery = addDays(dispatch, spo.deliveryTimeDays);
        const buyTotal = spo.lines.reduce((a, l) => a + l.qty * l.buyUnitPrice, 0);
        const sellTotal = spo.lines.reduce((a, l) => a + l.qty * sellFor(l), 0);
        const order: Order = {
          id, orderNo: `ORD-2026-000${no}`, operatingMode: "MOR", tradeType: spo.tradeType,
          status: "ACTIVE", approvalStatus: "APPROVED", // approved upstream on the sourcing platform
          buyer: { name: buyerName, country: "—" }, supplier: spo.supplier,
          maskingEntity: "Sharpbuy Global Solutions", currency: spo.currency, incoterm: spo.incoterm,
          paymentMode: spo.paymentMode, leadTimeDays: spo.leadTimeDays, testingTimeDays: spo.testingTimeDays,
          deliveryTimeDays: spo.deliveryTimeDays, testingMode: aggTesting,
          expectedDispatchDate: dispatch, expectedDeliveryDate: delivery,
          requiredBy: addDays(delivery, 3), buyTotal: Math.round(buyTotal), sellTotal: Math.round(sellTotal),
          createdBy: "You (demo)", createdAt: created, terms: spo.terms, supplierPoId: spo.id, supplierPoNo: spo.poNo,
          hubAddress: ONEBUY_HUB, buyerAddress: buyerAddr,
          creditDays: spo.creditDays, termsConditions: spo.termsConditions, relabelCost: spo.relabelCost,
        };
        const dcOf = (l: SupplierPoLine) => l.dateCode
          ?? (l.clientPoNo && l.clientLineMpn ? st.clientPos.find((c) => c.clientPoNo === l.clientPoNo)?.lines.find((x) => x.mpn === l.clientLineMpn)?.dateCode : undefined)
          ?? "—";
        const orderLines: OrderLine[] = spo.lines.map((l, i) => {
          const t = lineTesting(l);
          return {
            id: uid("l"), lineNo: i + 1, mpn: l.mpn, make: l.make ?? "—", description: l.clientPoNo ? `For ${l.clientPoNo}` : "Unlinked — map later", hsnCode: "—",
            quantity: l.qty, unitPrice: l.buyUnitPrice, currency: spo.currency, dateCode: dcOf(l),
            coo: spo.tradeType === "INTERNATIONAL" ? "—" : "IN", testingRequired: t !== "NONE",
            testingMode: t, componentCategory: "—", lab: t === "WHL" ? "WHL Shenzhen" : undefined,
          };
        });
        const bundle = scaffoldBundle(order, orderLines, `Order created from ${spo.poNo} — ${spo.lines.length} line(s)${linked.length ? `, ${linked.length} linked` : " (unlinked — map later)"}.`);
        spo.lines.forEach((l, i) => {
          if (l.clientPoNo && l.clientLineMpn) bundle.sourcingAllocations.push({ id: uid("sa"), orderLineId: orderLines[i].id, clientPoNo: l.clientPoNo, clientLineMpn: l.clientLineMpn, orderLineMpn: l.mpn, qty: l.qty, marginPct: l.marginPct });
        });
        const t = spo.terms;
        if (t) {
          const bits = [t.paymentMethod, t.deliveryTerms, t.dateCode && `date code ${t.dateCode}`, t.warranty && `warranty ${t.warranty}`, t.packing].filter(Boolean);
          if (bits.length) bundle.events.unshift({ id: uid("ev"), eventType: "SUPPLIER_NOTE", message: `Terms: ${bits.join(" · ")}`, source: "SC_MANUAL", occurredAt: created, recordedBy: "You (demo)" });
        }
        // fulfilment starts here: step 0 (received) done, step 1 (first fulfilment gate) in progress
        bundle.journey.forEach((s, i) => { s.status = i === 0 ? "DONE" : i === 1 ? "IN_PROGRESS" : "PENDING"; });
        // non-escrow orders collect from the client and pay the supplier via T/T — seed both tasks so the payment gates are immediately actionable
        if (order.paymentMode !== "ESCROW") {
          bundle.payments.push(
            { id: uid("pay"), direction: "CLIENT_TO_1BUY", mode: order.paymentMode, triggerDoc: "Our PI", amount: order.sellTotal, currency: order.currency, status: "PENDING" },
            { id: uid("pay"), direction: "1BUY_TO_SUPPLIER", mode: order.paymentMode, triggerDoc: "Supplier PI", amount: order.buyTotal, currency: order.currency, status: "PENDING" },
          );
        }
        set((s) => {
          s.orders[id] = bundle;
          const target = s.supplierPos.find((x) => x.id === supplierPoId);
          if (target) { target.status = "ORDERED"; target.orderId = id; }
        });
        toast.success(`Order ${order.orderNo} created from ${spo.poNo} — ready for fulfilment`);
        return id;
      },

      advanceStep: (orderId) => {
        const b = get().orders[orderId]; if (!b) return;
        const idx = b.journey.findIndex((x) => x.status === "IN_PROGRESS" || x.status === "BLOCKED");
        if (idx < 0) return;
        const step = b.journey[idx];
        const reason = gateReason(b, step);
        if (reason) {
          set((s) => { const bb = s.orders[orderId]; if (bb) { bb.journey[idx].status = "BLOCKED"; if (bb.status === "ACTIVE") bb.status = "ON_HOLD"; } });
          toast.error(`Blocked: ${reason}`);
          return;
        }
        set((s) => {
          const bb = s.orders[orderId]; if (!bb) return;
          bb.journey[idx].status = "DONE";
          if (idx + 1 < bb.journey.length) bb.journey[idx + 1].status = "IN_PROGRESS";
          else bb.status = "CLOSED";
          if (bb.status === "ON_HOLD") bb.status = "ACTIVE";
        });
        toast.success(`Step done: ${step.name}`);
      },

      addStep: (orderId, step) => { set((s) => {
        const b = s.orders[orderId]; if (!b) return;
        const seq = b.journey.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
        b.journey.push({ id: uid("j"), seq, phase: step.phase as JourneyPhase, name: step.name, owner: step.owner, isGate: step.isGate, status: "PENDING" });
      }); toast.success("Step added"); },

      addLot: (orderId, lot) => {
        const lotId = uid("lot");
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          // lot logic is unchanged — it just inherits the MPN's PO-parsed test list as its status tracker
          const spec = (b.mpnTests ?? []).find((x) => x.mpn === lot.orderLineMpn);
          const tests: LotTest[] = (spec?.tests ?? []).map((t) => ({
            id: uid("lt"), requirementId: t.id, name: t.name, standard: t.standard, source: t.source, status: "PENDING",
            history: [auditRow({ by: ME, action: "STATUS", target: t.name, after: "PENDING", note: `Inherited from ${spec?.sourceDoc ?? "the PO"} when lot ${lot.lotCode} was raised.` })],
          }));
          const clientPoNo = b.sourcingAllocations.find((a) => a.orderLineMpn === lot.orderLineMpn)?.clientPoNo;
          b.lots.push({
            id: lotId, orderLineMpn: lot.orderLineMpn, lotCode: lot.lotCode, dateCode: lot.dateCode, qty: lot.qty,
            sampleQty: lot.sampleQty, testStatus: "PENDING", lab: lot.lab, clientPoNo, tests, reports: [],
          });
        });
        toast.message("Lot added — submitting to WHL…");
        // WHL adapter: register the test job, stamp the work-order no back onto the lot
        void (async () => {
          try {
            const wo = await whlSubmitTestJob({ clientRef: `${orderId}:${lot.lotCode}`, mpn: lot.orderLineMpn, dateCode: lot.dateCode, lotCode: lot.lotCode, lotQty: lot.qty, sampleQty: lot.sampleQty, testPlan: "AS6081", labSite: lot.lab?.includes("Hong") ? "HONGKONG" : "SHENZHEN" });
            set((s) => {
              const l = s.orders[orderId]?.lots.find((x) => x.id === lotId); if (!l) return;
              l.workOrderNo = wo.workOrderNo; l.tatDays = wo.estimatedTatDays; l.lab = lot.lab ?? "WHL Shenzhen";
              moveStage(l, "TEST_REQUESTED", ME, { note: `Work order ${wo.workOrderNo} raised with ${l.lab} — quoted TAT ${wo.estimatedTatDays} days.` });
            });
            toast.success(`WHL work order ${wo.workOrderNo}`);
          } catch (e) { toast.error(`WHL: ${errMsg(e)}`); }
        })();
      },
      setLotStatus: (orderId, lotId, status) => {
        // The verdict is a call on the *result*, not a lifecycle move — the chain ends when
        // the report arrives, which any lot with a verdict has already passed.
        set((s) => {
          const l = s.orders[orderId]?.lots.find((x) => x.id === lotId); if (!l) return;
          l.testStatus = status; l.testedAt = today();
        });
        if (status === "PASS") toast.success("Lot PASSED — you can release the escrow tranche");
        else if (status === "FAIL") toast.error("Lot FAILED — start the return / refund path");
        else toast(`Lot set ${status}`);
      },
      fetchLabResult: (orderId, lotId) => {
        const lot = get().orders[orderId]?.lots.find((x) => x.id === lotId);
        if (!lot) return;
        if (!lot.workOrderNo) { toast.error("No WHL work order yet for this lot."); return; }
        toast.message("Fetching WHL report…");
        void (async () => {
          try {
            const rep = await whlPollTestReport(lot.workOrderNo!);
            if (rep.status !== "COMPLETED" || !rep.verdict) { toast("WHL still in progress — try again shortly."); return; }
            const st = mapVerdict(rep.verdict);
            set((s) => { const l = s.orders[orderId]?.lots.find((x) => x.id === lotId); if (l) { l.testStatus = st; l.reportNo = rep.reportNo; l.tatDays = rep.tatDays; l.testedAt = today(); } });
            if (st === "PASS") toast.success(`WHL PASS — report ${rep.reportNo}`);
            else if (st === "FAIL") toast.error(`WHL FAIL — report ${rep.reportNo}`);
            else toast(`WHL inconclusive — report ${rep.reportNo}`);
          } catch (e) { toast.error(`WHL: ${errMsg(e)}`); }
        })();
      },

      // ---- WHL testing platform ----------------------------------------------------
      // Test requirements already exist in the PO, so they're parsed from it rather than
      // typed. An MPN whose table can't be read is flagged for manual review, never blank.
      autofillMpnTests: (orderId, mpn) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        const targets = (mpn ? b0.lines.filter((l) => l.mpn === mpn) : b0.lines).map((l) => l.mpn);
        if (targets.length === 0) return;
        const sourceDoc = b0.supplierPoNo ? `Supplier PO ${b0.supplierPoNo}` : `Order ${b0.orderNo}`;
        const modes: Record<string, string> = {};
        for (const l of b0.lines) modes[l.mpn] = l.testingMode;
        toast.message(`Parsing test table off ${sourceDoc}…`);
        void (async () => {
          try {
            const res = await extractPoTestRequirements({ sourceDoc, mpns: Array.from(new Set(targets)), testingModes: modes });
            set((s) => {
              const b = s.orders[orderId]; if (!b) return;
              b.mpnTests ??= [];
              for (const m of res.mpns) {
                const failed = m.tests.length === 0 && !!m.note && !m.note.startsWith("PO specifies no");
                const spec: MpnTestSpec = {
                  id: uid("spec"), mpn: m.mpn,
                  autofill: failed ? "FAILED" : "OK",
                  autofillNote: m.note, sourceDoc: res.sourceDoc, parsedAt: stamp(), confidence: m.confidence,
                  tests: m.tests.map((t) => ({ id: uid("req"), name: t.name, standard: t.standard, source: "AUTO_PO" as const })),
                  audit: [],
                };
                const prev = b.mpnTests.find((x) => x.mpn === m.mpn);
                // keep manual additions across a re-parse — they're human corrections, not PO data
                const manual = prev?.tests.filter((t) => t.source === "MANUAL") ?? [];
                spec.tests.push(...manual);
                spec.audit = [
                  ...(prev?.audit ?? []),
                  auditRow({
                    by: "Doc extraction (auto)", action: "AUTOFILL", target: m.mpn,
                    before: prev ? `${prev.tests.length} test(s)` : "—",
                    after: failed ? "auto-fill failed" : `${m.tests.length} test(s) from ${res.sourceDoc}`,
                    note: m.note ?? `Confidence ${Math.round(m.confidence * 100)}%.`,
                  }),
                ];
                if (prev) Object.assign(prev, spec, { id: prev.id }); else b.mpnTests.push(spec);
                // push newly-parsed tests onto lots of this MPN that don't have them yet
                for (const lot of b.lots.filter((l) => l.orderLineMpn === m.mpn)) {
                  lot.tests ??= [];
                  for (const t of spec.tests) {
                    if (lot.tests.some((x) => x.name === t.name)) continue;
                    lot.tests.push({ id: uid("lt"), requirementId: t.id, name: t.name, standard: t.standard, source: t.source, status: "PENDING",
                      history: [auditRow({ by: "Doc extraction (auto)", action: "ADD", target: t.name, after: "PENDING", note: `Auto-filled from ${res.sourceDoc}.` })] });
                  }
                }
              }
            });
            const bad = res.mpns.filter((m) => m.tests.length === 0 && m.note && !m.note.startsWith("PO specifies no")).length;
            if (bad) toast.warning(`${bad} MPN(s) need manual review — auto-fill failed.`);
            else toast.success("Test requirements auto-filled from the PO");
          } catch (e) {
            // whole-document failure: flag every target MPN rather than silently leaving them blank
            set((s) => {
              const b = s.orders[orderId]; if (!b) return;
              b.mpnTests ??= [];
              for (const m of Array.from(new Set(targets))) {
                const prev = b.mpnTests.find((x) => x.mpn === m);
                const row = auditRow({ by: "Doc extraction (auto)", action: "AUTOFILL", target: m, after: "auto-fill failed", note: errMsg(e) });
                if (prev) { prev.autofill = "FAILED"; prev.autofillNote = errMsg(e); prev.audit.push(row); }
                else b.mpnTests.push({ id: uid("spec"), mpn: m, autofill: "FAILED", autofillNote: errMsg(e), sourceDoc, parsedAt: stamp(), tests: [], audit: [row] });
              }
            });
            toast.error(`Auto-fill failed — needs manual review (${errMsg(e)})`);
          }
        })();
      },

      addMpnTest: (orderId, mpn, t) => {
        if (!t.name.trim()) return;
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          b.mpnTests ??= [];
          let spec = b.mpnTests.find((x) => x.mpn === mpn);
          if (!spec) { spec = { id: uid("spec"), mpn, autofill: "PENDING", tests: [], audit: [] }; b.mpnTests.push(spec); }
          if (spec.tests.some((x) => x.name.toLowerCase() === t.name.trim().toLowerCase())) return;
          const reqId = uid("req");
          spec.tests.push({ id: reqId, name: t.name.trim(), standard: t.standard, source: "MANUAL", addedBy: ME, addedAt: stamp() });
          spec.audit.push(auditRow({ by: ME, action: "ADD", target: t.name.trim(), before: "—", after: `manual test${t.standard ? ` (${t.standard})` : ""}`, note: "Manual override of the auto-filled list." }));
          if (spec.autofill === "FAILED") spec.autofill = "PENDING"; // reviewed by a human now
          for (const lot of b.lots.filter((l) => l.orderLineMpn === mpn)) {
            lot.tests ??= [];
            if (lot.tests.some((x) => x.name.toLowerCase() === t.name.trim().toLowerCase())) continue;
            lot.tests.push({ id: uid("lt"), requirementId: reqId, name: t.name.trim(), standard: t.standard, source: "MANUAL", status: "PENDING",
              history: [auditRow({ by: ME, action: "ADD", target: t.name.trim(), after: "PENDING", note: "Added manually to this lot's tracker." })] });
          }
        });
        toast.success(`Test added — ${t.name}`);
      },

      removeMpnTest: (orderId, mpn, testId) => {
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          const spec = (b.mpnTests ?? []).find((x) => x.mpn === mpn); if (!spec) return;
          const t = spec.tests.find((x) => x.id === testId); if (!t) return;
          spec.tests = spec.tests.filter((x) => x.id !== testId);
          spec.audit.push(auditRow({ by: ME, action: "DELETE", target: t.name, before: `${t.source === "AUTO_PO" ? "auto-filled" : "manual"} test`, after: "—", note: "Removed by operator." }));
          for (const lot of b.lots.filter((l) => l.orderLineMpn === mpn)) {
            const lt = (lot.tests ?? []).find((x) => x.name === t.name);
            if (lt) lot.tests = (lot.tests ?? []).filter((x) => x.id !== lt.id);
          }
        });
        toast.success("Test removed (logged)");
      },

      setLotTestStatus: (orderId, lotId, lotTestId, status, note) => {
        set((s) => {
          const lot = s.orders[orderId]?.lots.find((x) => x.id === lotId); if (!lot) return;
          const t = (lot.tests ?? []).find((x) => x.id === lotTestId); if (!t) return;
          const before = t.status;
          if (before === status) return;
          t.status = status; t.updatedAt = stamp();
          t.history.push(auditRow({ by: ME, action: "STATUS", target: t.name, before, after: status, note: note ?? "Set manually." }));
        });
      },

      /**
       * The supplier tells us the parts are on their way to WHL. This is the one stage
       * no mail from the lab can establish — WHL only learns of the shipment when it
       * lands — so it's an explicit operator input, and it starts the lab-side clock.
       */
      recordSupplierDispatch: (orderId, lotId, d) => {
        let moved = false;
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          const lot = b.lots.find((x) => x.id === lotId); if (!lot) return;
          lot.dispatch = { ...d, recordedBy: ME, recordedAt: stamp() };
          const detail = [d.courier, d.awb && `AWB ${d.awb}`, d.dispatchedOn && `dispatched ${d.dispatchedOn}`, d.expectedArrival && `ETA ${d.expectedArrival}`]
            .filter(Boolean).join(" · ");
          moved = moveStage(lot, "SUPPLIER_DISPATCHING", SUPPLIER_RELAY, {
            note: [detail || "Supplier confirmed dispatch to WHL.", d.note].filter(Boolean).join(" — "),
          });
          b.events.unshift({
            id: uid("ev"), eventType: "GENERAL",
            message: `${lot.lotCode} (${lot.orderLineMpn}) dispatched by the supplier to ${lot.lab ?? "WHL"}${detail ? ` — ${detail}` : ""}.`,
            source: "WHL", occurredAt: today(), recordedBy: ME,
          });
        });
        toast.success(moved ? "Dispatch recorded — waiting on WHL to confirm receipt" : "Dispatch details saved");
      },

      /** Manual stage correction — a phone call, or fixing a mis-step. Always logged. */
      setLotStage: (orderId, lotId, stage, note) => {
        set((s) => {
          const lot = s.orders[orderId]?.lots.find((x) => x.id === lotId); if (!lot) return;
          const before = lotStage(lot);
          if (before === stage) return;
          const back = stageIdx(stage) < stageIdx(before);
          lot.stage = stage;
          (lot.stageHistory ??= []).push({
            id: uid("stg"), stage, at: stamp(), by: ME, manual: true,
            note: note ?? (back
              ? `Corrected back from ${before ? TESTING_STAGE_META[before].label : "—"} by the operator.`
              : `Set manually${before ? ` from ${TESTING_STAGE_META[before].label}` : ""}.`),
          });
        });
        toast.success(`Stage → ${TESTING_STAGE_META[stage].label}`);
      },

      // Pull the report for a lot's work order and parse it on screen. Called again → next revision.
      fetchWhlReport: (orderId, lotId) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        const lot = b0.lots.find((x) => x.id === lotId); if (!lot) return;
        if (!lot.workOrderNo) { toast.error("No WHL work order for this lot yet."); return; }
        const line = b0.lines.find((l) => l.mpn === lot.orderLineMpn);
        const revision = (lot.reports ?? []).reduce((m, r) => Math.max(m, r.revision), 0) + 1;
        toast.message(revision > 1 ? `Fetching revision ${revision} of ${lot.workOrderNo}…` : "Fetching WHL report…");
        void (async () => {
          try {
            const rep = await whlFetchReport({
              workOrderNo: lot.workOrderNo!, mpn: lot.orderLineMpn, manufacturer: line?.make ?? "—", lotQty: lot.qty,
              client: b0.maskingEntity, clientPo: lot.clientPoNo, revision,
              testNames: (lot.tests ?? []).map((t) => t.name),
            });
            set((s) => {
              const b = s.orders[orderId]; if (!b) return;
              const l = b.lots.find((x) => x.id === lotId); if (!l) return;
              l.reports ??= [];
              l.reports.forEach((r) => { r.current = false; });
              const stored: WhlReport = {
                id: uid("rep"), reportNo: rep.reportNo, revision: rep.revision, reportDate: rep.reportDate,
                workOrderNo: rep.workOrderNo, fileName: rep.fileName, receivedAt: stamp(), current: true,
                revisionNote: rep.revisionNote, partNumber: rep.partNumber, manufacturer: rep.manufacturer,
                lotQty: rep.lotQty, client: rep.client, clientPo: rep.clientPo, conclusion: rep.conclusion,
                anyFar: rep.anyFar, processes: rep.processes, approvedBy: rep.approvedBy, approverTitle: rep.approverTitle,
                standards: rep.standards, riskClass: rep.riskClass, msl: rep.msl, packageType: rep.packageType,
                confidentialityNote: rep.confidentialityNote, parseFlags: [...rep.parseFlags], accessLog: [],
              };
              // reconciliation: the report must agree with the lot it was raised for
              if (rep.partNumber !== l.orderLineMpn) stored.parseFlags.push(`Report MPN ${rep.partNumber} ≠ lot MPN ${l.orderLineMpn} — verify before acting on this report.`);
              if (l.clientPoNo && rep.clientPo !== "PO Unknown" && rep.clientPo !== l.clientPoNo) stored.parseFlags.push(`Report Client P/O ${rep.clientPo} ≠ ${l.clientPoNo} on file — reconcile.`);
              l.reports.push(stored);
              l.reportNo = stored.reportNo;
              l.testedAt = stored.reportDate;
              l.testStatus = conclusionToLotStatus(stored.conclusion, stored.anyFar);
              // roll the process matrix onto the per-test tracker (with history)
              l.tests ??= [];
              for (const p of stored.processes) {
                const next = processToTestStatus(p.result);
                let t = l.tests.find((x) => x.name === p.name);
                if (!t) {
                  t = { id: uid("lt"), name: p.name, source: "AUTO_PO", status: "PENDING", history: [] };
                  l.tests.push(t);
                }
                const before = t.status;
                t.status = next; t.acceptQty = p.acceptQty; t.rejectQty = p.rejectQty; t.updatedAt = stamp();
                t.history.push(auditRow({ by: WHL_BOT, action: "REPORT", target: p.name, before, after: next, note: `From report ${stored.reportNo}${p.note ? ` — ${p.note}` : ""}` }));
              }
              b.labEmails ??= [];
              b.labEmails.unshift({
                id: uid("em"), direction: "IN", lotId, lotCode: l.lotCode, mpn: l.orderLineMpn,
                workOrderNo: l.workOrderNo, poNo: l.clientPoNo, subject: `WHL Report ${stored.reportNo} — ${l.orderLineMpn} (Lot ${l.lotCode})`,
                body: `Report ${stored.reportNo} issued. Overall conclusion: ${stored.conclusion.replace(/_/g, " ")}${stored.anyFar ? " (one or more processes F.A.R.)" : ""}.`,
                at: stamp(), by: "WHL Reports", status: "REPORT_DELIVERED", kind: "REPORT", attachments: [stored.fileName],
              });
              b.documents.push({ id: uid("doc"), subjectType: "LOT", docType: "WHL_REPORT", fileName: stored.fileName, uploadedBy: "WHL (email)", uploadedAt: today() });
              // an unanswered chase is now answered
              l.lastUpdateRequestAt = undefined;
              const pending = b.labEmails.filter((m) => m.lotId === lotId && m.direction === "OUT" && m.status === "AWAITING_RESPONSE");
              pending.forEach((m) => { m.status = "UPDATE_RECEIVED"; });
              // lifecycle: the report landing is the end of the chain
              moveStage(l, "REPORT_SHARED", WHL_BOT, {
                note: `Report ${stored.reportNo} received — ${stored.conclusion.replace(/_/g, " ").toLowerCase()}${stored.anyFar ? " (a process came back F.A.R.)" : ""}.`,
              });
            });
            const st = conclusionToLotStatus(rep.conclusion, rep.anyFar);
            if (st === "PASS") toast.success(`${rep.reportNo} — Acceptable`);
            else if (st === "FAIL") toast.error(`${rep.reportNo} — ${rep.conclusion.replace(/_/g, " ").toLowerCase()}`);
            else toast.warning(`${rep.reportNo} — Acceptable, but a process came back F.A.R.`);
          } catch (e) { toast.error(`WHL: ${errMsg(e)}`); }
        })();
      },

      // Pre-mapped chase — no looking up WHL's address or the work-order number by hand.
      requestWhlUpdate: (orderId, lotId) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        const lot = b0.lots.find((x) => x.id === lotId); if (!lot) return;
        const tpl = whlTemplate("STATUS_REQUEST");
        const ctx = {
          entity: b0.maskingEntity, mpn: lot.orderLineMpn, lotCode: lot.lotCode, qty: lot.qty, sampleQty: lot.sampleQty,
          workOrderNo: lot.workOrderNo, clientPoNo: lot.clientPoNo, reportNo: lot.reportNo, lab: lot.lab, dateCode: lot.dateCode,
        };
        get().sendLabEmail(orderId, { lotId, subject: tpl.subject(ctx), body: tpl.body(ctx) });
        set((s) => { const l = s.orders[orderId]?.lots.find((x) => x.id === lotId); if (l) l.lastUpdateRequestAt = today(); });
      },

      sendLabEmail: (orderId, m) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        const lot = m.lotId ? b0.lots.find((x) => x.id === m.lotId) : undefined;
        const emId = uid("em");
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          b.labEmails ??= [];
          b.labEmails.unshift({
            id: emId, direction: "OUT", lotId: m.lotId, lotCode: lot?.lotCode, mpn: lot?.orderLineMpn,
            workOrderNo: lot?.workOrderNo, poNo: lot?.clientPoNo, subject: m.subject, body: m.body,
            at: stamp(), by: ME, status: "AWAITING_RESPONSE", kind: m.subject.startsWith("Status request") ? "REQUEST_UPDATE" : "CUSTOM",
          });
        });
        toast.message(`Sending to ${WHL_CONTACT}…`);
        void (async () => {
          try {
            await whlSendMail({ to: WHL_CONTACT, subject: m.subject, body: m.body, workOrderNo: lot?.workOrderNo, lotCode: lot?.lotCode, mpn: lot?.orderLineMpn, poNo: lot?.clientPoNo });
            toast.success("Email sent to WHL — logged against the lot");
          } catch (e) {
            set((s) => { const em = s.orders[orderId]?.labEmails?.find((x) => x.id === emId); if (em) { em.status = "ESCALATED"; em.matchNote = `Send failed — ${errMsg(e)}. Retry.`; } });
            toast.error(`Mail: ${errMsg(e)}`);
          }
        })();
      },

      // Inbound mail drives the tracker. Mails that can't be matched go to a manual-match queue.
      syncWhlInbox: (orderId) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        // the lot's current stage goes with the request so the lab answers with the
        // mail that plausibly comes next, rather than one for a stage already passed
        const wos = b0.lots.filter((l) => !!l.workOrderNo).map((l) => ({
          workOrderNo: l.workOrderNo!, lotCode: l.lotCode, mpn: l.orderLineMpn, testNames: (l.tests ?? []).map((t) => t.name),
          stage: lotStage(l),
        }));
        if (wos.length === 0) { toast.error("No WHL work orders on this order yet."); return; }
        toast.message("Checking the WHL mailbox…");
        void (async () => {
          try {
            const res = await whlPollInbox({ workOrders: wos });
            let matched = 0, unmatched = 0;
            const advanced: string[] = [];
            set((s) => {
              const b = s.orders[orderId]; if (!b) return;
              b.labEmails ??= [];
              for (const msg of res.messages) {
                const lot = msg.lotCode ? b.lots.find((l) => l.lotCode === msg.lotCode)
                  : msg.workOrderNo ? b.lots.find((l) => l.workOrderNo === msg.workOrderNo) : undefined;
                const em: LabEmail = {
                  id: uid("em"), direction: "IN", lotId: lot?.id, lotCode: lot?.lotCode, mpn: lot?.orderLineMpn,
                  workOrderNo: msg.workOrderNo, poNo: lot?.clientPoNo, subject: msg.subject, body: msg.body,
                  at: msg.receivedAt, by: "WHL Reports",
                  status: !lot ? "AWAITING_RESPONSE" : msg.kind === "REPORT" ? "REPORT_DELIVERED" : "UPDATE_RECEIVED",
                  kind: msg.kind === "REPORT" ? "REPORT" : "STATUS_UPDATE", attachments: msg.attachments,
                  matchNote: lot ? undefined : "Subject line carries no work order, lot or report number — match it manually.",
                };
                b.labEmails.unshift(em);
                if (!lot) { unmatched++; continue; }
                matched++;
                // refresh the per-test tracker from the mail's interim statuses
                for (const u of msg.testUpdates ?? []) {
                  lot.tests ??= [];
                  let t = lot.tests.find((x) => x.name === u.name);
                  if (!t) { t = { id: uid("lt"), name: u.name, source: "AUTO_PO", status: "PENDING", history: [] }; lot.tests.push(t); }
                  const before = t.status;
                  if (before === "PASSED" || before === "FAILED") continue; // a report already settled this test
                  t.status = u.status; t.updatedAt = msg.receivedAt;
                  t.history.push(auditRow({ by: WHL_BOT, action: "STATUS", target: u.name, before, after: u.status, note: u.note ?? msg.subject, sourceEmailId: em.id }));
                }
                if (msg.kind === "REPORT") lot.lastUpdateRequestAt = undefined;
                // lifecycle: the mail says where the lot now is (receipt / started / in
                // progress / report being written). Forward-only, so a late-arriving
                // interim mail can't drag a finished lot back down the chain.
                if (msg.stage && moveStage(lot, msg.stage, WHL_BOT, { note: msg.subject, sourceEmailId: em.id })) {
                  advanced.push(`${lot.lotCode} → ${TESTING_STAGE_META[msg.stage].label}`);
                }
                b.labEmails.filter((x) => x.lotId === lot.id && x.direction === "OUT" && x.status === "AWAITING_RESPONSE")
                  .forEach((x) => { x.status = "UPDATE_RECEIVED"; });
              }
            });
            if (advanced.length) toast.success(advanced.join(" · "));
            else toast.success(`${matched} update(s) applied${unmatched ? ` · ${unmatched} need manual matching` : ""}`);
          } catch (e) { toast.error(`WHL inbox: ${errMsg(e)}`); }
        })();
      },

      matchLabEmail: (orderId, emailId, lotId) => {
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          const em = b.labEmails?.find((x) => x.id === emailId); if (!em) return;
          const lot = b.lots.find((l) => l.id === lotId); if (!lot) return;
          em.lotId = lot.id; em.lotCode = lot.lotCode; em.mpn = lot.orderLineMpn;
          em.workOrderNo = em.workOrderNo ?? lot.workOrderNo; em.poNo = lot.clientPoNo;
          em.matchedBy = ME; em.matchNote = undefined;
          em.status = em.kind === "REPORT" ? "REPORT_DELIVERED" : "UPDATE_RECEIVED";
          const spec = (b.mpnTests ?? []).find((x) => x.mpn === lot.orderLineMpn);
          spec?.audit.push(auditRow({ by: ME, action: "EMAIL", target: lot.lotCode, after: "matched inbound mail", note: em.subject, sourceEmailId: em.id }));
        });
        toast.success("Email matched to the lot");
      },

      escalateLabEmail: (orderId, emailId) => {
        set((s) => { const em = s.orders[orderId]?.labEmails?.find((x) => x.id === emailId); if (em) em.status = "ESCALATED"; });
        toast.warning("Thread marked escalated");
      },

      // Reports carry NDA language — every view/download is logged, internal-only.
      logReportAccess: (orderId, lotId, reportId, action) => {
        set((s) => {
          const r = s.orders[orderId]?.lots.find((x) => x.id === lotId)?.reports?.find((x) => x.id === reportId);
          if (r) r.accessLog.unshift({ at: stamp(), by: ME, action });
        });
      },

      reconcileReportPo: (orderId, lotId, reportId) => {
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          const lot = b.lots.find((x) => x.id === lotId); if (!lot) return;
          const r = lot.reports?.find((x) => x.id === reportId); if (!r) return;
          const before = r.clientPo;
          const onFile = lot.clientPoNo ?? b.sourcingAllocations.find((a) => a.orderLineMpn === lot.orderLineMpn)?.clientPoNo;
          if (!onFile) { toast.error("No client PO on file for this lot — map it on the Allocations tab first."); return; }
          r.clientPo = onFile;
          r.parseFlags = r.parseFlags.filter((f) => !f.toLowerCase().includes("client p/o"));
          const spec = (b.mpnTests ?? []).find((x) => x.mpn === lot.orderLineMpn);
          spec?.audit.push(auditRow({ by: ME, action: "RECONCILE", target: r.reportNo, before, after: onFile, note: "Report Client P/O reconciled against the PO on file." }));
        });
        toast.success("Client P/O reconciled");
      },

      // "Result is in — who do we tell." One action per counterparty; the report PDF rides
      // along when the operator ticks it. Escrow notifications also land on the escrow ledger.
      notifyLotResult: (orderId, lotId, m) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        const lot = b0.lots.find((x) => x.id === lotId); if (!lot) return;
        const rep = (lot.reports ?? []).find((r) => r.current) ?? (lot.reports ?? [])[0];
        const attachments = m.attachReport && rep ? [rep.fileName] : [];
        const noteFor: Record<NotifyParty, string> = {
          SUPPLIER: "Masked — buyer identity, client PO and sell price withheld.",
          BUYER: "Masked — supplier identity, buy price and inbound AWB withheld.",
          ESCROW: "Release-trigger evidence for the escrow provider.",
          WHL: "Acknowledgement to the laboratory.",
        };
        const nId = uid("ntf");
        set((s) => {
          const l = s.orders[orderId]?.lots.find((x) => x.id === lotId); if (!l) return;
          (l.notifications ??= []).unshift({
            id: nId, party: m.party, to: m.to, subject: m.subject, body: m.body, attachments,
            reportNo: rep?.reportNo, at: stamp(), by: ME, status: "SENT",
            note: attachments.length ? `${noteFor[m.party]} Report shared under NDA — internal use by the recipient only.` : noteFor[m.party],
          });
        });
        toast.message(`Notifying ${m.party.toLowerCase()}…`);
        void (async () => {
          try {
            const res = await sendPartyNotification({
              party: m.party, to: m.to, subject: m.subject, body: m.body, attachments,
              orderNo: b0.orderNo, lotCode: lot.lotCode, reportNo: rep?.reportNo,
            });
            set((s) => {
              const bb = s.orders[orderId]; if (!bb) return;
              bb.events.unshift({
                id: uid("ev"), eventType: "GENERAL",
                message: `${lot.lotCode} (${lot.orderLineMpn}) result ${rep ? `${rep.reportNo} — ${rep.conclusion.replace(/_/g, " ").toLowerCase()}` : ""} notified to ${m.party.toLowerCase()} (${res.to})${attachments.length ? " with the report attached" : ""}.`,
                source: "NOTIFY", occurredAt: today(), recordedBy: ME,
              });
              // escrow gets a ledger marker so the release decision has a paper trail
              if (m.party === "ESCROW" && bb.escrow) {
                bb.escrow.events.push({
                  id: uid("ee"), type: "HOLD", amount: 0,
                  trigger: `Lab result shared with HKIN — ${lot.lotCode}${rep ? ` (${rep.reportNo}, ${rep.conclusion.replace(/_/g, " ").toLowerCase()})` : ""}`,
                  occurredAt: today(),
                });
              }
              // the lab acknowledgement belongs on the WHL thread as well
              if (m.party === "WHL") {
                (bb.labEmails ??= []).unshift({
                  id: uid("em"), direction: "OUT", lotId, lotCode: lot.lotCode, mpn: lot.orderLineMpn,
                  workOrderNo: lot.workOrderNo, poNo: lot.clientPoNo, subject: m.subject, body: m.body,
                  at: stamp(), by: ME, status: "SENT", kind: "CUSTOM",
                });
              }
            });
            toast.success(`${m.party[0]}${m.party.slice(1).toLowerCase()} notified (${res.messageId})`);
          } catch (e) {
            set((s) => {
              const n = s.orders[orderId]?.lots.find((x) => x.id === lotId)?.notifications?.find((x) => x.id === nId);
              if (n) { n.status = "FAILED"; n.note = `Send failed — ${errMsg(e)}. Retry.`; }
            });
            toast.error(`Notify: ${errMsg(e)}`);
          }
        })();
      },

      // Bulk sibling of notifyLotResult: ONE mail for many lots. The notification row is
      // written onto every lot it covered, so each lot's trail still shows who was told.
      notifyLotsResult: (orderId, lotIds, m) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        const lots = b0.lots.filter((l) => lotIds.includes(l.id));
        if (lots.length === 0) { toast.error("No lots selected."); return; }
        const reportOf = (l: (typeof lots)[number]) => (l.reports ?? []).find((r) => r.current) ?? (l.reports ?? [])[0];
        const attachments = m.attachReports
          ? Array.from(new Set(lots.map((l) => reportOf(l)?.fileName).filter((f): f is string => !!f)))
          : [];
        const coverage = `Sent as one digest covering ${lots.length} lot(s): ${lots.map((l) => l.lotCode).join(", ")}.`;
        const nIds = lots.map((l) => ({ lotId: l.id, id: uid("ntf") }));
        set((s) => {
          const bb = s.orders[orderId]; if (!bb) return;
          for (const { lotId, id: nId } of nIds) {
            const l = bb.lots.find((x) => x.id === lotId); if (!l) continue;
            (l.notifications ??= []).unshift({
              id: nId, party: m.party, to: m.to, subject: m.subject, body: m.body, attachments,
              reportNo: reportOf(l)?.reportNo, at: stamp(), by: ME, status: "SENT",
              note: `${coverage}${attachments.length ? " Report(s) shared under NDA — internal use by the recipient only." : ""}`,
            });
          }
        });
        toast.message(`Notifying ${m.party.toLowerCase()} about ${lots.length} lot(s)…`);
        void (async () => {
          try {
            const res = await sendPartyNotification({
              party: m.party, to: m.to, subject: m.subject, body: m.body, attachments,
              orderNo: b0.orderNo, lotCode: lots.map((l) => l.lotCode).join(","),
            });
            set((s) => {
              const bb = s.orders[orderId]; if (!bb) return;
              bb.events.unshift({
                id: uid("ev"), eventType: "GENERAL",
                message: `${lots.length} lot(s) (${lots.map((l) => l.lotCode).join(", ")}) notified to ${m.party.toLowerCase()} (${res.to}) in one digest${attachments.length ? ` with ${attachments.length} report(s) attached` : ""}.`,
                source: "NOTIFY", occurredAt: today(), recordedBy: ME,
              });
              if (m.party === "ESCROW" && bb.escrow) {
                bb.escrow.events.push({
                  id: uid("ee"), type: "HOLD", amount: 0,
                  trigger: `Lab results shared with HKIN — ${lots.length} lot(s): ${lots.map((l) => `${l.lotCode}${reportOf(l) ? ` (${reportOf(l)!.reportNo})` : ""}`).join(", ")}`,
                  occurredAt: today(),
                });
              }
              if (m.party === "WHL") {
                (bb.labEmails ??= []).unshift({
                  id: uid("em"), direction: "OUT", subject: m.subject, body: m.body,
                  lotId: lots[0].id, lotCode: lots.map((l) => l.lotCode).join(", "), mpn: lots[0].orderLineMpn,
                  at: stamp(), by: ME, status: "SENT", kind: "CUSTOM",
                });
              }
            });
            toast.success(`${lots.length} lot(s) notified to ${m.party.toLowerCase()} (${res.messageId})`);
          } catch (e) {
            set((s) => {
              const bb = s.orders[orderId]; if (!bb) return;
              for (const { lotId, id: nId } of nIds) {
                const n = bb.lots.find((x) => x.id === lotId)?.notifications?.find((x) => x.id === nId);
                if (n) { n.status = "FAILED"; n.note = `Send failed — ${errMsg(e)}. Retry.`; }
              }
            });
            toast.error(`Notify: ${errMsg(e)}`);
          }
        })();
      },

      addSourcingAllocation: (orderId, a) => {
        const st = get();
        const b = st.orders[orderId]; if (!b) return false;
        // masked part trade: you can only fulfil demand for part X with part X
        if (a.clientLineMpn !== a.orderLineMpn) { toast.error(`Can't map ${a.orderLineMpn} to a ${a.clientLineMpn} demand line — parts must match.`); return false; }
        const line = b.lines.find((l) => l.id === a.orderLineId);
        const orderUnmapped = line ? line.quantity - mappedForOrderLine(b, line) : 0;
        const demand = st.clientPos.find((c) => c.clientPoNo === a.clientPoNo)?.lines.find((l) => l.mpn === a.clientLineMpn)?.qty ?? 0;
        const clientRemaining = demand - sourcedForClientLine(st.supplierPos, st.orders, a.clientPoNo, a.clientLineMpn);
        const cap = Math.min(orderUnmapped, clientRemaining);
        if (a.qty <= 0 || a.qty > cap) { toast.error(`Qty 1–${Math.max(0, cap)} (order-line unmapped ${Math.max(0, orderUnmapped)}, client remaining ${Math.max(0, clientRemaining)}).`); return false; }
        const priceFor = (poNo: string, mpn: string) => st.clientPos.find((c) => c.clientPoNo === poNo)?.lines.find((l) => l.mpn === mpn)?.unitPrice ?? 0;
        set((s) => {
          const bb = s.orders[orderId]; if (!bb) return;
          bb.sourcingAllocations.push({ id: uid("sa"), ...a });
          // map-later realizes the client price → recompute sell + buyer so the header stops showing 0% / "Unlinked"
          let sell = 0;
          for (const l of bb.lines) {
            const mapped = bb.sourcingAllocations.filter((x) => (x.orderLineId ? x.orderLineId === l.id : x.orderLineMpn === l.mpn));
            const mappedQty = mapped.reduce((t, x) => t + x.qty, 0);
            for (const x of mapped) sell += priceFor(x.clientPoNo, x.clientLineMpn) * x.qty;
            sell += Math.max(0, l.quantity - mappedQty) * l.unitPrice; // still-unmapped qty valued at buy (0 margin)
          }
          bb.sellTotal = Math.round(sell);
          const names = new Set(bb.sourcingAllocations.map((x) => st.clientPos.find((c) => c.clientPoNo === x.clientPoNo)?.client.name ?? "—"));
          bb.buyer = { ...bb.buyer, name: names.size === 0 ? "Unlinked (map later)" : names.size === 1 ? [...names][0] : "Multiple clients" };
        });
        toast.success(`Mapped ${a.qty} → ${a.clientPoNo}`);
        return true;
      },

      // HKIN escrow adapter. Fixes the old bug where edited A1/A2 were discarded, and gives a real escrowRef.
      fundEscrow: (orderId, input) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        const material = input.material, charges = input.charges, banking = input.bankingCharges ?? b0.escrow?.bankingCharges ?? 0;
        const siTotal = material + charges + banking + 450;
        toast.message("Opening + funding HKIN escrow…");
        void (async () => {
          try {
            const cur = get().orders[orderId]; if (!cur) return;
            const hasRef = cur.escrow && cur.escrow.externalRef && cur.escrow.externalRef !== "—";
            const opened = hasRef
              ? { escrowRef: cur.escrow!.externalRef, superInvoiceTotal: siTotal }
              : await hkinOpenAccount({ orderRef: cur.orderNo, currency: cur.currency, materialAmount: material, chargesAmount: charges + banking, feeSeller: 300, feeBuyer: 150, buyerToken: buyerToken(cur.buyer.name), sellerToken: sellerToken(cur.supplier.name), releaseTrigger: cur.escrow?.releaseTrigger ?? "WHL PASS" });
            const funded = await hkinFundSuperInvoice({ escrowRef: opened.escrowRef, amount: siTotal, material });
            set((s) => {
              const b = s.orders[orderId]; if (!b) return;
              if (!b.escrow) b.escrow = { id: uid("esc"), provider: input.provider, externalRef: opened.escrowRef, currency: b.currency, materialAmount: material, chargesAmount: charges, bankingCharges: banking, feeSeller: 300, feeBuyer: 150, superInvoiceTotal: siTotal, releaseTrigger: "WHL PASS", paymentTerms: b.terms?.paymentMethod, expiryDate: addDays(b.createdAt, 45), status: "FUNDED", events: [] };
              else { b.escrow.materialAmount = material; b.escrow.chargesAmount = charges; b.escrow.bankingCharges = banking; b.escrow.superInvoiceTotal = siTotal; b.escrow.externalRef = opened.escrowRef; b.escrow.status = "FUNDED"; }
              b.escrow.events.push({ id: uid("ee"), type: "FUND", amount: funded.heldAmount, trigger: `Buyer funded super-invoice (HKIN ${funded.providerTxnId})`, occurredAt: today() });
            });
            toast.success("Escrow funded via HKIN");
          } catch (e) { toast.error(`HKIN: ${errMsg(e)}`); }
        })();
      },
      requestEscrowExtension: (orderId, input) => {
        const b0 = get().orders[orderId]; if (!b0?.escrow) return;
        // store-level pending guard (don't rely on the UI alone to prevent a double-request)
        if (b0.escrow.extensions?.some((x) => x.status === "REQUESTED")) { toast.error("An extension request is already pending."); return; }
        const extId = uid("ext");
        set((s) => {
          const e = s.orders[orderId]?.escrow; if (!e) return;
          (e.extensions ??= []).push({ id: extId, reason: input.reason, newDate: input.newDate, status: "REQUESTED", requestedAt: today() });
          e.events.push({ id: uid("ee"), type: "HOLD", amount: 0, trigger: `Extension requested → ${input.newDate} (${input.reason})`, occurredAt: today() });
        });
        toast.message("Extension request emailed to counterparty…");
        void (async () => {
          try {
            const res = await hkinRequestExtension({ escrowRef: b0.escrow!.externalRef, reason: input.reason, newDate: input.newDate });
            set((s) => {
              const e = s.orders[orderId]?.escrow; if (!e) return;
              const ext = e.extensions?.find((x) => x.id === extId); if (!ext) return;
              ext.status = res.status; ext.respondedAt = today();
              if (res.status === "APPROVED") { e.expiryDate = res.newExpiry; e.events.push({ id: uid("ee"), type: "HOLD", amount: 0, trigger: `Extension APPROVED → expiry ${res.newExpiry}`, occurredAt: today() }); }
              else e.events.push({ id: uid("ee"), type: "HOLD", amount: 0, trigger: "Extension DECLINED by counterparty", occurredAt: today() });
            });
            toast[res.status === "APPROVED" ? "success" : "error"](`Extension ${res.status.toLowerCase()}`);
          } catch (e) {
            // ROLLBACK: drop the optimistic REQUESTED row so pendingExt clears and the user can retry
            set((s) => {
              const e2 = s.orders[orderId]?.escrow; if (!e2) return;
              e2.extensions = e2.extensions?.filter((x) => x.id !== extId);
              e2.events.push({ id: uid("ee"), type: "HOLD", amount: 0, trigger: "Extension request failed — please retry", occurredAt: today() });
            });
            toast.error(`HKIN: ${errMsg(e)}`);
          }
        })();
      },
      releaseEscrow: (orderId, amount, trigger) => {
        const b = get().orders[orderId]; if (!b?.escrow) return;
        if (b.escrow.status === "OPEN") { toast.error("Fund the escrow before releasing any tranche."); return; }
        if (b.escrow.status === "REFUNDED") { toast.error("Escrow was refunded — nothing to release."); return; }
        // require a lab PASS only when the order is actually tested (fixes the ESCROW + testing=NONE trap)
        const needsPass = b.lines.some((l) => l.testingMode !== "NONE");
        if (needsPass && !b.lots.some((l) => l.testStatus === "PASS")) { toast.error("Release requires a lab PASS first (that's what the escrow protects)."); return; }
        const amt = Math.min(amount, escrowRemaining(b));
        if (amt <= 0) return;
        toast.message("Releasing tranche via HKIN…");
        void (async () => {
          try {
            const res = await hkinReleaseTranche({ escrowRef: b.escrow!.externalRef, amount: amt, remaining: escrowRemaining(b), trigger: trigger ?? (needsPass ? "WHL PASS" : "GRN accepted") });
            set((s) => {
              const bo = s.orders[orderId]; const e = bo?.escrow; if (!bo || !e) return;
              // re-derive the cap at commit time so a concurrent release can't over-release past A1
              const capNow = escrowRemaining(bo);
              const applied = Math.min(res.releasedNow, capNow);
              if (applied <= 0) { toast.message("Already released — nothing left to release."); return; }
              e.events.push({ id: uid("ee"), type: "RELEASE", amount: applied, trigger: trigger ?? "Release (HKIN)", occurredAt: today() });
              e.status = (capNow - applied) <= 0 ? "RELEASED" : "PARTIALLY_RELEASED";
            });
            toast.success("Escrow tranche released");
          } catch (e) { toast.error(`HKIN: ${errMsg(e)}`); }
        })();
      },
      // HARDENED: refund guards status/amount/reason and re-derives the cap at commit time.
      refundEscrow: (orderId, amount, trigger) => {
        const b = get().orders[orderId]; if (!b?.escrow) return;
        if (b.escrow.status === "OPEN") { toast.error("Nothing to refund — escrow was never funded."); return; }
        if (b.escrow.status === "REFUNDED") { toast.error("Escrow already refunded."); return; }
        const hasFail = b.lots.some((l) => l.testStatus === "FAIL");
        if (!hasFail && !trigger) { toast.error("Refund is for a FAIL / cancellation — no failed lot on this order."); return; }
        const amt = Math.min(amount, escrowRemaining(b));
        if (amt <= 0) { toast.error("No remaining escrow to refund."); return; }
        toast.message("Refunding via HKIN…");
        void (async () => {
          try {
            const res = await hkinRefund({ escrowRef: b.escrow!.externalRef, amount: amt, reason: trigger ?? "Refund on FAIL" });
            set((s) => {
              const bo = s.orders[orderId]; const e = bo?.escrow; if (!bo || !e) return;
              const capNow = escrowRemaining(bo);
              const applied = Math.min(res.amount, capNow);
              if (applied <= 0) { toast.message("Nothing left to refund."); return; }
              e.events.push({ id: uid("ee"), type: "REFUND", amount: applied, trigger: trigger ?? "Refund on FAIL", occurredAt: today() });
              e.status = "REFUNDED";
            });
            toast.success("Escrow refunded");
          } catch (e) { toast.error(`HKIN: ${errMsg(e)}`); }
        })();
      },

      addPayment: (orderId, p) => { set((s) => {
        const b = s.orders[orderId]; if (!b) return;
        b.payments.push({ id: uid("pay"), direction: p.direction, mode: p.mode, triggerDoc: p.triggerDoc, amount: p.amount, currency: b.currency, status: "PENDING", dueDate: p.dueDate });
      }); toast.success("Payment task created"); },
      setPaymentStatus: (orderId, payId, status) => {
        set((s) => { const p = s.orders[orderId]?.payments.find((x) => x.id === payId); if (p) { p.status = status; if (status === "PAID") p.paidAt = today(); } });
        toast.success(`Payment ${status.toLowerCase()}`);
      },
      // Banking adapter: initiate the T/T → INITIATED (providerRef), then poll clearing → PAID (UTR).
      initiatePaymentTransfer: (orderId, payId) => {
        const p0 = get().orders[orderId]?.payments.find((x) => x.id === payId);
        const b = get().orders[orderId];
        if (!p0 || !b) return;
        if (p0.status === "PAID") { toast("Already paid"); return; }
        const beneficiary = p0.direction === "CLIENT_TO_1BUY" ? "SHARPBUY-NOSTRO" : b.supplier.name;
        toast.message("Initiating T/T…");
        void (async () => {
          try {
            const ack = await bankInitiateTransfer({ payId, direction: p0.direction, amount: p0.amount, currency: p0.currency, beneficiary });
            set((s) => { const p = s.orders[orderId]?.payments.find((x) => x.id === payId); if (p) { p.status = "INITIATED"; p.providerRef = ack.providerRef; } });
            toast.success(`T/T initiated (${ack.providerRef})`);
            const cleared = await bankGetTransferStatus(ack.providerRef, p0.amount);
            set((s) => { const p = s.orders[orderId]?.payments.find((x) => x.id === payId); if (p) { p.status = cleared.status === "CLEARED" ? "PAID" : "CANCELLED"; if (cleared.status === "CLEARED") { p.paidAt = today(); p.utr = cleared.utr; } } });
            toast.success(cleared.status === "CLEARED" ? `Cleared — UTR ${cleared.utr}` : "Transfer returned");
          } catch (e) { toast.error(`Banking: ${errMsg(e)}`); }
        })();
      },

      createShipment: (orderId, input) => {
        const b = get().orders[orderId]; if (!b) return null;
        const lines = input.lines.map((l) => ({ mpn: l.mpn, qty: Math.min(l.qty, remainingToShipLeg(b, l.mpn, input.leg)) })).filter((l) => l.qty > 0);
        if (lines.length === 0) { toast.error("Nothing to ship (qty exceeds remaining for this leg)"); return null; }
        const id = uid("shp");
        const shipmentNo = `SHP-${input.leg === "INBOUND" ? "IN" : "OUT"}-${b.shipments.length + 1}`;
        set((s) => {
          const bb = s.orders[orderId]; if (!bb) return;
          bb.shipments.push({ id, shipmentNo, leg: input.leg, awb: "booking…", carrier: input.carrier, fromLocation: input.fromLocation, toLocation: input.toLocation,
            boxCount: input.boxCount, grossWeightKg: input.grossWeightKg, status: "PLANNED", lines });
        });
        toast.message("Booking AWB with carrier…");
        // Logistics adapter: the carrier assigns the real AWB + tracking URL asynchronously
        void (async () => {
          try {
            const booked = await bookShipment({ carrier: (input.carrier as Carrier) || "DHL", leg: input.leg, reference: shipmentNo, from: input.fromLocation, to: input.toLocation, pieces: input.boxCount, weightKg: input.grossWeightKg });
            set((s) => { const sh = s.orders[orderId]?.shipments.find((x) => x.id === id); if (sh) { sh.awb = booked.awb; sh.carrierRef = booked.carrierRef; sh.trackingUrl = booked.trackingUrl; } });
            toast.success(`AWB booked: ${booked.awb}`);
          } catch (e) { set((s) => { const sh = s.orders[orderId]?.shipments.find((x) => x.id === id); if (sh) sh.awb = "booking failed"; }); toast.error(`Logistics: ${errMsg(e)}`); }
        })();
        toast.success("Shipment created");
        return id;
      },
      setShipmentStatus: (orderId, shipId, status) => {
        set((s) => { const sh = s.orders[orderId]?.shipments.find((x) => x.id === shipId);
          if (sh) { sh.status = status; if (status === "DISPATCHED") sh.dispatchDate = today(); if (status === "DELIVERED" || status === "ARRIVED") sh.deliveryDate = today(); } });
      },
      // Logistics adapter: poll the carrier and advance the shipment one checkpoint.
      pollShipmentTracking: (orderId, shipId) => {
        const sh = get().orders[orderId]?.shipments.find((x) => x.id === shipId);
        if (!sh) return;
        if (sh.awb === "booking…" || sh.awb === "booking failed") { toast.error("AWB not booked yet."); return; }
        const trackSeq: ShipmentStatus[] = ["DISPATCHED", "IN_TRANSIT", "AT_CUSTOMS", "ARRIVED", "DELIVERED"];
        const hopsDone = trackSeq.indexOf(sh.status) + 1; // PLANNED → 0 → first checkpoint
        toast.message("Polling carrier tracking…");
        void (async () => {
          try {
            const t = await getTracking(sh.awb, hopsDone, sh.fromLocation, sh.toLocation);
            set((s) => { const x = s.orders[orderId]?.shipments.find((y) => y.id === shipId); if (x) { x.status = t.mappedStatus; x.lastLocation = t.lastLocation; if (t.mappedStatus === "DISPATCHED") x.dispatchDate = today(); if (t.mappedStatus === "DELIVERED" || t.mappedStatus === "ARRIVED") x.deliveryDate = today(); } });
            toast.success(`Tracking: ${t.mappedStatus} · ${t.lastLocation}`);
          } catch (e) { toast.error(`Logistics: ${errMsg(e)}`); }
        })();
      },

      // ICEGATE adapter: file → assess (duty) → clearance (issues the real ICEGATE ref). No hand-typed ref anymore.
      fileBOE: (orderId, e) => {
        const b0 = get().orders[orderId]; if (!b0) return;
        const ceId = uid("ce");
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          const existing = b.customs.find((c) => c.shipmentNo === e.shipmentNo);
          const entry = { id: existing?.id ?? ceId, shipmentNo: e.shipmentNo, beNo: "filing…", beDate: today(), portCode: e.portCode, chaName: e.chaName, currency: "INR", totalDuty: undefined, icegateRef: undefined, filedAt: undefined };
          if (existing) Object.assign(existing, entry); else b.customs.push(entry);
        });
        toast.message("Filing BOE with ICEGATE…");
        void (async () => {
          try {
            const filed = await fileBillOfEntry({ orderId, shipmentNo: e.shipmentNo, portCode: e.portCode, chaName: e.chaName, assessableValue: e.assessableValue });
            const assessed = await getAssessment(filed.beNo, e.assessableValue);
            const cleared = await getClearanceStatus(filed.beNo);
            set((s) => {
              const c = s.orders[orderId]?.customs.find((x) => x.shipmentNo === e.shipmentNo);
              if (c) { c.beNo = filed.beNo; c.beDate = filed.beDate; c.totalDuty = assessed.duty.totalDuty; c.icegateRef = cleared.icegateRef; c.filedAt = cleared.oocDate; }
            });
            toast.success(`BOE ${filed.beNo} cleared — ICEGATE ${cleared.icegateRef}`);
          } catch (err) { toast.error(`ICEGATE: ${errMsg(err)}`); }
        })();
      },

      allocateDelivery: (orderId, a) => {
        const b = get().orders[orderId]; if (!b) return false;
        // segregation guard: only deliver to a client line THIS order actually sourced, and never past what it owes
        const committed = orderSourcedForClient(b, a.clientPoNo, a.clientLineMpn);
        if (committed <= 0) { toast.error(`This order didn't source ${a.clientLineMpn} for ${a.clientPoNo} — map it first (Allocations tab).`); return false; }
        const physical = remainingToAllocate(b, a.clientLineMpn);
        const clientRemaining = committed - deliveredForClientLine(b, a.clientPoNo, a.clientLineMpn);
        const cap = Math.min(physical, clientRemaining);
        if (a.qty <= 0 || a.qty > cap) { toast.error(`Qty 1–${Math.max(0, cap)} (received ${physical}, still owed to this client ${Math.max(0, clientRemaining)}).`); return false; }
        set((s) => { s.orders[orderId]?.deliveries.push({ id: uid("da"), fromShipmentNo: a.fromShipmentNo, clientPoNo: a.clientPoNo, clientLineMpn: a.clientLineMpn, qty: a.qty, decidedBy: "You (demo)", decidedAt: today() }); });
        toast.success(`Allocated ${a.qty} → ${a.clientPoNo}`);
        return true;
      },
      recordPoD: (orderId, deliveryId) => {
        set((s) => { const d = s.orders[orderId]?.deliveries.find((x) => x.id === deliveryId); if (d) d.pod = today(); });
        toast.success("Proof of delivery recorded");
      },

      // GST e-Invoice / IRP adapter. Seller is ALWAYS the masking entity — supplier is never sent.
      generateEInvoice: (orderId) => {
        const b = get().orders[orderId]; if (!b) return;
        if (b.einvoice?.irn) { toast("IRN already generated for this order"); return; }
        const intl = b.tradeType === "INTERNATIONAL";
        toast.message("Generating IRN via IRP…");
        void (async () => {
          try {
            const igst = Math.round(b.sellTotal * 0.18);
            const res = await generateIrn({ supplyType: intl ? "EXPWOP" : "B2B", sellerGstin: SHARPBUY_GSTIN, buyerGstin: intl ? "URP" : "33AALCG9069K1Z0", docNo: b.orderNo, totalValue: b.sellTotal, igst });
            set((s) => {
              const bb = s.orders[orderId]; if (!bb) return;
              bb.einvoice = { irn: res.irn, ackNo: res.ackNo, signedQRCode: res.signedQRCode, generatedAt: res.ackDt, supplyType: intl ? "EXPWOP" : "B2B" };
              bb.documents.push({ id: uid("doc"), subjectType: "ORDER", docType: "TAX_INVOICE", fileName: `e-invoice-${res.ackNo}.pdf`, uploadedBy: "IRP (mock)", uploadedAt: today() });
              bb.events.unshift({ id: uid("ev"), eventType: "GENERAL", message: `GST e-Invoice IRN generated (ack ${res.ackNo}).`, source: "IRP", occurredAt: today(), recordedBy: "IRP (mock)" });
            });
            toast.success(`IRN generated (ack ${res.ackNo})`);
          } catch (e) { toast.error(`IRP: ${errMsg(e)}`); }
        })();
      },

      // Exception path: cancel a stranded/rejected order and release its supplier PO back to DRAFT.
      cancelOrder: (orderId) => {
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          b.status = "CANCELLED";
          b.journey.forEach((j) => { if (j.status === "IN_PROGRESS" || j.status === "BLOCKED") j.status = "SKIPPED"; });
          if (b.supplierPoId) { const spo = s.supplierPos.find((x) => x.id === b.supplierPoId); if (spo) { spo.status = "DRAFT"; spo.orderId = undefined; } }
          b.events.unshift({ id: uid("ev"), eventType: "GENERAL", message: "Order cancelled; supplier PO released back to draft.", source: "SC_MANUAL", occurredAt: today(), recordedBy: "You (demo)" });
        });
        toast.success("Order cancelled — supplier PO released to draft");
      },

      addEvent: (orderId, e) => { set((s) => { s.orders[orderId]?.events.unshift({ id: uid("ev"), eventType: e.eventType, message: e.message, source: "SC_MANUAL", occurredAt: today(), recordedBy: "You (demo)" }); }); toast.success("Event logged"); },
      addDocument: (orderId, d) => { set((s) => { s.orders[orderId]?.documents.push({ id: uid("doc"), subjectType: d.subjectType, docType: d.docType, fileName: d.fileName, uploadedBy: "You (demo)", uploadedAt: today() }); }); toast.success("Document attached"); },
      attachPI: (orderId, p) => {
        set((s) => {
          const b = s.orders[orderId]; if (!b) return;
          if (p.piNo) b.piNo = p.piNo;
          b.documents.push({ id: uid("doc"), subjectType: "ORDER", docType: "PI", fileName: p.fileName || `supplier-pi-${p.piNo || "attached"}.pdf`, uploadedBy: "You (demo)", uploadedAt: today() });
          b.events.unshift({ id: uid("ev"), eventType: "GENERAL", message: `Supplier PI${p.piNo ? ` ${p.piNo}` : ""} uploaded to the order.`, source: "SC_MANUAL", occurredAt: today(), recordedBy: "You (demo)" });
        });
        toast.success("Supplier PI attached");
      },
      decideApproval: (orderId, approvalId, status) => {
        let nextName: string | null = null;
        set((s) => {
          const b = s.orders[orderId]; const a = b?.approvals.find((x) => x.id === approvalId);
          if (a && b) {
            a.status = status; a.decidedBy = "You (demo)";
            if (a.kind === "PO_REVIEW" && status === "APPROVED") {
              b.approvalStatus = "APPROVED";
              // auto-advance the "PO reviewed & approved" gate — approving IS the action, no separate Advance click
              const idx = b.journey.findIndex((x) => (x.status === "IN_PROGRESS" || x.status === "BLOCKED") && x.name.toLowerCase().includes("approved"));
              if (idx >= 0) {
                b.journey[idx].status = "DONE";
                if (idx + 1 < b.journey.length) { b.journey[idx + 1].status = "IN_PROGRESS"; nextName = b.journey[idx + 1].name; }
                else b.status = "CLOSED";
              }
              if (b.status !== "CLOSED" && ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ON_HOLD"].includes(b.status)) b.status = "ACTIVE";
            }
            if (a.kind === "PO_REVIEW" && status === "REJECTED") b.approvalStatus = "REJECTED";
          }
        });
        toast.success(nextName ? `PO approved — advanced to “${nextName}”` : `Approval ${status.toLowerCase()}`);
      },
    })),
    {
      name: "poc-sourceops",
      version: 4, // 2 = 3-entity model · 3 = WHL testing · 4 = full hardcoded seed on every order
      // older blobs have no testing/demo data — drop them so the seeded demo shows up as-is
      migrate: (persisted, from) => (from < 4 ? undefined : persisted) as never,
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage))),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as { orders?: Record<string, unknown>; clientPos?: Store["clientPos"]; supplierPos?: SupplierPO[] } | undefined;
        // pre-refactor blobs have `orders` but no `supplierPos` — discard rather than half-merge seed data on top of stale orders
        if (!p || !p.orders || !p.supplierPos) return current;
        const orders: OrdersMap = {};
        for (const [id, b] of Object.entries(p.orders)) orders[id] = normalizeBundle(b);
        return {
          ...current, orders,
          clientPos: (p.clientPos ?? current.clientPos).map((c) => ({ ...c, lines: c.lines ?? [] })),
          supplierPos: p.supplierPos.map((s) => ({ ...s, lines: s.lines ?? [] })),
        };
      },
    },
  ),
);
