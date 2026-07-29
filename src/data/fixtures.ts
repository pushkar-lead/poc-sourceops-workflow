import type {
  Order, OrderBundle, JourneyStep, JourneyPhase, Lot, Escrow, Payment,
  Shipment, CustomsEntry, DeliveryAllocation, SourcingAllocation, DocumentRef, Approval, OrderEvent, OrderLine, ClientPO, SupplierPO, TestingMode, Address,
} from "@/types";

export const HERO_ID = "ord-148";

// local date helper (mirrors store's) — used to derive escrow window expiry from an ISO date
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// Our masking-entity hub — inbound goods land here, get relabelled to 1Buy, then re-dispatched to the buyer.
export const ONEBUY_HUB: Address = {
  name: "1Buy hub — New Delhi (Sharpbuy Global Solutions)",
  line1: "Plot 7, Sector 18, Udyog Vihar", city: "New Delhi", state: "Delhi", pincode: "110037", country: "IN",
};

export const ORDERS: Order[] = [
  {
    id: HERO_ID, orderNo: "ORD-2026-000148", operatingMode: "MOR", tradeType: "INTERNATIONAL",
    status: "ACTIVE", approvalStatus: "APPROVED",
    buyer: { name: "Acme Pte", country: "SG" }, supplier: { name: "Shenzhen Micro Co", country: "CN" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "USD", incoterm: "FOB", paymentMode: "ESCROW",
    leadTimeDays: 21, testingTimeDays: 6, deliveryTimeDays: 9,
    expectedDispatchDate: "2026-08-04", expectedDeliveryDate: "2026-08-13", requiredBy: "2026-08-20",
    buyTotal: 7013, sellTotal: 8775, createdBy: "A. Sharma", createdAt: "2026-07-14",
    supplierPoId: "spo-148", supplierPoNo: "SPO-2026-0148",
    terms: {
      referenceNo: "RFQBUNDLE_124612_20_07_2026", paymentMethod: "Advance via T/T", dispatchedThrough: "DHL",
      destination: "1Buy hub — New Delhi", deliveryTerms: "Test report along with shipment", dateCode: "25+",
      warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Shenzhen & Hong Kong",
      packing: "Packing list + Commercial Invoice; WHSO# on outside box",
    },
  },
  {
    id: "ord-151", orderNo: "ORD-2026-000151", operatingMode: "MOR", tradeType: "INTERNATIONAL",
    status: "ACTIVE", approvalStatus: "APPROVED",
    buyer: { name: "Northwind GmbH", country: "DE" }, supplier: { name: "Taiwan Semi", country: "TW" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "USD", incoterm: "FOB", paymentMode: "ADVANCE",
    leadTimeDays: 18, testingTimeDays: 4, deliveryTimeDays: 8,
    expectedDispatchDate: "2026-08-10", expectedDeliveryDate: "2026-08-18", requiredBy: "2026-08-25",
    buyTotal: 31200, sellTotal: 35600, createdBy: "A. Sharma", createdAt: "2026-07-22",
  },
  {
    id: "ord-149", orderNo: "ORD-2026-000149", operatingMode: "MOR", tradeType: "DOMESTIC",
    status: "ACTIVE", approvalStatus: "APPROVED",
    buyer: { name: "Bharat Elec", country: "IN" }, supplier: { name: "Delhi Components", country: "IN" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "INR", incoterm: "EXW", paymentMode: "CREDIT",
    leadTimeDays: 10, testingTimeDays: 3, deliveryTimeDays: 4,
    expectedDispatchDate: "2026-07-30", expectedDeliveryDate: "2026-08-03", requiredBy: "2026-08-06",
    buyTotal: 1180000, sellTotal: 1310000, createdBy: "P. Nair", createdAt: "2026-07-19",
  },
  {
    id: "ord-153", orderNo: "ORD-2026-000153", operatingMode: "MOR", tradeType: "INTERNATIONAL",
    status: "ON_HOLD", approvalStatus: "APPROVED",
    buyer: { name: "Kestrel Robotics", country: "US" }, supplier: { name: "Osaka Parts", country: "JP" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "USD", incoterm: "CPT", paymentMode: "ESCROW",
    leadTimeDays: 24, testingTimeDays: 7, deliveryTimeDays: 10,
    expectedDispatchDate: "2026-08-12", expectedDeliveryDate: "2026-08-22", requiredBy: "2026-08-28",
    buyTotal: 58900, sellTotal: 67200, createdBy: "A. Sharma", createdAt: "2026-07-16",
  },
  {
    id: "ord-144", orderNo: "ORD-2026-000144", operatingMode: "MOR", tradeType: "INTERNATIONAL",
    status: "CLOSED", approvalStatus: "APPROVED",
    buyer: { name: "Acme Pte", country: "SG" }, supplier: { name: "Shenzhen Micro Co", country: "CN" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "USD", incoterm: "FOB", paymentMode: "ESCROW",
    leadTimeDays: 20, testingTimeDays: 5, deliveryTimeDays: 8,
    expectedDispatchDate: "2026-07-02", expectedDeliveryDate: "2026-07-10", requiredBy: "2026-07-12",
    buyTotal: 27500, sellTotal: 31600, createdBy: "A. Sharma", createdAt: "2026-06-10",
  },
  {
    id: "ord-155", orderNo: "ORD-2026-000155", operatingMode: "MOR", tradeType: "DOMESTIC",
    status: "DRAFT", approvalStatus: "NOT_REQUIRED",
    buyer: { name: "Bharat Elec", country: "IN" }, supplier: { name: "Pune Traders", country: "IN" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "INR", incoterm: "EXW", paymentMode: "ADVANCE",
    leadTimeDays: 7, testingTimeDays: 0, deliveryTimeDays: 3,
    expectedDispatchDate: "2026-08-01", expectedDeliveryDate: "2026-08-04", requiredBy: "2026-08-08",
    buyTotal: 640000, sellTotal: 712000, createdBy: "P. Nair", createdAt: "2026-07-25",
  },
];

// ---- policy-assembled journey (stages switch on/off per order) ----
type Seed = { phase: JourneyPhase; name: string; owner: string; isGate: boolean };

function seedSteps(o: Order): Seed[] {
  const escrow = o.paymentMode === "ESCROW";
  const testing = testingModeOf(o) !== "NONE";
  const intl = o.tradeType === "INTERNATIONAL";
  const customsy = intl || testingModeOf(o) === "WHL"; // A19: WHL lab is abroad → customs even for domestic
  // PO review, sending the PO and the supplier ACK + PI all happen on the upstream sourcing
  // platform. This console is fulfilment-only: it picks up an already-approved order with the
  // PI in hand, so the journey starts here and only carries fulfilment steps.
  const s: Seed[] = [
    { phase: "KICKOFF", name: "Order received for fulfilment", owner: "SC", isGate: false },
  ];
  // escrow funds buyer money up-front (collect-before-pay baked in); non-escrow needs an explicit collect gate first
  if (!escrow) s.push({ phase: "PAYMENT", name: "Collect advance from client", owner: "Finance", isGate: true });
  s.push(escrow
    ? { phase: "PAYMENT", name: "Fund escrow (super-invoice A1+A2)", owner: "Finance", isGate: true }
    : { phase: "PAYMENT", name: `Pay supplier — ${o.paymentMode.toLowerCase()}`, owner: "Finance", isGate: true });
  if (testing) {
    const whl = testingModeOf(o) === "WHL";
    s.push({ phase: "TESTING", name: `Testing — ${whl ? "WHL lab" : "supplier self-test"}`, owner: whl ? "Lab" : "Supplier", isGate: true });
  }
  // escrow ALWAYS needs a release step, else money stays trapped (ESCROW + testing=NONE). Trigger = PASS when tested, else acceptance/GRN.
  if (escrow) s.push({ phase: "PAYMENT", name: testing ? "Release escrow on PASS" : "Release escrow (on acceptance)", owner: "Finance", isGate: true });
  if (customsy) {
    // gated: an inbound shipment must exist before customs can be filed
    s.push({ phase: "IMPORT", name: intl ? "Ship to India (inbound AWB)" : "Export to lab → re-import", owner: "SC", isGate: true });
    s.push({ phase: "CUSTOMS", name: "Customs — BOE filed in ICEGATE", owner: "CHA", isGate: true });
  }
  s.push({ phase: "RELABEL", name: "Receive + relabel to 1Buy", owner: "SC", isGate: false });
  s.push({ phase: "DELIVERY", name: "e-Invoice + dispatch to client", owner: "SC", isGate: true }); // gated: all lines must be mapped to demand
  s.push({ phase: "DELIVERY", name: "Proof of delivery", owner: "SC", isGate: false });
  s.push({ phase: "CLOSE", name: "Reconcile + close", owner: "Finance", isGate: false });
  return s;
}

function testingModeOf(o: Order): TestingMode {
  if (o.testingMode) return o.testingMode; // real mode carried from the supplier PO drives the journey
  // fallback heuristic only for seeded fixtures with no explicit mode
  if (o.id === "ord-155") return "NONE";
  if (o.tradeType === "DOMESTIC") return "SUPPLIER_SELF";
  return "WHL";
}

export function buildJourney(o: Order): JourneyStep[] {
  const seeds = seedSteps(o);
  let p: number;
  switch (o.status) {
    case "DRAFT": p = 0; break;
    case "PENDING_APPROVAL": p = 1; break;
    case "APPROVED": p = 2; break;
    case "ACTIVE": p = Math.max(4, Math.floor(seeds.length * 0.58)); break;
    case "ON_HOLD": {
      const c = seeds.findIndex((x) => x.phase === "CUSTOMS");
      p = c >= 0 ? c : Math.floor(seeds.length * 0.6); break;
    }
    case "CLOSED": p = seeds.length; break;
    default: p = 1;
  }
  return seeds.map((s, i) => ({
    id: `${o.id}-j${i + 1}`, seq: i + 1, phase: s.phase, name: s.name, owner: s.owner, isGate: s.isGate,
    status: i < p ? "DONE" : i === p ? (o.status === "ON_HOLD" && s.phase === "CUSTOMS" ? "BLOCKED" : "IN_PROGRESS") : "PENDING",
  }));
}

export function genericLines(o: Order): OrderLine[] {
  return [
    {
      id: `${o.id}-l1`, lineNo: 1, mpn: "STM32F407VGT6", make: "STMicro", description: "32-bit ARM Cortex-M4 MCU",
      hsnCode: "85423900", quantity: 500, unitPrice: 22.0, currency: o.currency, dateCode: "2325", coo: o.supplier.country,
      testingRequired: testingModeOf(o) !== "NONE", testingMode: testingModeOf(o), componentCategory: "MCU",
      lab: testingModeOf(o) === "WHL" ? "WHL Shenzhen" : undefined,
    },
    {
      id: `${o.id}-l2`, lineNo: 2, mpn: "TPS54560DDAR", make: "TI", description: "Step-down DC-DC converter",
      hsnCode: "85423900", quantity: 400, unitPrice: 1.65, currency: o.currency, dateCode: "2410", coo: o.supplier.country,
      testingRequired: testingModeOf(o) !== "NONE", testingMode: testingModeOf(o), componentCategory: "Power",
      lab: testingModeOf(o) === "WHL" ? "WHL Shenzhen" : undefined,
    },
    {
      id: `${o.id}-l3`, lineNo: 3, mpn: "GRM155R71C104KA88D", make: "Murata", description: "MLCC 0.1µF 16V X7R",
      hsnCode: "85322400", quantity: 300, unitPrice: 0.02, currency: o.currency, dateCode: "2402", coo: o.supplier.country,
      testingRequired: false, testingMode: "NONE", componentCategory: "Passive",
    },
  ];
}

// ---- HERO rich detail ----
// hero order lines mirror its Supplier PO (spo-148): STM32 300 / TPS 250, fully sourced to ACME-PO-3391 (no orphan line)
const HERO_LINES: OrderLine[] = [
  { id: "ord-148-l1", lineNo: 1, mpn: "STM32F407VGT6", make: "STMicro", description: "32-bit ARM Cortex-M4 MCU",
    hsnCode: "85423900", quantity: 300, unitPrice: 22.0, currency: "USD", dateCode: "2325", coo: "CN",
    testingRequired: true, testingMode: "WHL", componentCategory: "MCU", lab: "WHL Shenzhen" },
  { id: "ord-148-l2", lineNo: 2, mpn: "TPS54560DDAR", make: "TI", description: "Step-down DC-DC converter",
    hsnCode: "85423900", quantity: 250, unitPrice: 1.65, currency: "USD", dateCode: "2410", coo: "CN",
    testingRequired: true, testingMode: "WHL", componentCategory: "Power", lab: "WHL Shenzhen" },
];

const HERO_LOTS: Lot[] = [
  { id: "lot-a", orderLineMpn: "STM32F407VGT6", lotCode: "LOT-A", dateCode: "2325", qty: 300, sampleQty: 20,
    testStatus: "PASS", lab: "WHL Shenzhen", workOrderNo: "352146", reportNo: "352146.1", tatDays: 5, testedAt: "2026-07-25" },
  { id: "lot-b", orderLineMpn: "TPS54560DDAR", lotCode: "LOT-B", dateCode: "2410", qty: 250, sampleQty: 20,
    testStatus: "MAYBE", lab: "WHL Shenzhen", workOrderNo: "352147", reportNo: "352147.1", tatDays: 6, testedAt: "2026-07-26" },
];

const HERO_ESCROW: Escrow = {
  id: "esc-148", provider: "HKIN", externalRef: "ES2607-5881", currency: "USD",
  materialAmount: 7013, chargesAmount: 140, bankingCharges: 35, feeSeller: 300, feeBuyer: 150, superInvoiceTotal: 7638,
  releaseTrigger: "WHL PASS", paymentTerms: "Advance via T/T into escrow", expiryDate: "2026-09-01", status: "PARTIALLY_RELEASED",
  events: [
    { id: "ee1", type: "FUND", amount: 7013, trigger: "Buyer funded super-invoice (material A1 held)", occurredAt: "2026-07-18" },
    { id: "ee2", type: "HOLD", amount: 7013, trigger: "Awaiting WHL results", occurredAt: "2026-07-18" },
    { id: "ee3", type: "RELEASE", amount: 3500, trigger: "LOT-A WHL PASS (report 352146.1)", occurredAt: "2026-07-25" },
  ],
};

const HERO_PAYMENTS: Payment[] = [
  { id: "pay1", direction: "CLIENT_TO_1BUY", mode: "ADVANCE", triggerDoc: "Our PI", amount: 8775, currency: "USD", status: "PAID", dueDate: "2026-07-16", paidAt: "2026-07-16" },
  { id: "pay2", direction: "1BUY_TO_SUPPLIER", mode: "ESCROW", triggerDoc: "Supplier PI", amount: 7013, currency: "USD", status: "INITIATED", dueDate: "2026-07-18" },
];

const HERO_SHIPMENTS: Shipment[] = [
  { id: "shp1", shipmentNo: "SHP-IN-148-1", leg: "INBOUND", awb: "DHL 77610233451", carrier: "DHL",
    fromLocation: "Shenzhen, CN", toLocation: "1Buy hub — New Delhi", boxCount: 4, grossWeightKg: 32.5,
    dispatchDate: "2026-07-28", status: "IN_TRANSIT", lines: [{ mpn: "STM32F407VGT6", qty: 300 }, { mpn: "TPS54560DDAR", qty: 250 }] },
];

const HERO_CUSTOMS: CustomsEntry[] = [
  { id: "ce1", shipmentNo: "SHP-IN-148-1", beNo: "—", portCode: "INDEL4", chaName: "Speedwing CHA",
    totalDuty: 5400, currency: "INR", icegateRef: undefined, filedAt: undefined },
];

const HERO_DELIVERIES: DeliveryAllocation[] = [];

const HERO_SOURCING: SourcingAllocation[] = [
  { id: "sa1", orderLineId: "ord-148-l1", clientPoNo: "ACME-PO-3391", clientLineMpn: "STM32F407VGT6", orderLineMpn: "STM32F407VGT6", qty: 300, marginPct: 13 },
  { id: "sa2", orderLineId: "ord-148-l2", clientPoNo: "ACME-PO-3391", clientLineMpn: "TPS54560DDAR", orderLineMpn: "TPS54560DDAR", qty: 250, marginPct: 12 },
];

const HERO_DOCS: DocumentRef[] = [
  { id: "d1", subjectType: "ORDER", docType: "PO", fileName: "buyer-po-ORD148.pdf", uploadedBy: "A. Sharma", uploadedAt: "2026-07-14" },
  { id: "d2", subjectType: "ORDER", docType: "PI", fileName: "supplier-pi-shenzhen.pdf", uploadedBy: "A. Sharma", uploadedAt: "2026-07-17" },
  { id: "d3", subjectType: "ESCROW", docType: "ESCROW_INVOICE", fileName: "ES2607-5881.pdf", uploadedBy: "R. Menon", uploadedAt: "2026-07-18" },
  { id: "d4", subjectType: "LOT", docType: "WHL_REPORT", fileName: "WHL-352146.1.pdf", uploadedBy: "Lab", uploadedAt: "2026-07-25" },
];

const HERO_APPROVALS: Approval[] = [
  { id: "ap1", subjectType: "ORDER", kind: "PO_REVIEW", role: "Finance", status: "APPROVED", decidedBy: "R. Menon (Finance)", notes: "Margin 13% — ok." },
  { id: "ap2", subjectType: "PAYMENT", kind: "PAYMENT_RELEASE", role: "Finance", status: "PENDING", notes: "Release balance on LOT-B decision." },
];

const HERO_EVENTS: OrderEvent[] = [
  { id: "ev1", eventType: "GENERAL", message: "Escrow funded (super-invoice ES2607-5881).", source: "SC_MANUAL", occurredAt: "2026-07-18", recordedBy: "R. Menon" },
  { id: "ev2", eventType: "LEAD_TIME_UPDATE", message: "Supplier: ~1 week to dispatch remaining.", source: "SC_MANUAL", occurredAt: "2026-07-23", recordedBy: "A. Sharma" },
  { id: "ev3", eventType: "DELAY", message: "LOT-B flagged MAYBE by WHL — awaiting client decision.", source: "SC_MANUAL", occurredAt: "2026-07-26", recordedBy: "A. Sharma" },
];

export function getOrderBundle(id: string): OrderBundle | undefined {
  const o = ORDERS.find((x) => x.id === id);
  if (!o) return undefined;
  const base = {
    ...o,
    lines: genericLines(o),
    journey: buildJourney(o),
  };
  if (o.id === HERO_ID) {
    return {
      ...base, lines: HERO_LINES, lots: HERO_LOTS, escrow: HERO_ESCROW, payments: HERO_PAYMENTS, shipments: HERO_SHIPMENTS,
      customs: HERO_CUSTOMS, deliveries: HERO_DELIVERIES, sourcingAllocations: HERO_SOURCING,
      documents: HERO_DOCS, approvals: HERO_APPROVALS, events: HERO_EVENTS,
    };
  }
  // minimal detail for the other orders
  const approvals: Approval[] = o.approvalStatus === "PENDING"
    ? [{ id: `${o.id}-ap`, subjectType: "ORDER", kind: "PO_REVIEW", role: "Finance", status: "PENDING", notes: "Awaiting review." }]
    : o.approvalStatus === "APPROVED"
    ? [{ id: `${o.id}-ap`, subjectType: "ORDER", kind: "PO_REVIEW", role: "Finance", status: "APPROVED", decidedBy: "R. Menon (Finance)" }]
    : [];
  const escrow: Escrow | undefined = o.paymentMode === "ESCROW"
    ? { id: `${o.id}-esc`, provider: "HKIN", externalRef: "—", currency: o.currency, materialAmount: o.buyTotal,
        chargesAmount: Math.round(o.buyTotal * 0.02), bankingCharges: Math.round(o.buyTotal * 0.005), feeSeller: 300, feeBuyer: 150,
        superInvoiceTotal: Math.round(o.buyTotal * 1.025) + 450, releaseTrigger: o.termsConditions?.length ? "Per T&C + lab PASS" : "WHL PASS",
        paymentTerms: o.terms?.paymentMethod ?? "Advance via T/T into escrow", expiryDate: addDays(o.createdAt, 45),
        status: o.status === "CLOSED" ? "RELEASED" : o.status === "ON_HOLD" ? "FUNDED" : "OPEN", events: [] }
    : undefined;
  return {
    ...base, lots: [], escrow, payments: [], shipments: [], customs: [], deliveries: [], sourcingAllocations: [],
    documents: [{ id: `${o.id}-po`, subjectType: "ORDER", docType: "PO", fileName: `buyer-po-${o.orderNo}.pdf`, uploadedBy: o.createdBy, uploadedAt: o.createdAt }],
    approvals, events: [],
  };
}

// ---- Client POs (delivery targets) ----
export const CLIENT_POS: ClientPO[] = [
  { id: "cpo-1", clientPoNo: "ACME-PO-3391", client: { name: "Acme Pte", country: "SG" }, paymentMode: "ESCROW", status: "IN_FULFILMENT",
    lines: [{ mpn: "STM32F407VGT6", make: "STMicro", dateCode: "2325", qty: 300, unitPrice: 27.5, requiredBy: "2026-08-20", status: "ALLOCATED" },
            { mpn: "TPS54560DDAR", make: "TI", dateCode: "2410", qty: 250, unitPrice: 2.1, requiredBy: "2026-08-20", status: "OPEN" }] },
  { id: "cpo-2", clientPoNo: "NW-4402", client: { name: "Northwind GmbH", country: "DE" }, paymentMode: "ADVANCE", status: "RECEIVED",
    lines: [{ mpn: "XC7A35T-2FGG484I", make: "AMD (Xilinx)", dateCode: "24+", qty: 120, unitPrice: 41.0, requiredBy: "2026-08-25", status: "OPEN" }] },
  { id: "cpo-3", clientPoNo: "GIPL/26-27/PO/121", client: { name: "GEES Innovations Pvt Ltd", country: "IN", gstin: "33AALCG9069K1Z0", state: "Tamil Nadu" }, paymentMode: "CREDIT", status: "CONFIRMED",
    terms: { referenceNo: "GIPL/26-27/PO/121", gstNote: "GST extra @ actual", deliveryTerms: "Test Report Along with Shipment", paymentMethod: "As agreed" },
    lines: [{ mpn: "MIC5282-5.0YMME-TR", make: "Microchip", dateCode: "25+", qty: 12500, unitPrice: 345.6, requiredBy: "2026-07-20", status: "OPEN" }] },
  // DEMO — domestic client (India), pays us on ADVANCE; sourced from an international supplier on ESCROW (see spo-221)
  { id: "cpo-4", clientPoNo: "BEL/26-27/PO/0042", client: { name: "Bharat Defence Electronics Ltd", country: "IN", gstin: "29AABCB1234M1Z8", state: "Karnataka" }, paymentMode: "ADVANCE", status: "CONFIRMED",
    terms: { referenceNo: "BEL/26-27/PO/0042", gstNote: "GST extra @ actual", deliveryTerms: "Delivered to Bengaluru site, DDP", testingTerms: "Test report along with shipment", paymentMethod: "Advance via T/T" },
    deliveryAddress: { name: "Bharat Defence Electronics Ltd", line1: "Jalahalli Post, IISc Campus Road", city: "Bengaluru", state: "Karnataka", pincode: "560013", country: "IN" },
    lines: [{ mpn: "TMS320F28379DPTPT", make: "TI", dateCode: "24+", qty: 800, unitPrice: 34.5, requiredBy: "2026-09-05", status: "OPEN" },
            { mpn: "AD7768-4BSTZ", make: "Analog Devices", dateCode: "24+", qty: 500, unitPrice: 21.0, requiredBy: "2026-09-05", status: "OPEN" }] },
];

// ---- Supplier POs (our purchase docs → suppliers) ----
// spo-148 is ORDERED (its fulfilment order is the hero); the rest are DRAFTs
// awaiting "Create order". Sourcing coverage on Client POs is computed from these.
export const SUPPLIER_POS: SupplierPO[] = [
  {
    id: "spo-148", poNo: "SPO-2026-0148", supplier: { name: "Shenzhen Micro Co", country: "CN" },
    tradeType: "INTERNATIONAL", currency: "USD", incoterm: "FOB", paymentMode: "ESCROW", testing: "WHL",
    leadTimeDays: 21, testingTimeDays: 6, deliveryTimeDays: 9,
    terms: {
      referenceNo: "RFQBUNDLE_124612_20_07_2026", paymentMethod: "Advance via T/T", dispatchedThrough: "DHL",
      destination: "1Buy hub — New Delhi", deliveryTerms: "Test report along with shipment", dateCode: "25+",
      warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Shenzhen & Hong Kong",
      packing: "Packing list + Commercial Invoice; WHSO# on outside box",
    },
    lines: [
      { mpn: "STM32F407VGT6", make: "STMicro", qty: 300, buyUnitPrice: 22.0, marginPct: 13, clientPoNo: "ACME-PO-3391", clientLineMpn: "STM32F407VGT6" },
      { mpn: "TPS54560DDAR", make: "TI", qty: 250, buyUnitPrice: 1.65, marginPct: 12, clientPoNo: "ACME-PO-3391", clientLineMpn: "TPS54560DDAR" },
    ],
    buyTotal: 7013, createdBy: "A. Sharma", createdAt: "2026-07-14", status: "ORDERED", orderId: HERO_ID,
  },
  {
    id: "spo-201", poNo: "SPO-2026-0201", supplier: { name: "Oleti Development Co", country: "HK", state: "Hong Kong" },
    tradeType: "INTERNATIONAL", currency: "USD", incoterm: "EXW", paymentMode: "ADVANCE", testing: "WHL",
    leadTimeDays: 1, testingTimeDays: 6, deliveryTimeDays: 9,
    terms: {
      referenceNo: "RFQBUNDLE_124612_20_07_2026", paymentMethod: "Advance via T/T", dispatchedThrough: "DHL",
      destination: "1Buy hub — New Delhi", deliveryTerms: "Test report along with shipment", dateCode: "25+",
      warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Shenzhen & Hong Kong",
      packing: "Packing list + Commercial Invoice; WHSO# on outside box",
    },
    lines: [
      { mpn: "MIC5282-5.0YMME-TR", make: "Microchip", qty: 5000, buyUnitPrice: 300, marginPct: 15, clientPoNo: "GIPL/26-27/PO/121", clientLineMpn: "MIC5282-5.0YMME-TR" },
    ],
    buyTotal: 1500000, createdBy: "You (demo)", createdAt: "2026-07-25", status: "DRAFT",
  },
  {
    id: "spo-202", poNo: "SPO-2026-0202", supplier: { name: "Pune Traders", country: "IN", gstin: "27AAECP1234R1Z5", state: "Maharashtra" },
    tradeType: "DOMESTIC", currency: "INR", incoterm: "EXW", paymentMode: "ADVANCE", testing: "SUPPLIER_SELF",
    leadTimeDays: 7, testingTimeDays: 3, deliveryTimeDays: 4,
    terms: { paymentMethod: "50% advance", gstNote: "GST extra @ actual", warranty: "6 months" },
    lines: [
      { mpn: "LM317T", make: "TI", qty: 2000, buyUnitPrice: 20, marginPct: 10 }, // unlinked — map to a buyer PO later
    ],
    buyTotal: 40000, createdBy: "You (demo)", createdAt: "2026-07-26", status: "DRAFT",
  },
  // DEMO — international supplier (China), we pay on ESCROW; fully sourced from the domestic client cpo-4 (BEL, ADVANCE). DRAFT → click "Create order".
  {
    id: "spo-221", poNo: "SPO-2026-0221", supplier: { name: "Shenzhen Apex Components Co", country: "CN" },
    tradeType: "INTERNATIONAL", currency: "USD", incoterm: "FOB", paymentMode: "ESCROW", testing: "WHL",
    leadTimeDays: 21, testingTimeDays: 6, deliveryTimeDays: 9,
    terms: {
      referenceNo: "RFQBUNDLE_221904_28_07_2026", paymentMethod: "Advance via T/T into escrow", dispatchedThrough: "DHL",
      destination: "1Buy hub — New Delhi", deliveryTerms: "FOB Shenzhen; onward to 1Buy hub", testingTerms: "WHL report (Shenzhen & HK) before release",
      warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Shenzhen & Hong Kong",
      packing: "Packing list + Commercial Invoice; WHSO# on outside box",
    },
    termsConditions: [
      "Goods must be new, genuine & factory-sealed (no refurbished/remarked)",
      "Full traceability — Certificate of Conformance / manufacturer lot",
      "Date code as specified per line; no mixed date codes without approval",
      "Test report / CoA supplied along with the shipment",
      "Supplier bears cost on test FAIL (return + re-test)",
      "Warranty: 12 months from delivery against defects",
    ],
    relabelCost: 450,
    lines: [
      { mpn: "TMS320F28379DPTPT", make: "TI", dateCode: "24+", testing: "WHL", qty: 800, buyUnitPrice: 29.5, marginPct: 14, clientPoNo: "BEL/26-27/PO/0042", clientLineMpn: "TMS320F28379DPTPT" },
      { mpn: "AD7768-4BSTZ", make: "Analog Devices", dateCode: "24+", testing: "SUPPLIER_SELF", qty: 500, buyUnitPrice: 17.8, marginPct: 15, clientPoNo: "BEL/26-27/PO/0042", clientLineMpn: "AD7768-4BSTZ" },
    ],
    buyTotal: 32500, createdBy: "You (demo)", createdAt: "2026-07-28", status: "DRAFT",
  },
];
