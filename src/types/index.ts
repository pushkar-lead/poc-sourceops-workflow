// Types mirror ~/Downloads/1Source/schema.json (Phase-1 subset). Field names match
// the DDL so these fixtures double as the eventual API contract.

export type OrderStatus =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "ON_HOLD" | "CLOSED" | "CANCELLED";
export type ApprovalStatusField = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
export type TradeType = "DOMESTIC" | "INTERNATIONAL";
export type PaymentMode = "ADVANCE" | "ESCROW" | "CREDIT";
export type TestingMode = "NONE" | "SUPPLIER_SELF" | "WHL";
export type TestStatus = "PENDING" | "PASS" | "FAIL" | "MAYBE";
// per-test (process) status on a lot — WHL's own vocabulary, incl. F.A.R. (Further Analysis Recommended)
export type TestProcessStatus = "PENDING" | "IN_PROGRESS" | "PASSED" | "FAILED" | "NOT_CONDUCTED" | "FAR";
// WHL report verdicts: per-process result and the report's overall conclusion
export type WhlProcessResult = "ACCEPTABLE" | "NOT_ACCEPTABLE" | "FAR" | "NOT_CONDUCTED";
export type WhlConclusion = "ACCEPTABLE" | "NOT_ACCEPTABLE" | "SUSPECT_COUNTERFEIT";
// where a test requirement came from: parsed off the PO, or hand-added by an operator
export type TestSource = "AUTO_PO" | "MANUAL";
export type AutofillState = "PENDING" | "OK" | "FAILED";
export type LabEmailDirection = "OUT" | "IN";
export type LabEmailStatus = "AWAITING_RESPONSE" | "UPDATE_RECEIVED" | "REPORT_DELIVERED" | "ESCALATED" | "SENT";
export type ShipmentLeg = "INBOUND" | "OUTBOUND";
export type ShipmentStatus =
  | "PLANNED" | "DISPATCHED" | "IN_TRANSIT" | "AT_CUSTOMS" | "ARRIVED" | "DELIVERED" | "CANCELLED";
export type JourneyStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "BLOCKED";
export type JourneyPhase =
  | "KICKOFF" | "PAYMENT" | "TESTING" | "EXPORT" | "IMPORT" | "CUSTOMS" | "RELABEL" | "DELIVERY" | "CLOSE";
export type EscrowStatus =
  | "OPEN" | "FUNDED" | "PARTIALLY_RELEASED" | "RELEASED" | "REFUNDED" | "CLOSED";
export type EscrowEventType = "FUND" | "HOLD" | "RELEASE" | "REFUND";
export type PaymentDirection = "CLIENT_TO_1BUY" | "1BUY_TO_SUPPLIER";
export type PaymentStatus = "PENDING" | "INITIATED" | "PAID" | "REFUNDED" | "CANCELLED";
export type ApprovalState = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";

export interface Party {
  name: string;
  country: string; // ISO-ish label, e.g. "SG", "CN", "IN"
  gstin?: string;
  state?: string;
}

