// Declarative catalogue of the external systems the real project integrates.
// Drives the Integrations console and documents where each API plugs in.

export type IntegrationPriority = "must" | "should" | "nice";

export interface IntegrationEndpoint {
  method: string;
  path: string;
  purpose: string;
}

export interface IntegrationSystem {
  key: string;
  label: string;
  category: string;
  priority: IntegrationPriority;
  criticalPath: boolean; // true if a journey gate depends on it
  envVar: string;
  baseUrl: string;
  description: string;
  wiredInto: string[]; // store actions that call it
  endpoints: IntegrationEndpoint[];
}

export const INTEGRATIONS: IntegrationSystem[] = [
  {
    key: "escrow-hkin",
    label: "HKIN Escrow",
    category: "Money",
    priority: "must",
    criticalPath: true,
    envVar: "NEXT_PUBLIC_HKIN_BASE_URL",
    baseUrl: "https://sandbox.hkin-escrow.example/api/v1",
    description: "3-party escrow (buyer/seller/agent). Sharpbuy is the account holder; counterparties pass as opaque tokens. Only A1 (material) is releasable to the seller.",
    wiredInto: ["fundEscrow", "releaseEscrow", "refundEscrow"],
    endpoints: [
      { method: "POST", path: "/accounts", purpose: "open account (super-invoice A1+A2)" },
      { method: "POST", path: "/accounts/:ref/fund", purpose: "buyer funds the super-invoice" },
      { method: "POST", path: "/accounts/:ref/release", purpose: "release tranche on WHL PASS" },
      { method: "POST", path: "/accounts/:ref/refund", purpose: "refund on FAIL / cancellation" },
      { method: "GET", path: "/accounts/:ref", purpose: "status + ledger" },
    ],
  },
  {
    key: "banking",
    label: "Banking / T-T rails",
    category: "Money",
    priority: "must",
    criticalPath: true,
    envVar: "NEXT_PUBLIC_BANKING_API_BASE_URL",
    baseUrl: "https://sandbox.bank-partner.example/api/v1",
    description: "Two independent rails with Sharpbuy as the sole pivot: client collection (CLIENT_TO_1BUY) and supplier payout (1BUY_TO_SUPPLIER). The bank never joins the counterparties.",
    wiredInto: ["initiatePaymentTransfer", "setPaymentStatus"],
    endpoints: [
      { method: "POST", path: "/transfers/collection", purpose: "initiate client pay-in (T/T)" },
      { method: "POST", path: "/transfers/payout", purpose: "initiate supplier payout" },
      { method: "GET", path: "/transfers/:ref", purpose: "poll clearing status" },
    ],
  },
  {
    key: "whl",
    label: "WHL Lab",
    category: "Quality",
    priority: "must",
    criticalPath: true,
    envVar: "NEXT_PUBLIC_WHL_API_BASE_URL",
    baseUrl: "https://api.whl-labs.example/v1",
    description: "Authenticity + quality testing. The lab PASS gates the TESTING journey step AND unlocks the escrow release tranche.",
    wiredInto: ["addLot", "fetchLabResult"],
    endpoints: [
      { method: "POST", path: "/work-orders", purpose: "submit a lot for testing" },
      { method: "GET", path: "/work-orders/:wo/report", purpose: "poll for PASS/FAIL/INCONCLUSIVE" },
    ],
  },
  {
    key: "icegate",
    label: "ICEGATE Customs",
    category: "Customs",
    priority: "must",
    criticalPath: true,
    envVar: "NEXT_PUBLIC_ICEGATE_BASE_URL",
    baseUrl: "https://icegate-mock.sandbox.1buy.ai/api",
    description: "Indian Customs EDI: Bill of Entry filing, duty assessment (BCD+SWS+IGST), and the FEMA/ICEGATE ref that closes the import loop. On the critical path for every INTERNATIONAL and A19 order.",
    wiredInto: ["fileBOE"],
    endpoints: [
      { method: "POST", path: "/bill-of-entry", purpose: "file BOE" },
      { method: "GET", path: "/bill-of-entry/:be/assessment", purpose: "duty assessment" },
      { method: "GET", path: "/bill-of-entry/:be/clearance", purpose: "OOC + ICEGATE ref" },
    ],
  },
  {
    key: "einvoice",
    label: "GST e-Invoice / IRP",
    category: "Tax",
    priority: "must",
    criticalPath: true,
    envVar: "NEXT_PUBLIC_IRP_BASE_URL",
    baseUrl: "https://einv-apisandbox.nic.in",
    description: "NIC Invoice Registration Portal (via GSP). Generates the IRN + signed QR that makes the client tax invoice legal and unlocks dispatch. Seller is always the masking entity — supplier never appears.",
    wiredInto: ["generateEInvoice"],
    endpoints: [
      { method: "POST", path: "/invoice", purpose: "generate IRN + signed QR" },
      { method: "POST", path: "/invoice/cancel", purpose: "cancel IRN (24h window)" },
    ],
  },
  {
    key: "logistics",
    label: "Logistics (DHL/FedEx/Delhivery)",
    category: "Logistics",
    priority: "should",
    criticalPath: false,
    envVar: "NEXT_PUBLIC_LOGISTICS_API_BASE_URL",
    baseUrl: "https://sandbox.carrier-aggregator.example/api",
    description: "Per-carrier registry: book an AWB on shipment create and poll tracking checkpoints, mapping carrier-native codes to ShipmentStatus. Inbound AWB never shown to client; outbound never to supplier.",
    wiredInto: ["createShipment", "pollShipmentTracking"],
    endpoints: [
      { method: "POST", path: "/shipments", purpose: "book AWB + label" },
      { method: "GET", path: "/shipments/:awb/tracking", purpose: "checkpoints + status" },
    ],
  },
  {
    key: "doc-extract",
    label: "Doc Extraction (OCR + LLM)",
    category: "Intake",
    priority: "should",
    criticalPath: false,
    envVar: "NEXT_PUBLIC_DOC_EXTRACT_URL",
    baseUrl: "https://doc-ai.sandbox.1buy.ai/api",
    description: "Demand capture: parse an uploaded client PO / supplier PI into structured fields + line items with per-field confidence (mirrors 1Buy's BOM-upload pattern).",
    wiredInto: ["Client PO → New → Parse"],
    endpoints: [
      { method: "POST", path: "/extract/client-po", purpose: "parse a client PO document" },
    ],
  },
];

export const integrationByKey = (key: string) => INTEGRATIONS.find((i) => i.key === key);
