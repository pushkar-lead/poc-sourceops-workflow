import type {
  Order, OrderBundle, JourneyStep, JourneyPhase, Lot, Escrow, Payment,
  Shipment, CustomsEntry, DeliveryAllocation, SourcingAllocation, DocumentRef, Approval, OrderEvent, OrderLine, ClientPO, SupplierPO, TestingMode, Address,
  MpnTestSpec, LabEmail, LotTest, WhlReport, TestProcessStatus, TestAuditEntry, LotNotification,
} from "@/types";
import { WHL_CONFIDENTIALITY } from "@/data/enums";
import { ORDER_DETAILS } from "@/data/order-details";

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
    leadTimeDays: 18, testingTimeDays: 4, deliveryTimeDays: 8, testingMode: "WHL",
    expectedDispatchDate: "2026-08-10", expectedDeliveryDate: "2026-08-18", requiredBy: "2026-08-25",
    buyTotal: 31200, sellTotal: 35580, createdBy: "A. Sharma", createdAt: "2026-07-20",
    supplierPoId: "spo-151", supplierPoNo: "SPO-2026-0151", piNo: "TS-PI-26-1188",
    terms: {
      referenceNo: "RFQBUNDLE_118820_18_07_2026", paymentMethod: "Advance via T/T", dispatchedThrough: "FedEx",
      destination: "WHL Hong Kong → 1Buy hub", deliveryTerms: "FOB Hsinchu", testingTerms: "AS6081 full screen before onward shipment",
      dateCode: "24+", warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Hong Kong",
      packing: "Anti-static trays, MSD bagged; WHSO# on outside box",
    },
    termsConditions: [
      "Goods must be new, genuine & factory-sealed (no refurbished/remarked)",
      "Full traceability — Certificate of Conformance / manufacturer lot",
      "Supplier bears cost on test FAIL (return + re-test)",
    ],
  },
  {
    id: "ord-149", orderNo: "ORD-2026-000149", operatingMode: "MOR", tradeType: "DOMESTIC",
    status: "ACTIVE", approvalStatus: "APPROVED",
    buyer: { name: "Bharat Elec", country: "IN" }, supplier: { name: "Delhi Components", country: "IN" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "INR", incoterm: "EXW", paymentMode: "CREDIT",
    leadTimeDays: 10, testingTimeDays: 3, deliveryTimeDays: 4, testingMode: "SUPPLIER_SELF",
    expectedDispatchDate: "2026-07-30", expectedDeliveryDate: "2026-08-03", requiredBy: "2026-08-06",
    buyTotal: 1180000, sellTotal: 1310000, createdBy: "P. Nair", createdAt: "2026-07-19",
    supplierPoId: "spo-149", supplierPoNo: "SPO-2026-0149", piNo: "DC-PI-4471", creditDays: 30,
    terms: {
      referenceNo: "BEL-DOM/26/PO/77", gstNote: "GST extra @ actual", paymentMethod: "Net 30 credit",
      dispatchedThrough: "Delhivery", destination: "1Buy hub — New Delhi", deliveryTerms: "Ex-works pickup",
      testingTerms: "Supplier self-test + CoC with each lot", dateCode: "25+", warranty: "6 months",
      testFailureBearer: "SUPPLIER", packing: "Reels in MSD bags; CoC in the box",
    },
    buyerAddress: { name: "Bharat Elec", line1: "Plot 22, Okhla Industrial Area Phase II", city: "New Delhi", state: "Delhi", pincode: "110020", country: "IN" },
  },
  {
    id: "ord-153", orderNo: "ORD-2026-000153", operatingMode: "MOR", tradeType: "INTERNATIONAL",
    status: "ON_HOLD", approvalStatus: "APPROVED",
    buyer: { name: "Kestrel Robotics", country: "US" }, supplier: { name: "Osaka Parts", country: "JP" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "USD", incoterm: "CPT", paymentMode: "ESCROW",
    leadTimeDays: 24, testingTimeDays: 7, deliveryTimeDays: 10, testingMode: "WHL",
    expectedDispatchDate: "2026-08-12", expectedDeliveryDate: "2026-08-22", requiredBy: "2026-08-28",
    buyTotal: 58900, sellTotal: 67200, createdBy: "A. Sharma", createdAt: "2026-07-16",
    supplierPoId: "spo-153", supplierPoNo: "SPO-2026-0153", piNo: "OSK-PI-2026-0771", relabelCost: 600,
    terms: {
      referenceNo: "RFQBUNDLE_207714_14_07_2026", paymentMethod: "Advance via T/T into escrow", dispatchedThrough: "DHL",
      destination: "WHL Shenzhen → 1Buy hub", deliveryTerms: "CPT Shenzhen", testingTerms: "AS6081 screen; report before escrow release",
      dateCode: "24+", warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Shenzhen",
      packing: "Tubes + trays, MSD bagged; WHSO# on outside box",
    },
    termsConditions: [
      "Goods must be new, genuine & factory-sealed (no refurbished/remarked)",
      "Full traceability — Certificate of Conformance / manufacturer lot",
      "Test report / CoA supplied along with the shipment",
      "Supplier bears cost on test FAIL (return + re-test)",
    ],
    buyerAddress: { name: "Kestrel Robotics Inc", line1: "1180 Bordeaux Drive", city: "Sunnyvale", state: "CA", pincode: "94089", country: "US" },
  },
  {
    id: "ord-144", orderNo: "ORD-2026-000144", operatingMode: "MOR", tradeType: "INTERNATIONAL",
    status: "CLOSED", approvalStatus: "APPROVED",
    buyer: { name: "Acme Pte", country: "SG" }, supplier: { name: "Shenzhen Micro Co", country: "CN" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "USD", incoterm: "FOB", paymentMode: "ESCROW",
    leadTimeDays: 20, testingTimeDays: 5, deliveryTimeDays: 8, testingMode: "WHL",
    expectedDispatchDate: "2026-07-02", expectedDeliveryDate: "2026-07-10", requiredBy: "2026-07-12",
    buyTotal: 27500, sellTotal: 31600, createdBy: "A. Sharma", createdAt: "2026-06-10",
    supplierPoId: "spo-144", supplierPoNo: "SPO-2026-0144", piNo: "SZM-PI-26-0442", relabelCost: 400,
    terms: {
      referenceNo: "RFQBUNDLE_044210_08_06_2026", paymentMethod: "Advance via T/T into escrow", dispatchedThrough: "DHL",
      destination: "1Buy hub — New Delhi", deliveryTerms: "Test report along with shipment", dateCode: "23+",
      warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Shenzhen",
      packing: "Packing list + Commercial Invoice; WHSO# on outside box",
    },
    buyerAddress: { name: "Acme Pte Ltd", line1: "8 Kaki Bukit Avenue 1", city: "Singapore", pincode: "417941", country: "SG" },
  },
  {
    id: "ord-155", orderNo: "ORD-2026-000155", operatingMode: "MOR", tradeType: "DOMESTIC",
    status: "DRAFT", approvalStatus: "NOT_REQUIRED",
    buyer: { name: "Bharat Elec", country: "IN" }, supplier: { name: "Pune Traders", country: "IN" },
    maskingEntity: "Sharpbuy Global Solutions", currency: "INR", incoterm: "EXW", paymentMode: "ADVANCE",
    leadTimeDays: 7, testingTimeDays: 0, deliveryTimeDays: 3, testingMode: "NONE",
    expectedDispatchDate: "2026-08-01", expectedDeliveryDate: "2026-08-04", requiredBy: "2026-08-08",
    buyTotal: 640000, sellTotal: 712000, createdBy: "P. Nair", createdAt: "2026-07-25",
    supplierPoId: "spo-155", supplierPoNo: "SPO-2026-0155",
    terms: {
      referenceNo: "BEL-DOM/26/PO/81", gstNote: "GST extra @ actual", paymentMethod: "Advance via T/T",
      dispatchedThrough: "Delhivery", destination: "1Buy hub — New Delhi", deliveryTerms: "Ex-works pickup",
      testingTerms: "No incoming test — waived by client in writing", dateCode: "25+", warranty: "6 months",
    },
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

// ---- WHL testing seed -------------------------------------------------------------
// Tests are what the PO asked for — parsed off SPO-2026-0148, never hand-typed. The
// TPS line deliberately shows the failed-parse path ("needs manual review").

const aud = (n: number, by: string, action: TestAuditEntry["action"], o: Partial<TestAuditEntry>): TestAuditEntry =>
  ({ id: `aud-${n}`, at: o.at ?? "2026-07-20 09:14", by, action, ...o });

const STM32_TESTS = [
  { id: "req-a1", name: "Documentation & Packaging Inspection", standard: "AS6081", source: "AUTO_PO" as const },
  { id: "req-a2", name: "General Inspection", standard: "AS6081", source: "AUTO_PO" as const },
  { id: "req-a3", name: "External Visual Inspection", standard: "AS6081", source: "AUTO_PO" as const },
  { id: "req-a4", name: "Electrical Test", standard: "AS6081", source: "AUTO_PO" as const },
  { id: "req-a5", name: "X-Ray Inspection", standard: "AS6081", source: "AUTO_PO" as const },
  { id: "req-a6", name: "Decapsulation & Die Analysis", standard: "AS6171", source: "MANUAL" as const, addedBy: "A. Sharma", addedAt: "2026-07-20 11:02" },
];

const HERO_MPN_TESTS: MpnTestSpec[] = [
  {
    id: "spec-a", mpn: "STM32F407VGT6", autofill: "OK", sourceDoc: "Supplier PO SPO-2026-0148",
    parsedAt: "2026-07-20 09:14", confidence: 0.96, tests: STM32_TESTS,
    audit: [
      aud(1, "Doc extraction (auto)", "AUTOFILL", { target: "STM32F407VGT6", before: "—", after: "5 test(s) from Supplier PO SPO-2026-0148", note: "Confidence 96%." }),
      aud(2, "A. Sharma", "ADD", { at: "2026-07-20 11:02", target: "Decapsulation & Die Analysis", before: "—", after: "manual test (AS6171)", note: "PO clause 7 asks for die analysis on MIL-grade lines; parser missed the footnote." }),
    ],
  },
  {
    id: "spec-b", mpn: "TPS54560DDAR", autofill: "FAILED", sourceDoc: "Supplier PO SPO-2026-0148",
    parsedAt: "2026-07-20 09:14", confidence: 0.31,
    autofillNote: "Test table on page 2 is a low-resolution scan — columns could not be resolved.",
    tests: [
      { id: "req-b1", name: "Documentation & Packaging Inspection", source: "MANUAL", addedBy: "A. Sharma", addedAt: "2026-07-21 10:40" },
      { id: "req-b2", name: "External Visual Inspection", source: "MANUAL", addedBy: "A. Sharma", addedAt: "2026-07-21 10:41" },
      { id: "req-b3", name: "Electrical Test", source: "MANUAL", addedBy: "A. Sharma", addedAt: "2026-07-21 10:41" },
      { id: "req-b4", name: "X-Ray Inspection", source: "MANUAL", addedBy: "A. Sharma", addedAt: "2026-07-21 10:42" },
    ],
    audit: [
      aud(3, "Doc extraction (auto)", "AUTOFILL", { target: "TPS54560DDAR", before: "—", after: "auto-fill failed", note: "Test table on page 2 is a low-resolution scan — columns could not be resolved." }),
      aud(4, "A. Sharma", "ADD", { at: "2026-07-21 10:40", target: "Documentation & Packaging Inspection", before: "—", after: "manual test", note: "Read off the printed PO copy." }),
      aud(5, "A. Sharma", "ADD", { at: "2026-07-21 10:41", target: "External Visual Inspection", before: "—", after: "manual test" }),
      aud(6, "A. Sharma", "ADD", { at: "2026-07-21 10:41", target: "Electrical Test", before: "—", after: "manual test" }),
      aud(7, "A. Sharma", "ADD", { at: "2026-07-21 10:42", target: "X-Ray Inspection", before: "—", after: "manual test" }),
      aud(8, "A. Sharma", "DELETE", { at: "2026-07-21 10:44", target: "Solvent Resistance Test", before: "manual test", after: "—", note: "Added in error — not on this PO." }),
    ],
  },
];

const lotTest = (
  id: string, name: string, status: TestProcessStatus, o: Partial<LotTest> & { hist?: [string, string, string][] } = {},
): LotTest => ({
  id, name, standard: o.standard, source: o.source ?? "AUTO_PO", status,
  acceptQty: o.acceptQty, rejectQty: o.rejectQty, updatedAt: o.updatedAt,
  requirementId: o.requirementId,
  history: (o.hist ?? []).map(([at, by, note], i) => ({ id: `${id}-h${i}`, at, by, action: "STATUS", target: name, after: note.split("→")[1]?.trim(), note })),
});

const LOT_A_TESTS: LotTest[] = [
  lotTest("lt-a1", "Documentation & Packaging Inspection", "PASSED", { standard: "AS6081", requirementId: "req-a1", acceptQty: 20, rejectQty: 0, updatedAt: "2026-07-24 15:20",
    hist: [["2026-07-21 09:00", "WHL inbox (auto)", "Lot booked in → PENDING"], ["2026-07-23 11:10", "WHL inbox (auto)", "Interim mail — in progress → IN_PROGRESS"], ["2026-07-24 15:20", "WHL inbox (auto)", "Report 352146.1 → PASSED"]] }),
  lotTest("lt-a2", "General Inspection", "PASSED", { standard: "AS6081", requirementId: "req-a2", acceptQty: 20, rejectQty: 0, updatedAt: "2026-07-24 15:20",
    hist: [["2026-07-23 11:10", "WHL inbox (auto)", "Interim mail → IN_PROGRESS"], ["2026-07-24 15:20", "WHL inbox (auto)", "Report 352146.1 → PASSED"]] }),
  lotTest("lt-a3", "External Visual Inspection", "PASSED", { standard: "AS6081", requirementId: "req-a3", acceptQty: 20, rejectQty: 0, updatedAt: "2026-07-24 15:20",
    hist: [["2026-07-24 15:20", "WHL inbox (auto)", "Report 352146.1 → PASSED"]] }),
  lotTest("lt-a4", "Electrical Test", "PASSED", { standard: "AS6081", requirementId: "req-a4", acceptQty: 20, rejectQty: 0, updatedAt: "2026-07-25 16:05",
    hist: [["2026-07-24 15:20", "WHL inbox (auto)", "Report 352146.1 — 2 units out of spec → FAILED"], ["2026-07-25 09:30", "WHL inbox (auto)", "Re-test agreed after supplier challenge → IN_PROGRESS"], ["2026-07-25 16:05", "WHL inbox (auto)", "Revised report 352146.2 → PASSED"]] }),
  lotTest("lt-a5", "X-Ray Inspection", "PASSED", { standard: "AS6081", requirementId: "req-a5", acceptQty: 20, rejectQty: 0, updatedAt: "2026-07-24 15:20",
    hist: [["2026-07-24 15:20", "WHL inbox (auto)", "Report 352146.1 → PASSED"]] }),
  lotTest("lt-a6", "Decapsulation & Die Analysis", "PASSED", { standard: "AS6171", source: "MANUAL", requirementId: "req-a6", acceptQty: 3, rejectQty: 0, updatedAt: "2026-07-25 16:05",
    hist: [["2026-07-20 11:05", "A. Sharma", "Added manually (PO clause 7) → PENDING"], ["2026-07-25 16:05", "WHL inbox (auto)", "Revised report 352146.2 → PASSED"]] }),
];

const LOT_B_TESTS: LotTest[] = [
  lotTest("lt-b1", "Documentation & Packaging Inspection", "PASSED", { source: "MANUAL", requirementId: "req-b1", acceptQty: 20, rejectQty: 0, updatedAt: "2026-07-26 14:40",
    hist: [["2026-07-26 14:40", "WHL inbox (auto)", "Report 352147.1 → PASSED"]] }),
  lotTest("lt-b2", "External Visual Inspection", "PASSED", { source: "MANUAL", requirementId: "req-b2", acceptQty: 20, rejectQty: 0, updatedAt: "2026-07-26 14:40",
    hist: [["2026-07-26 14:40", "WHL inbox (auto)", "Report 352147.1 → PASSED"]] }),
  lotTest("lt-b3", "Electrical Test", "PASSED", { source: "MANUAL", requirementId: "req-b3", acceptQty: 19, rejectQty: 1, updatedAt: "2026-07-26 14:40",
    hist: [["2026-07-26 14:40", "WHL inbox (auto)", "Report 352147.1 — 1 unit marginal, within AQL → PASSED"]] }),
  lotTest("lt-b4", "X-Ray Inspection", "FAR", { source: "MANUAL", requirementId: "req-b4", acceptQty: 19, rejectQty: 1, updatedAt: "2026-07-26 14:40",
    hist: [["2026-07-26 14:40", "WHL inbox (auto)", "Report 352147.1 — void anomaly on 1 unit → FAR"]] }),
];

const LOT_C_TESTS: LotTest[] = [
  lotTest("lt-c1", "Documentation & Packaging Inspection", "IN_PROGRESS", { source: "MANUAL", requirementId: "req-b1", updatedAt: "2026-07-27 10:15",
    hist: [["2026-07-26 09:00", "A. Sharma", "Lot raised → PENDING"], ["2026-07-27 10:15", "WHL inbox (auto)", "Interim mail — intake complete → IN_PROGRESS"]] }),
  lotTest("lt-c2", "External Visual Inspection", "PENDING", { source: "MANUAL", requirementId: "req-b2",
    hist: [["2026-07-26 09:00", "A. Sharma", "Lot raised → PENDING"]] }),
  lotTest("lt-c3", "Electrical Test", "PENDING", { source: "MANUAL", requirementId: "req-b3",
    hist: [["2026-07-26 09:00", "A. Sharma", "Lot raised → PENDING"]] }),
  lotTest("lt-c4", "X-Ray Inspection", "PENDING", { source: "MANUAL", requirementId: "req-b4",
    hist: [["2026-07-26 09:00", "A. Sharma", "Lot raised → PENDING"]] }),
];

const REPORT_A1: WhlReport = {
  id: "rep-a1", reportNo: "352146.1", revision: 1, reportDate: "2026-07-24", workOrderNo: "352146",
  fileName: "WHL-352146.1.pdf", receivedAt: "2026-07-24 15:20", current: false,
  partNumber: "STM32F407VGT6", manufacturer: "STMicroelectronics", lotQty: 300,
  client: "Sharpbuy Global Solutions", clientPo: "ACME-PO-3391",
  conclusion: "NOT_ACCEPTABLE", anyFar: false,
  processes: [
    { name: "Documentation & Packaging Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "General Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "External Visual Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "Electrical Test", result: "NOT_ACCEPTABLE", acceptQty: 18, rejectQty: 2, note: "2 units outside Vdd tolerance." },
    { name: "X-Ray Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "Decapsulation & Die Analysis", result: "NOT_CONDUCTED", note: "Held pending electrical re-test." },
  ],
  approvedBy: "K. Ng", approverTitle: "Laboratory Manager", standards: ["AS6081", "AS6171"],
  riskClass: "ERAI Low Risk", msl: "MSL 3", packageType: "LQFP-100",
  confidentialityNote: WHL_CONFIDENTIALITY, parseFlags: [],
  accessLog: [{ at: "2026-07-24 15:35", by: "A. Sharma", action: "VIEW" }],
};

const REPORT_A2: WhlReport = {
  ...REPORT_A1,
  id: "rep-a2", reportNo: "352146.2", revision: 2, reportDate: "2026-07-25",
  fileName: "WHL-352146.2.pdf", receivedAt: "2026-07-25 16:05", current: true,
  revisionNote: "Revision 2 — supersedes 352146.1. Electrical re-test on the 2 flagged units passed; die analysis completed.",
  conclusion: "ACCEPTABLE", anyFar: false,
  processes: [
    { name: "Documentation & Packaging Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "General Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "External Visual Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "Electrical Test", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0, note: "Re-test on the 2 flagged units passed." },
    { name: "X-Ray Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "Decapsulation & Die Analysis", result: "ACCEPTABLE", acceptQty: 3, rejectQty: 0, note: "Die marking matches STMicroelectronics reference." },
  ],
  parseFlags: [],
  accessLog: [{ at: "2026-07-25 16:12", by: "R. Menon", action: "DOWNLOAD" }, { at: "2026-07-25 16:08", by: "A. Sharma", action: "VIEW" }],
};

const REPORT_B1: WhlReport = {
  id: "rep-b1", reportNo: "352147.1", revision: 1, reportDate: "2026-07-26", workOrderNo: "352147",
  fileName: "WHL-352147.1.pdf", receivedAt: "2026-07-26 14:40", current: true,
  partNumber: "TPS54560DDAR", manufacturer: "Texas Instruments", lotQty: 150,
  client: "Sharpbuy Global Solutions", clientPo: "PO Unknown",
  conclusion: "ACCEPTABLE", anyFar: true,
  processes: [
    { name: "Documentation & Packaging Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "External Visual Inspection", result: "ACCEPTABLE", acceptQty: 20, rejectQty: 0 },
    { name: "Electrical Test", result: "ACCEPTABLE", acceptQty: 19, rejectQty: 1, note: "1 unit marginal but within AQL." },
    { name: "X-Ray Inspection", result: "FAR", acceptQty: 19, rejectQty: 1, note: "Void anomaly on 1 unit — further analysis recommended." },
  ],
  approvedBy: "K. Ng", approverTitle: "Laboratory Manager", standards: ["AS6081"],
  riskClass: "ERAI Low Risk", msl: "MSL 1", packageType: "SO PowerPAD-8",
  confidentialityNote: WHL_CONFIDENTIALITY,
  parseFlags: ["Client P/O came back as “PO Unknown” — reconcile against the PO on file."],
  accessLog: [{ at: "2026-07-26 14:52", by: "A. Sharma", action: "VIEW" }],
};

// LOT-A's Acceptable result was circulated; LOT-B/LOT-C are deliberately un-notified
// so the "Next actions" flow has something to do in the demo.
const LOT_A_NOTIFICATIONS: LotNotification[] = [
  { id: "ntf-a1", party: "SUPPLIER", to: "quality@shenzhenmicro.example", at: "2026-07-25 16:30", by: "A. Sharma", status: "SENT",
    reportNo: "352146.2", attachments: ["WHL-352146.2.pdf"],
    subject: "Test result — STM32F407VGT6 / Lot LOT-A — Acceptable (SPO-2026-0148)",
    body: "Dear supplier,\n\nThe independent test on the lot supplied against SPO-2026-0148 is complete.\n\n· MPN: STM32F407VGT6 (date code 2325)\n· Lot: LOT-A — qty 300, sample 20\n· Test report: 352146.2 dated 2026-07-25\n· Conclusion: Acceptable\n\nThe lot is accepted. We are proceeding with onward logistics and payment per the agreed terms.\n\nRegards,\nSourcing Ops\nSharpbuy Global Solutions",
    note: "Masked — buyer identity, client PO and sell price withheld. Report shared under NDA — internal use by the recipient only." },
  { id: "ntf-a2", party: "BUYER", to: "procurement@acme.example", at: "2026-07-25 16:35", by: "A. Sharma", status: "SENT",
    reportNo: "352146.2", attachments: ["WHL-352146.2.pdf"],
    subject: "ORD-2026-000148 — test result for STM32F407VGT6 / Lot LOT-A — Acceptable",
    body: "Dear customer,\n\nIndependent testing on your order against ACME-PO-3391 is complete.\n\n· MPN: STM32F407VGT6 (date code 2325)\n· Lot: LOT-A — qty 300, sample 20\n· Test report: 352146.2 dated 2026-07-25\n· Conclusion: Acceptable\n· Laboratory: WHL Shenzhen\n\nThe lot has passed the agreed screen and is cleared for dispatch. We will confirm the delivery schedule shortly.\n\nRegards,\nSourcing Ops\nSharpbuy Global Solutions",
    note: "Masked — supplier identity, buy price and inbound AWB withheld. Report shared under NDA — internal use by the recipient only." },
  { id: "ntf-a3", party: "ESCROW", to: "ops@hkin.example", at: "2026-07-25 16:40", by: "R. Menon", status: "SENT",
    reportNo: "352146.2", attachments: ["WHL-352146.2.pdf"],
    subject: "Escrow ES2607-5881 — release trigger evidence — Lot LOT-A Acceptable",
    body: "Dear HKIN team,\n\nRe escrow ES2607-5881 for ORD-2026-000148:\n\n· MPN: STM32F407VGT6\n· Lot: LOT-A — qty 300, sample 20\n· Test report: 352146.2 dated 2026-07-25\n· Conclusion: Acceptable\n\nThe release trigger (independent lab PASS) is satisfied for this lot. Please treat the attached report as the supporting evidence for the tranche release.\n\nRegards,\nSourcing Ops\nSharpbuy Global Solutions",
    note: "Release-trigger evidence for the escrow provider. Report shared under NDA — internal use by the recipient only." },
];

const HERO_LOTS: Lot[] = [
  { id: "lot-a", orderLineMpn: "STM32F407VGT6", lotCode: "LOT-A", dateCode: "2325", qty: 300, sampleQty: 20,
    testStatus: "PASS", lab: "WHL Shenzhen", workOrderNo: "352146", reportNo: "352146.2", tatDays: 5, testedAt: "2026-07-25",
    clientPoNo: "ACME-PO-3391", tests: LOT_A_TESTS, reports: [REPORT_A1, REPORT_A2], notifications: LOT_A_NOTIFICATIONS },
  { id: "lot-b", orderLineMpn: "TPS54560DDAR", lotCode: "LOT-B", dateCode: "2410", qty: 150, sampleQty: 20,
    testStatus: "MAYBE", lab: "WHL Shenzhen", workOrderNo: "352147", reportNo: "352147.1", tatDays: 6, testedAt: "2026-07-26",
    clientPoNo: "ACME-PO-3391", tests: LOT_B_TESTS, reports: [REPORT_B1] },
  // no report yet → "Not Available" + Request Update; the chase is already past the 3-business-day SLA
  { id: "lot-c", orderLineMpn: "TPS54560DDAR", lotCode: "LOT-C", dateCode: "2412", qty: 100, sampleQty: 15,
    testStatus: "PENDING", lab: "WHL Hong Kong", workOrderNo: "352151", tatDays: 6,
    clientPoNo: "ACME-PO-3391", tests: LOT_C_TESTS, reports: [], lastUpdateRequestAt: "2026-07-24" },
];

const HERO_LAB_EMAILS: LabEmail[] = [
  { id: "em-1", direction: "IN", lotId: undefined, subject: "RE: Testing update", kind: "STATUS_UPDATE", status: "AWAITING_RESPONSE",
    at: "2026-07-28 09:12", by: "WHL Reports",
    body: "Hi, quick update on the parts you sent through — one of the lots needs another day on the electrical bench. Will revert with the report. Regards, WHL",
    matchNote: "Subject line carries no work order, lot or report number — match it manually." },
  { id: "em-2", direction: "OUT", lotId: "lot-c", lotCode: "LOT-C", mpn: "TPS54560DDAR", workOrderNo: "352151", poNo: "ACME-PO-3391",
    subject: "Status request — WO 352151 / Lot LOT-C / TPS54560DDAR", kind: "REQUEST_UPDATE", status: "AWAITING_RESPONSE",
    at: "2026-07-24 11:30", by: "A. Sharma",
    body: "Hi WHL team,\n\nCould you share the current status of:\n· MPN: TPS54560DDAR\n· Lot: LOT-C (qty 100, sample 15)\n· Work order: 352151\n· Client PO: ACME-PO-3391\n\nIf the report is issued, please attach the latest revision.\n\nThanks,\nSharpbuy Global Solutions" },
  { id: "em-3", direction: "IN", lotId: "lot-c", lotCode: "LOT-C", mpn: "TPS54560DDAR", workOrderNo: "352151",
    subject: "Interim status — WO 352151 / Lot LOT-C", kind: "STATUS_UPDATE", status: "UPDATE_RECEIVED",
    at: "2026-07-27 10:15", by: "WHL Reports",
    body: "Intake and documentation check complete for LOT-C. Visual and electrical scheduled for tomorrow." },
  { id: "em-4", direction: "IN", lotId: "lot-b", lotCode: "LOT-B", mpn: "TPS54560DDAR", workOrderNo: "352147",
    subject: "WHL Report 352147.1 — TPS54560DDAR (Lot LOT-B)", kind: "REPORT", status: "REPORT_DELIVERED",
    at: "2026-07-26 14:40", by: "WHL Reports", attachments: ["WHL-352147.1.pdf"],
    body: "Report 352147.1 attached. Overall conclusion Acceptable; X-Ray flagged F.A.R. on one unit — recommend further analysis before release." },
  { id: "em-5", direction: "IN", lotId: "lot-a", lotCode: "LOT-A", mpn: "STM32F407VGT6", workOrderNo: "352146",
    subject: "WHL Report 352146.2 (revised) — STM32F407VGT6 (Lot LOT-A)", kind: "REPORT", status: "REPORT_DELIVERED",
    at: "2026-07-25 16:05", by: "WHL Reports", attachments: ["WHL-352146.2.pdf"],
    body: "Revised report 352146.2 attached, superseding 352146.1. Electrical re-test on the two flagged units passed; die analysis completed. Overall conclusion Acceptable." },
  { id: "em-6", direction: "OUT", lotId: "lot-a", lotCode: "LOT-A", mpn: "STM32F407VGT6", workOrderNo: "352146", poNo: "ACME-PO-3391",
    subject: "Electrical re-test request — WO 352146 / Lot LOT-A", kind: "CUSTOM", status: "UPDATE_RECEIVED",
    at: "2026-07-24 17:40", by: "A. Sharma",
    body: "Supplier disputes the 2 electrical rejects on report 352146.1. Please re-test those units and issue a revised report." },
  { id: "em-7", direction: "IN", lotId: "lot-a", lotCode: "LOT-A", mpn: "STM32F407VGT6", workOrderNo: "352146",
    subject: "WHL Report 352146.1 — STM32F407VGT6 (Lot LOT-A)", kind: "REPORT", status: "REPORT_DELIVERED",
    at: "2026-07-24 15:20", by: "WHL Reports", attachments: ["WHL-352146.1.pdf"],
    body: "Report 352146.1 attached. Electrical Test not acceptable (2 of 20 units outside Vdd tolerance); die analysis held." },
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

// Only the PASSED lot moved — the TPS lots (LOT-B F.A.R., LOT-C untested) are still at the
// lab, so the testing screen's "Arrange logistics" has real headroom to book.
const HERO_SHIPMENTS: Shipment[] = [
  { id: "shp1", shipmentNo: "SHP-IN-148-1", leg: "INBOUND", awb: "DHL 77610233451", carrier: "DHL",
    fromLocation: "WHL Shenzhen", toLocation: "1Buy hub — New Delhi", boxCount: 2, grossWeightKg: 18.4,
    dispatchDate: "2026-07-28", status: "IN_TRANSIT", lastLocation: "Shenzhen, CN",
    carrierRef: "DHL-SHP-IN-148-1", trackingUrl: "https://track.example/DHL77610233451",
    lines: [{ mpn: "STM32F407VGT6", qty: 300 }] },
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
  { id: "d4", subjectType: "LOT", docType: "WHL_REPORT", fileName: "WHL-352146.1.pdf", uploadedBy: "WHL (email)", uploadedAt: "2026-07-24" },
  { id: "d5", subjectType: "LOT", docType: "WHL_REPORT", fileName: "WHL-352146.2.pdf", uploadedBy: "WHL (email)", uploadedAt: "2026-07-25" },
  { id: "d6", subjectType: "LOT", docType: "WHL_REPORT", fileName: "WHL-352147.1.pdf", uploadedBy: "WHL (email)", uploadedAt: "2026-07-26" },
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
      ...base, lines: HERO_LINES, lots: HERO_LOTS, mpnTests: HERO_MPN_TESTS, labEmails: HERO_LAB_EMAILS,
      escrow: HERO_ESCROW, payments: HERO_PAYMENTS, shipments: HERO_SHIPMENTS,
      customs: HERO_CUSTOMS, deliveries: HERO_DELIVERIES, sourcingAllocations: HERO_SOURCING,
      documents: HERO_DOCS, approvals: HERO_APPROVALS, events: HERO_EVENTS,
    };
  }
  const escrow0: Escrow | undefined = o.paymentMode === "ESCROW"
    ? { id: `${o.id}-esc`, provider: "HKIN", externalRef: o.id === "ord-153" ? "ES2607-6120" : "—", currency: o.currency, materialAmount: o.buyTotal,
        chargesAmount: Math.round(o.buyTotal * 0.02), bankingCharges: Math.round(o.buyTotal * 0.005), feeSeller: 300, feeBuyer: 150,
        superInvoiceTotal: Math.round(o.buyTotal * 1.025) + 450, releaseTrigger: o.termsConditions?.length ? "Per T&C + lab PASS" : "WHL PASS",
        paymentTerms: o.terms?.paymentMethod ?? "Advance via T/T into escrow", expiryDate: addDays(o.createdAt, 45),
        status: o.status === "CLOSED" ? "RELEASED" : o.status === "ON_HOLD" ? "FUNDED" : "OPEN", events: [] }
    : undefined;

  // every other order carries a hardcoded detail seed too (see order-details.ts), so
  // each screen — testing, payments, shipments, customs, delivery, docs — has real data
  const d = ORDER_DETAILS[o.id];
  if (d) {
    return {
      ...base, lines: d.lines, lots: d.lots, mpnTests: d.mpnTests, labEmails: d.labEmails,
      escrow: escrow0 ? { ...escrow0, ...d.escrow, events: d.escrow?.events ?? escrow0.events } : undefined,
      payments: d.payments, shipments: d.shipments, customs: d.customs, deliveries: d.deliveries,
      sourcingAllocations: d.sourcingAllocations, documents: d.documents, approvals: d.approvals,
      events: d.events, einvoice: d.einvoice,
      hubAddress: ONEBUY_HUB, buyerAddress: d.buyerAddress ?? base.buyerAddress,
    };
  }

  const approvals: Approval[] = o.approvalStatus === "PENDING"
    ? [{ id: `${o.id}-ap`, subjectType: "ORDER", kind: "PO_REVIEW", role: "Finance", status: "PENDING", notes: "Awaiting review." }]
    : o.approvalStatus === "APPROVED"
    ? [{ id: `${o.id}-ap`, subjectType: "ORDER", kind: "PO_REVIEW", role: "Finance", status: "APPROVED", decidedBy: "R. Menon (Finance)" }]
    : [];
  return {
    ...base, lots: [], mpnTests: [], labEmails: [], escrow: escrow0, payments: [], shipments: [], customs: [], deliveries: [], sourcingAllocations: [],
    documents: [{ id: `${o.id}-po`, subjectType: "ORDER", docType: "PO", fileName: `buyer-po-${o.orderNo}.pdf`, uploadedBy: o.createdBy, uploadedAt: o.createdAt }],
    approvals, events: [],
  };
}

// ---- Client POs (delivery targets) ----
export const CLIENT_POS: ClientPO[] = [
  { id: "cpo-1", clientPoNo: "ACME-PO-3391", client: { name: "Acme Pte", country: "SG" }, paymentMode: "ESCROW", status: "IN_FULFILMENT",
    lines: [{ mpn: "STM32F407VGT6", make: "STMicro", dateCode: "2325", qty: 300, unitPrice: 27.5, requiredBy: "2026-08-20", status: "ALLOCATED" },
            { mpn: "TPS54560DDAR", make: "TI", dateCode: "2410", qty: 250, unitPrice: 2.1, requiredBy: "2026-08-20", status: "OPEN" }] },
  { id: "cpo-2", clientPoNo: "NW-4402", client: { name: "Northwind GmbH", country: "DE" }, paymentMode: "ADVANCE", status: "IN_FULFILMENT",
    terms: { referenceNo: "NW-4402", paymentMethod: "Advance via T/T", deliveryTerms: "Test Report Along with Shipment", testingTerms: "AS6081 screen at WHL", dateCode: "24+" },
    deliveryAddress: { name: "Northwind GmbH", line1: "Robert-Bosch-Straße 14", city: "Stuttgart", state: "BW", pincode: "70178", country: "DE" },
    lines: [{ mpn: "XC7A35T-2FGG484I", make: "AMD (Xilinx)", dateCode: "24+", qty: 120, unitPrice: 296.5, requiredBy: "2026-08-25", status: "ALLOCATED" }] },
  { id: "cpo-3", clientPoNo: "GIPL/26-27/PO/121", client: { name: "GEES Innovations Pvt Ltd", country: "IN", gstin: "33AALCG9069K1Z0", state: "Tamil Nadu" }, paymentMode: "CREDIT", status: "CONFIRMED",
    terms: { referenceNo: "GIPL/26-27/PO/121", gstNote: "GST extra @ actual", deliveryTerms: "Test Report Along with Shipment", paymentMethod: "As agreed" },
    lines: [{ mpn: "MIC5282-5.0YMME-TR", make: "Microchip", dateCode: "25+", qty: 12500, unitPrice: 345.6, requiredBy: "2026-07-20", status: "OPEN" }] },
  // DEMO — domestic client (India), pays us on ADVANCE; sourced from an international supplier on ESCROW (see spo-221)
  { id: "cpo-4", clientPoNo: "BEL/26-27/PO/0042", client: { name: "Bharat Defence Electronics Ltd", country: "IN", gstin: "29AABCB1234M1Z8", state: "Karnataka" }, paymentMode: "ADVANCE", status: "CONFIRMED",
    terms: { referenceNo: "BEL/26-27/PO/0042", gstNote: "GST extra @ actual", deliveryTerms: "Delivered to Bengaluru site, DDP", testingTerms: "Test report along with shipment", paymentMethod: "Advance via T/T" },
    deliveryAddress: { name: "Bharat Defence Electronics Ltd", line1: "Jalahalli Post, IISc Campus Road", city: "Bengaluru", state: "Karnataka", pincode: "560013", country: "IN" },
    lines: [{ mpn: "TMS320F28379DPTPT", make: "TI", dateCode: "24+", qty: 800, unitPrice: 34.5, requiredBy: "2026-09-05", status: "OPEN" },
            { mpn: "AD7768-4BSTZ", make: "Analog Devices", dateCode: "24+", qty: 500, unitPrice: 21.0, requiredBy: "2026-09-05", status: "OPEN" }] },
  // domestic credit client — supplier self-test route (ord-149)
  { id: "cpo-5", clientPoNo: "BEL-DOM/26/PO/77", client: { name: "Bharat Elec", country: "IN", gstin: "07AABCB5678K1Z2", state: "Delhi" }, paymentMode: "CREDIT", status: "IN_FULFILMENT",
    terms: { referenceNo: "BEL-DOM/26/PO/77", gstNote: "GST extra @ actual", paymentMethod: "Net 30 credit", deliveryTerms: "Delivered to Okhla site", testingTerms: "Supplier CoC with each lot" },
    deliveryAddress: { name: "Bharat Elec", line1: "Plot 22, Okhla Industrial Area Phase II", city: "New Delhi", state: "Delhi", pincode: "110020", country: "IN" },
    lines: [{ mpn: "LM317T", make: "TI", dateCode: "25+", qty: 2000, unitPrice: 430, requiredBy: "2026-08-06", status: "DELIVERED" },
            { mpn: "IRF540NPBF", make: "Infineon", dateCode: "25+", qty: 3000, unitPrice: 150, requiredBy: "2026-08-06", status: "ALLOCATED" }] },
  // US client on escrow — the order that went not-acceptable at WHL (ord-153)
  { id: "cpo-6", clientPoNo: "KES-2026-0114", client: { name: "Kestrel Robotics", country: "US" }, paymentMode: "ESCROW", status: "IN_FULFILMENT",
    terms: { referenceNo: "KES-2026-0114", paymentMethod: "Advance via T/T into escrow", deliveryTerms: "DAP Sunnyvale", testingTerms: "AS6081 screen; report before release", dateCode: "24+" },
    deliveryAddress: { name: "Kestrel Robotics Inc", line1: "1180 Bordeaux Drive", city: "Sunnyvale", state: "CA", pincode: "94089", country: "US" },
    lines: [{ mpn: "ADSP-21489KSWZ-4B", make: "Analog Devices", dateCode: "24+", qty: 400, unitPrice: 110, requiredBy: "2026-08-28", status: "ON_HOLD" },
            { mpn: "MAX3232ECPE+", make: "Analog Devices", dateCode: "24+", qty: 800, unitPrice: 29, requiredBy: "2026-08-28", status: "ALLOCATED" }] },
  // completed deal — kept for the closed-order view (ord-144)
  { id: "cpo-7", clientPoNo: "ACME-PO-3210", client: { name: "Acme Pte", country: "SG" }, paymentMode: "ESCROW", status: "CLOSED",
    terms: { referenceNo: "ACME-PO-3210", paymentMethod: "Advance via T/T into escrow", deliveryTerms: "Test report along with shipment", dateCode: "23+" },
    deliveryAddress: { name: "Acme Pte Ltd", line1: "8 Kaki Bukit Avenue 1", city: "Singapore", pincode: "417941", country: "SG" },
    lines: [{ mpn: "STM32F407VGT6", make: "STMicro", dateCode: "2318", qty: 1000, unitPrice: 25, requiredBy: "2026-07-12", status: "DELIVERED" },
            { mpn: "TPS54560DDAR", make: "TI", dateCode: "2402", qty: 3000, unitPrice: 2.2, requiredBy: "2026-07-12", status: "DELIVERED" }] },
  // no-testing domestic deal, still a draft order (ord-155)
  { id: "cpo-8", clientPoNo: "BEL-DOM/26/PO/81", client: { name: "Bharat Elec", country: "IN", gstin: "07AABCB5678K1Z2", state: "Delhi" }, paymentMode: "ADVANCE", status: "CONFIRMED",
    terms: { referenceNo: "BEL-DOM/26/PO/81", gstNote: "GST extra @ actual", paymentMethod: "Advance via T/T", testingTerms: "No incoming test — waived in writing" },
    deliveryAddress: { name: "Bharat Elec", line1: "Plot 22, Okhla Industrial Area Phase II", city: "New Delhi", state: "Delhi", pincode: "110020", country: "IN" },
    lines: [{ mpn: "IRLZ44NPBF", make: "Infineon", dateCode: "25+", qty: 4000, unitPrice: 178, requiredBy: "2026-08-08", status: "OPEN" }] },
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
  // ORDERED POs behind the other seeded orders (so client-PO coverage + the Supplier POs board tally)
  {
    id: "spo-151", poNo: "SPO-2026-0151", supplier: { name: "Taiwan Semi", country: "TW" },
    tradeType: "INTERNATIONAL", currency: "USD", incoterm: "FOB", paymentMode: "ADVANCE", testing: "WHL",
    leadTimeDays: 18, testingTimeDays: 4, deliveryTimeDays: 8,
    terms: {
      referenceNo: "RFQBUNDLE_118820_18_07_2026", paymentMethod: "Advance via T/T", dispatchedThrough: "FedEx",
      destination: "WHL Hong Kong → 1Buy hub", deliveryTerms: "FOB Hsinchu", testingTerms: "AS6081 full screen before onward shipment",
      dateCode: "24+", warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Hong Kong",
    },
    termsConditions: [
      "Goods must be new, genuine & factory-sealed (no refurbished/remarked)",
      "Full traceability — Certificate of Conformance / manufacturer lot",
      "Supplier bears cost on test FAIL (return + re-test)",
    ],
    lines: [{ mpn: "XC7A35T-2FGG484I", make: "AMD (Xilinx)", dateCode: "24+", testing: "WHL", qty: 120, buyUnitPrice: 260, marginPct: 12, clientPoNo: "NW-4402", clientLineMpn: "XC7A35T-2FGG484I" }],
    buyTotal: 31200, createdBy: "A. Sharma", createdAt: "2026-07-20", status: "ORDERED", orderId: "ord-151",
  },
  {
    id: "spo-149", poNo: "SPO-2026-0149", supplier: { name: "Delhi Components", country: "IN", gstin: "07AAACD1234F1Z9", state: "Delhi" },
    tradeType: "DOMESTIC", currency: "INR", incoterm: "EXW", paymentMode: "CREDIT", testing: "SUPPLIER_SELF",
    leadTimeDays: 10, testingTimeDays: 3, deliveryTimeDays: 4, creditDays: 30,
    terms: { referenceNo: "BEL-DOM/26/PO/77", gstNote: "GST extra @ actual", paymentMethod: "Net 30 credit", dispatchedThrough: "Delhivery", testingTerms: "Supplier self-test + CoC with each lot", warranty: "6 months", testFailureBearer: "SUPPLIER" },
    lines: [
      { mpn: "LM317T", make: "TI", dateCode: "25+", testing: "SUPPLIER_SELF", qty: 2000, buyUnitPrice: 380, marginPct: 11, clientPoNo: "BEL-DOM/26/PO/77", clientLineMpn: "LM317T" },
      { mpn: "IRF540NPBF", make: "Infineon", dateCode: "25+", testing: "SUPPLIER_SELF", qty: 3000, buyUnitPrice: 140, marginPct: 10, clientPoNo: "BEL-DOM/26/PO/77", clientLineMpn: "IRF540NPBF" },
    ],
    buyTotal: 1180000, createdBy: "P. Nair", createdAt: "2026-07-19", status: "ORDERED", orderId: "ord-149",
  },
  {
    id: "spo-153", poNo: "SPO-2026-0153", supplier: { name: "Osaka Parts", country: "JP" },
    tradeType: "INTERNATIONAL", currency: "USD", incoterm: "CPT", paymentMode: "ESCROW", testing: "WHL",
    leadTimeDays: 24, testingTimeDays: 7, deliveryTimeDays: 10, relabelCost: 600,
    terms: {
      referenceNo: "RFQBUNDLE_207714_14_07_2026", paymentMethod: "Advance via T/T into escrow", dispatchedThrough: "DHL",
      destination: "WHL Shenzhen → 1Buy hub", deliveryTerms: "CPT Shenzhen", testingTerms: "AS6081 screen; report before escrow release",
      dateCode: "24+", warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Shenzhen",
    },
    termsConditions: [
      "Goods must be new, genuine & factory-sealed (no refurbished/remarked)",
      "Full traceability — Certificate of Conformance / manufacturer lot",
      "Test report / CoA supplied along with the shipment",
      "Supplier bears cost on test FAIL (return + re-test)",
    ],
    lines: [
      { mpn: "ADSP-21489KSWZ-4B", make: "Analog Devices", dateCode: "24+", testing: "WHL", qty: 400, buyUnitPrice: 96.25, marginPct: 14, clientPoNo: "KES-2026-0114", clientLineMpn: "ADSP-21489KSWZ-4B" },
      { mpn: "MAX3232ECPE+", make: "Analog Devices", dateCode: "24+", testing: "WHL", qty: 800, buyUnitPrice: 25.5, marginPct: 13, clientPoNo: "KES-2026-0114", clientLineMpn: "MAX3232ECPE+" },
    ],
    buyTotal: 58900, createdBy: "A. Sharma", createdAt: "2026-07-16", status: "ORDERED", orderId: "ord-153",
  },
  {
    id: "spo-144", poNo: "SPO-2026-0144", supplier: { name: "Shenzhen Micro Co", country: "CN" },
    tradeType: "INTERNATIONAL", currency: "USD", incoterm: "FOB", paymentMode: "ESCROW", testing: "WHL",
    leadTimeDays: 20, testingTimeDays: 5, deliveryTimeDays: 8, relabelCost: 400,
    terms: { referenceNo: "RFQBUNDLE_044210_08_06_2026", paymentMethod: "Advance via T/T into escrow", dispatchedThrough: "DHL", destination: "1Buy hub — New Delhi", deliveryTerms: "Test report along with shipment", dateCode: "23+", warranty: "1 year", testFailureBearer: "SUPPLIER", labLocation: "WHL Shenzhen" },
    lines: [
      { mpn: "STM32F407VGT6", make: "STMicro", dateCode: "2318", testing: "WHL", qty: 1000, buyUnitPrice: 21.5, marginPct: 14, clientPoNo: "ACME-PO-3210", clientLineMpn: "STM32F407VGT6" },
      { mpn: "TPS54560DDAR", make: "TI", dateCode: "2402", testing: "WHL", qty: 3000, buyUnitPrice: 2.0, marginPct: 10, clientPoNo: "ACME-PO-3210", clientLineMpn: "TPS54560DDAR" },
    ],
    buyTotal: 27500, createdBy: "A. Sharma", createdAt: "2026-06-10", status: "ORDERED", orderId: "ord-144",
  },
  {
    id: "spo-155", poNo: "SPO-2026-0155", supplier: { name: "Pune Traders", country: "IN", gstin: "27AAECP1234R1Z5", state: "Maharashtra" },
    tradeType: "DOMESTIC", currency: "INR", incoterm: "EXW", paymentMode: "ADVANCE", testing: "NONE",
    leadTimeDays: 7, testingTimeDays: 0, deliveryTimeDays: 3,
    terms: { referenceNo: "BEL-DOM/26/PO/81", gstNote: "GST extra @ actual", paymentMethod: "Advance via T/T", testingTerms: "No incoming test — waived by client in writing", warranty: "6 months" },
    lines: [{ mpn: "IRLZ44NPBF", make: "Infineon", dateCode: "25+", testing: "NONE", qty: 4000, buyUnitPrice: 160, marginPct: 11, clientPoNo: "BEL-DOM/26/PO/81", clientLineMpn: "IRLZ44NPBF" }],
    buyTotal: 640000, createdBy: "P. Nair", createdAt: "2026-07-25", status: "ORDERED", orderId: "ord-155",
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
