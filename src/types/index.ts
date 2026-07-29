// Types mirror ~/Downloads/1Source/schema.json (Phase-1 subset). Field names match
// the DDL so these fixtures double as the eventual API contract.

export type OrderStatus =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "ON_HOLD" | "CLOSED" | "CANCELLED";
export type ApprovalStatusField = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
export type TradeType = "DOMESTIC" | "INTERNATIONAL";
export type PaymentMode = "ADVANCE" | "ESCROW" | "CREDIT";
export type TestingMode = "NONE" | "SUPPLIER_SELF" | "WHL";
export type TestStatus = "PENDING" | "PASS" | "FAIL" | "MAYBE";
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
  reportNo?: string;
  tatDays?: number;
  testedAt?: string;
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
