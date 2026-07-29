export type Tone = "neutral" | "active" | "warn" | "ok" | "bad" | "info";

export const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  active: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  ok: "bg-ok-bg text-ok",
  bad: "bg-bad-bg text-bad",
  info: "bg-accent-soft text-primary",
};

const OK = ["DONE", "PASS", "PAID", "RELEASE", "RELEASED", "DELIVERED", "APPROVED", "CLOSED", "ARRIVED", "CONFIRMED"];
const BAD = ["FAIL", "REJECTED", "CANCELLED", "BLOCKED", "ON_HOLD", "REFUND", "REFUNDED", "DECLINED"];
const WARN = [
  "PENDING", "PENDING_APPROVAL", "MAYBE", "AT_CUSTOMS", "FUND", "FUNDED", "HOLD", "PLANNED",
  "OPEN", "PARTIALLY_RELEASED", "INITIATED", "SKIPPED", "REQUESTED",
];
const ACTIVE = ["ACTIVE", "IN_TRANSIT", "DISPATCHED", "IN_PROGRESS", "IN_FULFILMENT"];

export function statusTone(s?: string): Tone {
  if (!s) return "neutral";
  const S = s.toUpperCase();
  if (OK.includes(S)) return "ok";
  if (BAD.includes(S)) return "bad";
  if (WARN.includes(S)) return "warn";
  if (ACTIVE.includes(S)) return "active";
  return "neutral";
}

export function prettyStatus(s?: string) {
  if (!s) return "—";
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Grouped navigation. Each group renders under a heading in the sidebar.
export const NAV_GROUPS = [
  { group: null, items: [
    { href: "/fulfilment", label: "Dashboard", icon: "LayoutDashboard" },
  ] },
  { group: "Create", items: [
    { href: "/fulfilment/client-pos", label: "Client POs", icon: "FileText" },
    { href: "/fulfilment/supplier-pos", label: "Supplier POs", icon: "ClipboardList" },
  ] },
  { group: "Operate", items: [
    { href: "/fulfilment/orders", label: "Orders", icon: "Package" },
    { href: "/fulfilment/approvals", label: "Approvals", icon: "CheckCircle2" },
    { href: "/fulfilment/testing", label: "Testing", icon: "FlaskConical" },
    { href: "/fulfilment/logistics", label: "Logistics", icon: "Truck" },
    { href: "/fulfilment/warehouse", label: "Warehouse", icon: "Warehouse" },
    { href: "/fulfilment/delivery", label: "Delivery", icon: "PackageCheck" },
  ] },
  { group: "Finance & Tax", items: [
    { href: "/fulfilment/payments", label: "Payments", icon: "Wallet" },
    { href: "/fulfilment/escrow", label: "Escrow", icon: "Landmark" },
  ] },
  { group: "Reference", items: [
    { href: "/fulfilment/integrations", label: "Integrations", icon: "Webhook" },
    { href: "/fulfilment/guide", label: "Guide", icon: "BookOpen" },
  ] },
] as const;

// Flat list kept for any callers that need every route.
export const NAV: { href: string; label: string; icon: string }[] =
  NAV_GROUPS.flatMap((g) => g.items.map((it) => ({ href: it.href, label: it.label, icon: it.icon })));

export const ROLES = ["SC", "Finance", "Approver", "Mgmt"] as const;
export type Role = (typeof ROLES)[number];

// ---- reference lists (stand in for DB-backed lookups; used to replace free-text inputs) ----
export const CURRENCIES = ["USD", "INR", "EUR", "JPY", "SGD", "TWD", "CNY", "HKD"] as const;
export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DDP"] as const;
export const PAYMENT_METHODS = ["Advance via T/T", "LC at sight", "50% advance / 50% balance", "Net 30 credit", "Net 60 credit", "As agreed"] as const;
export const DISPATCH_MODES = ["DHL", "FedEx", "Delhivery", "UPS", "Sea freight", "Air freight"] as const;
export const LAB_LOCATIONS = ["WHL Shenzhen", "WHL Hong Kong", "WHL Shenzhen & Hong Kong"] as const;
export const DELIVERY_TERMS = ["Test Report Along with Shipment", "Ex-works pickup", "Delivered to hub", "As per PO"] as const;
export const TEST_FAILURE_BEARERS = ["SUPPLIER", "1BUY", "CLIENT"] as const;
export const CREDIT_DAYS = [30, 60, 90] as const;

// Standard supplier-PO terms & conditions — tickboxes; `on` = pre-checked defaults (the usual ones).
export const STANDARD_TNC: { id: string; label: string; on: boolean }[] = [
  { id: "genuine", label: "Goods must be new, genuine & factory-sealed (no refurbished/remarked)", on: true },
  { id: "traceable", label: "Full traceability — Certificate of Conformance / manufacturer lot", on: true },
  { id: "datecode", label: "Date code as specified per line; no mixed date codes without approval", on: true },
  { id: "testreport", label: "Test report / CoA supplied along with the shipment", on: true },
  { id: "failbearer", label: "Supplier bears cost on test FAIL (return + re-test)", on: true },
  { id: "warranty", label: "Warranty: 12 months from delivery against defects", on: true },
  { id: "nopartial", label: "No partial shipment without prior written approval", on: false },
  { id: "rohs", label: "RoHS / REACH compliant; MSD-packed where applicable", on: false },
];

export const WORKSPACE_TABS = [
  "Overview", "Lines", "Allocations", "Journey", "Testing", "Escrow", "Payments",
  "Shipments", "Customs", "Delivery", "Documents", "Events", "Approvals",
] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