// Structured delivery address (buyer ship-to, 1Buy hub, etc.)
export interface Address {
  name?: string;    // site / company label
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

// PO-level terms captured off the buyer/supplier POs (payment · logistics · testing)
export interface PoTerms {
  referenceNo?: string;       // PO ref / RFQ bundle ref
  gstNote?: string;           // e.g. "GST extra @ actual"
  paymentMethod?: string;     // e.g. "Advance via T/T", "LC", "Net 30 credit"
  dispatchedThrough?: string; // carrier
  destination?: string;
  deliveryTerms?: string;     // e.g. "Incoterm EXW ex-works pickup"
  testingTerms?: string;      // e.g. "Test report along with shipment" (separate from delivery)
  destinationPort?: string;   // ship-to port, captured when incoterm = CIF
  packing?: string;           // packing / labelling reqs, WHSO# on box
  dateCode?: string;          // e.g. "25+"
  warranty?: string;          // e.g. "1 year"
  testFailureBearer?: string; // who bears cost on FAIL: SUPPLIER / 1BUY / CLIENT
  labLocation?: string;       // e.g. "WHL Shenzhen & Hong Kong"
}

export interface Order {
  id: string;
  orderNo: string;
  operatingMode: "MOR";
  tradeType: TradeType;
  status: OrderStatus;
  approvalStatus: ApprovalStatusField;
  buyer: Party;      // the client (masked from supplier)
  supplier: Party;   // masked from client
  maskingEntity: string;
  currency: string;
  incoterm: string;
  paymentMode: PaymentMode;
  leadTimeDays: number;
  testingTimeDays: number;
  deliveryTimeDays: number;
  testingMode?: TestingMode; // real testing mode carried from the supplier PO (drives journey/customs)
  expectedDispatchDate: string;
  expectedDeliveryDate: string;
  requiredBy: string;
  buyTotal: number;   // 1Buy → supplier
  sellTotal: number;  // client → 1Buy
  createdBy: string;
  createdAt: string;
  terms?: PoTerms;
  supplierPoId?: string;  // the Supplier PO this fulfilment order was spun from
  supplierPoNo?: string;
  piNo?: string;          // supplier proforma-invoice no (received upstream, uploaded onto the order here)
  hubAddress?: Address;   // inbound destination — the 1Buy hub (relabel + re-dispatch)
  buyerAddress?: Address; // outbound destination — the client's delivery address
  creditDays?: number;    // days of credit when we pay the supplier on CREDIT
  termsConditions?: string[]; // agreed T&Cs carried from the supplier PO
  relabelCost?: number;   // cost of relabelling at the hub (feeds landed cost)
}

// A line on our PO to a supplier. Optionally references a client-PO line
// (partial ok, multi-client). Unlinked lines get mapped to buyer demand later.
export interface SupplierPoLine {
  mpn: string;
  make?: string;
  dateCode?: string;
  testing?: TestingMode; // per-line testing — some MPNs need WHL, some self-test, some none
  qty: number;
  buyUnitPrice: number;
  marginPct: number;
  clientPoNo?: string;
  clientLineMpn?: string;
}

export type SupplierPoStatus = "DRAFT" | "ORDERED";

// Our purchasing document to a supplier. Created BEFORE the fulfilment order —
// you select a Supplier PO and "Create order" to start the journey.
export interface SupplierPO {
  id: string;
  poNo: string;
  supplier: Party;
  tradeType: TradeType;
  currency: string;
  incoterm: string;
  paymentMode: PaymentMode;  // how we pay the supplier
  testing: TestingMode;
  leadTimeDays: number;
  testingTimeDays: number;
  deliveryTimeDays: number;
  terms?: PoTerms;
  lines: SupplierPoLine[];
  buyTotal: number;
  createdBy: string;
  createdAt: string;
  status: SupplierPoStatus;
  orderId?: string;  // set once a fulfilment order is created from this PO
  creditDays?: number;         // days of credit when paymentMode = CREDIT
  termsConditions?: string[];  // agreed standard T&Cs (checkboxes) + extras
  relabelCost?: number;        // relabelling cost at the hub
}

export interface OrderLine {
  id: string;
  lineNo: number;
  mpn: string;
  make: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  dateCode: string;
  coo: string;
  testingRequired: boolean;
  testingMode: TestingMode;
  componentCategory: string;
  lab?: string;
}

// ---- WHL testing: PO → MPN → Lot → Test → status history → report (versioned) → email thread ----

/** One audit row. Every manual test edit and every status change (automated or manual) writes one. */
export interface TestAuditEntry {
  id: string;
  at: string;                 // ISO datetime
  by: string;                 // operator or the automation that did it ("WHL inbox (auto)")
  action: "AUTOFILL" | "ADD" | "DELETE" | "STATUS" | "REPORT" | "RECONCILE" | "EMAIL";
  target?: string;            // test name / report no / lot code the row is about
  before?: string;
  after?: string;
  note?: string;
  sourceEmailId?: string;     // inbound email that triggered an automated change
}

/** A required test as parsed off the PO (never hand-typed unless the operator overrides). */
export interface TestRequirement {
  id: string;
  name: string;               // e.g. "External Visual Inspection"
  standard?: string;          // e.g. "AS6081"
  source: TestSource;
  addedBy?: string;
  addedAt?: string;
}

/**
 * Test requirements for ONE MPN on ONE order (i.e. per PO). The same MPN can carry a
 * different list on another PO/lot, so this is keyed by order + mpn, never globally by mpn.
 */
export interface MpnTestSpec {
  id: string;
  mpn: string;
  autofill: AutofillState;    // FAILED → "needs manual review" flag on the MPN
  autofillNote?: string;      // why it failed (bad scan / no test table / unparseable)
  sourceDoc?: string;         // which PO the tests were parsed from
  parsedAt?: string;
  confidence?: number;
  tests: TestRequirement[];
  audit: TestAuditEntry[];
}

/** Live status of one required test on one lot, with its full progression. */
export interface LotTest {
  id: string;
  requirementId?: string;     // links back to the MpnTestSpec entry it was inherited from
  name: string;
  standard?: string;
  source: TestSource;
  status: TestProcessStatus;
  acceptQty?: number;
  rejectQty?: number;
  updatedAt?: string;
  history: TestAuditEntry[];  // timestamped progression, not just the latest state
}

/** One version of a WHL report (WHL revises: 352146.1, 352146.2 …). */
export interface WhlReportProcess {
  name: string;
  result: WhlProcessResult;
  acceptQty?: number;
  rejectQty?: number;
  note?: string;
}

export interface WhlReport {
  id: string;
  reportNo: string;           // incl. revision, e.g. "352146.2"
  revision: number;
  reportDate: string;
  workOrderNo: string;
  fileName: string;
  receivedAt: string;
  current: boolean;           // exactly one current version per lot
  revisionNote?: string;
  // auto-parsed header fields (surfaced on screen — no need to open the PDF)
  partNumber: string;
  manufacturer: string;
  lotQty: number;
  client: string;
  clientPo: string;           // may come back as "PO Unknown" → reconciliation flag
  conclusion: WhlConclusion;
  anyFar: boolean;            // a process came back F.A.R. even if the overall conclusion is Acceptable
  processes: WhlReportProcess[];
  approvedBy: string;
  approverTitle: string;
  standards: string[];        // e.g. ["AS6081", "AS6171"]
  riskClass?: string;         // e.g. "ERAI Low Risk"
  msl?: string;
  packageType?: string;
  confidentialityNote?: string;
  parseFlags: string[];       // missing/placeholder data needing manual reconciliation
  accessLog: { at: string; by: string; action: "VIEW" | "DOWNLOAD" }[];
}

/** One message in the WHL correspondence thread for a lot. */
export interface LabEmail {
  id: string;
  direction: LabEmailDirection;
  lotId?: string;             // undefined = couldn't be matched → manual-match queue
  lotCode?: string;
  mpn?: string;
  workOrderNo?: string;
  poNo?: string;
  subject: string;
  body: string;
  at: string;
  by: string;                 // sender ("You (demo)" / "WHL Reports")
  status: LabEmailStatus;
  kind: "REQUEST_UPDATE" | "CUSTOM" | "STATUS_UPDATE" | "REPORT" | "ESCALATION";
  attachments?: string[];
  matchedBy?: string;         // set when an operator resolved it out of the manual-match queue
  matchNote?: string;         // why auto-matching failed
}

/** Who we notify once a lot's result is in. Buyer/supplier mails stay masked from each other. */
export type NotifyParty = "SUPPLIER" | "BUYER" | "ESCROW" | "WHL";

export interface LotNotification {
  id: string;
  party: NotifyParty;
  to: string;
  subject: string;
  body: string;
  attachments?: string[];   // the report PDF when the operator chose to attach it
  reportNo?: string;        // which report version the notification was about
  at: string;
  by: string;
  status: "SENT" | "FAILED";
  note?: string;            // failure reason / masking or NDA caveat recorded at send time
}

export interface Lot {
  id: string;
  orderLineMpn: string;
  lotCode: string;
  dateCode: string;
  qty: number;
  sampleQty: number;
  testStatus: TestStatus;
  lab?: string;
  workOrderNo?: string;
  reportNo?: string;          // current report no (incl. revision)
  tatDays?: number;
  testedAt?: string;
  clientPoNo?: string;        // client PO this lot's demand belongs to (report reconciliation)
  tests?: LotTest[];          // inherited from the MPN's spec at lot creation
  reports?: WhlReport[];      // all versions; exactly one `current`
  lastUpdateRequestAt?: string; // SLA clock for an unanswered "Request Update"
  notifications?: LotNotification[]; // result circulated to supplier / buyer / escrow / WHL
}

export interface JourneyStep {
  id: string;
  seq: number;
  phase: JourneyPhase;
  name: string;
  status: JourneyStatus;
  owner: string;
  isGate: boolean;
}

export interface EscrowEvent {
  id: string;
  type: EscrowEventType;
  amount: number;
  trigger: string;
  occurredAt: string;
}

export interface EscrowExtension {
  id: string;
  reason: string;
  newDate: string;
  status: "REQUESTED" | "APPROVED" | "DECLINED";
  requestedAt: string;
  respondedAt?: string;
}

export interface Escrow {
  id: string;
  provider: string;
  externalRef: string;
  currency: string;
  materialAmount: number; // A1
  chargesAmount: number;  // A2
  bankingCharges?: number; // wire / FX / provider banking charges
  feeSeller: number;
  feeBuyer: number;
  superInvoiceTotal: number;
  releaseTrigger: string;
  paymentTerms?: string;   // e.g. "Advance via T/T into escrow"
  expiryDate?: string;     // escrow window expiry (extendable)
  extensions?: EscrowExtension[];
  status: EscrowStatus;
  events: EscrowEvent[];
}

export interface Payment {
  id: string;
  direction: PaymentDirection;
  mode: PaymentMode;
  triggerDoc: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  dueDate?: string;
  paidAt?: string;
  providerRef?: string; // bank transfer ref (from the banking adapter)
  utr?: string;         // settlement UTR once cleared
}

// GST e-Invoice / IRP result (from the e-invoice adapter)
export interface EInvoice {
  irn: string;
  ackNo: string;
  signedQRCode: string;
  generatedAt: string;
  supplyType: string;
}

export interface ShipmentLine {
  mpn: string;
  qty: number;
}

export interface Shipment {
  id: string;
  shipmentNo: string;
  leg: ShipmentLeg;
  awb: string;
  carrier: string;
  ewayBill?: string;
  fromLocation: string;
  toLocation: string;
  boxCount: number;
  grossWeightKg: number;
  dispatchDate?: string;
  deliveryDate?: string;
  status: ShipmentStatus;
  lines: ShipmentLine[];
  carrierRef?: string;   // carrier booking ref (from the logistics adapter)
  trackingUrl?: string;
  lastLocation?: string; // latest tracking checkpoint location (incl. origin/away country)
}

export interface CustomsEntry {
  id: string;
  shipmentNo: string;
  beNo?: string;
  beDate?: string;
  portCode?: string;
  chaName?: string;
  totalDuty?: number;
  currency?: string;
  icegateRef?: string;
  filedAt?: string;
}

export interface SourcingAllocation {
  id: string;
  orderLineId: string;   // which supplier-order line this maps FROM
  clientPoNo: string;
  clientLineMpn: string;
  orderLineMpn: string;
  qty: number;
  marginPct: number;
}

export interface DeliveryAllocation {
  id: string;
  fromShipmentNo: string;
  clientPoNo: string;
  clientLineMpn: string;
  qty: number;
  decidedBy: string;
  decidedAt: string;
  pod?: string;
}

export interface DocumentRef {
  id: string;
  subjectType: string;
  docType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Approval {
  id: string;
  subjectType: string;
  kind: string;
  role: string;
  status: ApprovalState;
  decidedBy?: string;
  notes?: string;
}

export interface OrderEvent {
  id: string;
  eventType: string;
  message: string;
  source: string;
  occurredAt: string;
  recordedBy: string;
}

export interface ClientPO {
  id: string;
  clientPoNo: string;
  client: Party;
  paymentMode: PaymentMode;
  status: string;
  terms?: PoTerms;
  deliveryAddress?: Address; // where we deliver to the buyer (outbound destination)
  lines: { mpn: string; make?: string; dateCode?: string; qty: number; unitPrice: number; requiredBy: string; status: string }[];
}

export interface OrderBundle extends Order {
  lines: OrderLine[];
  journey: JourneyStep[];
  lots: Lot[];
  mpnTests?: MpnTestSpec[];   // PO-parsed test requirements per MPN on this order
  labEmails?: LabEmail[];     // full WHL correspondence (incl. unmatched inbound)
  escrow?: Escrow;
  payments: Payment[];
  shipments: Shipment[];
  customs: CustomsEntry[];
  deliveries: DeliveryAllocation[];
  sourcingAllocations: SourcingAllocation[];
  documents: DocumentRef[];
  approvals: Approval[];
  events: OrderEvent[];
  einvoice?: EInvoice;
}
