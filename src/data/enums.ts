import type { NotifyParty, TestingStage } from "@/types";

export type Tone = "neutral" | "active" | "warn" | "ok" | "bad" | "info";

export const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  active: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  ok: "bg-ok-bg text-ok",
  bad: "bg-bad-bg text-bad",
  info: "bg-accent-soft text-primary",
};

const OK = [
  "DONE", "PASS", "PAID", "RELEASE", "RELEASED", "DELIVERED", "APPROVED", "CLOSED", "ARRIVED", "CONFIRMED",
  "PASSED", "ACCEPTABLE", "REPORT_DELIVERED", "OK",
];
const BAD = [
  "FAIL", "REJECTED", "CANCELLED", "BLOCKED", "ON_HOLD", "REFUND", "REFUNDED", "DECLINED",
  "FAILED", "NOT_ACCEPTABLE", "SUSPECT_COUNTERFEIT", "ESCALATED",
];
const WARN = [
  "PENDING", "PENDING_APPROVAL", "MAYBE", "AT_CUSTOMS", "FUND", "FUNDED", "HOLD", "PLANNED",
  "OPEN", "PARTIALLY_RELEASED", "INITIATED", "SKIPPED", "REQUESTED",
  "FAR", "AWAITING_RESPONSE",
];
const ACTIVE = ["ACTIVE", "IN_TRANSIT", "DISPATCHED", "IN_PROGRESS", "IN_FULFILMENT", "UPDATE_RECEIVED"];

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
  if (s.toUpperCase() === "FAR") return "F.A.R.";
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

// ---- WHL testing reference data ----
// The processes a WHL report breaks its conclusion down by (each independently
// Acceptable / Not Acceptable / F.A.R. / Not Conducted, often with accept-vs-reject qty).
export const WHL_PROCESSES = [
  "Documentation & Packaging Inspection",
  "General Inspection",
  "External Visual Inspection",
  "Electrical Test",
  "X-Ray Inspection",
  "XRF / Solderability",
  "Decapsulation & Die Analysis",
  "Marking Permanency",
  "Solvent Resistance Test",
  "Scanning Acoustic Microscopy",
] as const;

export const TEST_STANDARDS = ["AS6081", "AS6171", "AS5553", "IDEA-STD-1010", "J-STD-033"] as const;
export const WHL_CONCLUSIONS = ["ACCEPTABLE", "NOT_ACCEPTABLE", "SUSPECT_COUNTERFEIT"] as const;
export const TEST_PROCESS_STATUSES = ["PENDING", "IN_PROGRESS", "PASSED", "FAILED", "FAR", "NOT_CONDUCTED"] as const;
export const WHL_CONTACT = "reports@whitehorselabs.example";
export const WHL_SLA_BUSINESS_DAYS = 3; // an unanswered "Request Update" past this is flagged

// ---- testing lifecycle -------------------------------------------------------------
// The internal stage chain a lot walks between "we asked for testing" and "we have a
// result". The per-test tracker answers *what* was tested; this answers *where the lot
// physically is* — which is the question everyone actually asks while it's at the lab.
//
// Ordered, and only ever traversed forward: a later interim mail can't rewind a lot
// that already has a report. Operators can correct a stage by hand (logged as manual).
//
// Note the tail: testing finishing and the report landing are separate events, and the
// gap between them can be days — the lab can be done on the bench while the write-up is
// still with its reviewer. So "Testing Completed" sits BEFORE report preparation, and the
// chain ends on "Test Report Shared", which is the point we can actually act on.

export const TESTING_STAGES: readonly TestingStage[] = [
  "TEST_REQUESTED",
  "SUPPLIER_DISPATCHING",
  "COMPONENTS_RECEIVED",
  "TESTING_STARTED",
  "TESTING_IN_PROGRESS",
  "TESTING_COMPLETED",
  "REPORT_PREPARATION",
  "REPORT_SHARED",
] as const;

/** The chain's end state — reaching it is what "done" means for a lot. */
export const TESTING_TERMINAL_STAGE: TestingStage = TESTING_STAGES[TESTING_STAGES.length - 1];

/** Who the chain is waiting on at each stage — drives the "waiting on" pill. */
export type StageOwner = "1BUY" | "SUPPLIER" | "WHL";

export interface TestingStageMeta {
  label: string;
  description: string;
  owner: StageOwner;
  /** what normally moves the lot into this stage (shown on stages not yet reached) */
  trigger: string;
}

export const TESTING_STAGE_META: Record<TestingStage, TestingStageMeta> = {
  TEST_REQUESTED: {
    label: "Test Requested",
    description: "Testing request has been initiated.",
    owner: "1BUY",
    trigger: "Work order raised with WHL for this lot.",
  },
  SUPPLIER_DISPATCHING: {
    label: "Supplier Dispatching Components",
    description: "Supplier is preparing and shipping the components to WHL.",
    owner: "SUPPLIER",
    trigger: "Supplier confirms dispatch — record it with courier / AWB.",
  },
  COMPONENTS_RECEIVED: {
    label: "Components Received by WHL",
    description: "WHL has confirmed receipt of the components.",
    owner: "WHL",
    trigger: "Receipt confirmation mail from WHL.",
  },
  TESTING_STARTED: {
    label: "Testing Started",
    description: "Laboratory testing has commenced.",
    owner: "WHL",
    trigger: "WHL mails to say the lot is on the bench.",
  },
  TESTING_IN_PROGRESS: {
    label: "Testing In Progress",
    description: "WHL is actively conducting the required tests and sharing progress updates.",
    owner: "WHL",
    trigger: "Interim progress mails from WHL — each one updates the test tracker.",
  },
  TESTING_COMPLETED: {
    label: "Testing Completed",
    description: "Testing process has been successfully completed.",
    owner: "WHL",
    trigger: "WHL confirms every process in the agreed test plan has been run.",
  },
  REPORT_PREPARATION: {
    label: "Report Preparation",
    description: "Testing is complete and the final report is being compiled.",
    owner: "WHL",
    trigger: "WHL confirms the report is being written / with its reviewer — this can lag the bench work by days.",
  },
  REPORT_SHARED: {
    label: "Test Report Shared",
    description: "WHL has shared the completed test report and results.",
    owner: "WHL",
    trigger: "Report received and parsed onto the lot.",
  },
};

export const stageIdx = (stage?: TestingStage) => (stage ? TESTING_STAGES.indexOf(stage) : -1);
export const stageMeta = (stage: TestingStage) => TESTING_STAGE_META[stage];
export const stageLabel = (stage?: TestingStage) => (stage ? TESTING_STAGE_META[stage].label : "Not started");

export const STAGE_OWNER_LABEL: Record<StageOwner, string> = {
  "1BUY": "1Buy",
  SUPPLIER: "Supplier",
  WHL: "WHL",
};

// Confidentiality: WHL reports carry NDA language — storage/viewing stays internal + access-logged.
export const WHL_CONFIDENTIALITY =
  "CONFIDENTIAL — issued to Sharpbuy Global Solutions under NDA. Internal use only; no redistribution to the client or supplier without WHL's written consent.";

// ---- WHL email templates ----------------------------------------------------------
// Every outbound mail starts from a template with the subject AND body pre-filled from
// the lot's context, so the operator edits a sentence instead of writing from scratch.
export interface WhlMailCtx {
  entity: string;
  mpn?: string;
  lotCode?: string;
  qty?: number;
  sampleQty?: number;
  workOrderNo?: string;
  clientPoNo?: string;
  reportNo?: string;
  lab?: string;
  dateCode?: string;
}

export interface WhlMailTemplate {
  id: string;
  label: string;
  hint: string;
  subject: (c: WhlMailCtx) => string;
  body: (c: WhlMailCtx) => string;
}

const refLine = (c: WhlMailCtx) => [
  c.mpn && `· MPN: ${c.mpn}${c.dateCode ? ` (date code ${c.dateCode})` : ""}`,
  c.lotCode && `· Lot: ${c.lotCode}${c.qty ? ` — qty ${c.qty}${c.sampleQty ? `, sample ${c.sampleQty}` : ""}` : ""}`,
  c.workOrderNo && `· Work order: ${c.workOrderNo}`,
  c.reportNo && `· Report: ${c.reportNo}`,
  c.clientPoNo && `· Client PO: ${c.clientPoNo}`,
  c.lab && `· Lab site: ${c.lab}`,
].filter(Boolean).join("\n");

const sign = (c: WhlMailCtx) => `Thanks,\nSourcing Ops\n${c.entity}`;
const head = (c: WhlMailCtx) => `Hi WHL team,\n\nReference:\n${refLine(c)}\n\n`;
const tag = (c: WhlMailCtx) => `WO ${c.workOrderNo ?? "(pending)"} / Lot ${c.lotCode ?? "—"} / ${c.mpn ?? "—"}`;

export const WHL_EMAIL_TEMPLATES: WhlMailTemplate[] = [
  {
    id: "STATUS_REQUEST", label: "Status request", hint: "Where is this lot? (also used by “Request Update”)",
    subject: (c) => `Status request — ${tag(c)}`,
    body: (c) => `${head(c)}Could you share the current status of the above lot — which processes are complete, which are in progress, and the expected date for the report?\n\nIf the report is already issued, please attach the latest revision.\n\n${sign(c)}`,
  },
  {
    id: "REPORT_REQUEST", label: "Report / latest revision", hint: "Ask for the PDF or the newest revision",
    subject: (c) => `Report request — ${tag(c)}`,
    body: (c) => `${head(c)}Please send the test report for this lot as a PDF. If a revision has been issued since${c.reportNo ? ` ${c.reportNo}` : ""}, share the current version and confirm which report number supersedes which.\n\n${sign(c)}`,
  },
  {
    id: "RETEST_REQUEST", label: "Re-test request (result disputed)", hint: "Supplier disputes a Not-Acceptable result",
    subject: (c) => `Re-test request — ${tag(c)}`,
    body: (c) => `${head(c)}The supplier has disputed the result recorded in${c.reportNo ? ` report ${c.reportNo}` : " your report"} for this lot.\n\nCould you re-test the affected units and issue a revised report? Please confirm:\n1. the units to be re-tested and the method used,\n2. the additional TAT, and\n3. whether any re-test cost applies.\n\n${sign(c)}`,
  },
  {
    id: "FAR_FOLLOWUP", label: "F.A.R. follow-up", hint: "A process came back Further Analysis Recommended",
    subject: (c) => `F.A.R. follow-up — ${tag(c)}`,
    body: (c) => `${head(c)}${c.reportNo ? `Report ${c.reportNo}` : "Your report"} is Acceptable overall, but a process is flagged F.A.R. (Further Analysis Recommended).\n\nBefore we release this lot, please confirm:\n1. which units and which process the F.A.R. applies to,\n2. what further analysis you recommend, with cost and TAT, and\n3. whether the lot can be accepted as-is with a documented caveat.\n\n${sign(c)}`,
  },
  {
    id: "TAT_ESCALATION", label: "TAT escalation", hint: "Past the quoted turnaround / unanswered chase",
    subject: (c) => `Escalation — TAT overdue — ${tag(c)}`,
    body: (c) => `${head(c)}This lot is past the quoted turnaround and our earlier request is still unanswered. The order is held on this result.\n\nPlease confirm today: current stage, blocker, and a committed report date. If the lab site is the constraint, let us know whether the balance testing can be moved.\n\n${sign(c)}`,
  },
  {
    id: "PO_RECONCILE", label: "Reference mismatch", hint: "Report shows “PO Unknown” or the wrong reference",
    subject: (c) => `Reference correction — ${tag(c)}`,
    body: (c) => `${head(c)}The report we received does not carry our reference correctly${c.clientPoNo ? ` — it should read Client P/O ${c.clientPoNo}` : ""}.\n\nPlease re-issue with the correct Client P/O, MPN and lot code so the report reconciles against our PO on file.\n\n${sign(c)}`,
  },
  {
    id: "SAMPLE_QUERY", label: "Sample / test-plan query", hint: "Confirm sample size or a Not-Conducted process",
    subject: (c) => `Test plan query — ${tag(c)}`,
    body: (c) => `${head(c)}Could you confirm the test plan applied to this lot — sample size drawn, standard followed, and the reason any process was recorded as Not Conducted?\n\nOur PO requires the full screen, so please advise if anything is outstanding.\n\n${sign(c)}`,
  },
  {
    id: "NEW_SUBMISSION", label: "New submission / booking", hint: "Tell WHL a lot is on its way",
    subject: (c) => `Incoming submission — ${c.mpn ?? "part"} / Lot ${c.lotCode ?? "—"}`,
    body: (c) => `${head(c)}We are shipping the above lot to you for testing per our PO test plan.\n\nPlease confirm receipt, the work-order number raised against it, and the expected TAT.\n\n${sign(c)}`,
  },
  {
    id: "FREE_TEXT", label: "Blank (free text)", hint: "Context block only — write your own ask",
    subject: (c) => `${tag(c)}`,
    body: (c) => `${head(c)}\n\n${sign(c)}`,
  },
];

export const whlTemplate = (id: string) => WHL_EMAIL_TEMPLATES.find((t) => t.id === id) ?? WHL_EMAIL_TEMPLATES[0];

// ---- "result is in — who do we tell" templates ---------------------------------------
// Masked trade: the supplier mail never names the buyer, the buyer mail never names the
// supplier. Both go out from the masking entity. Escrow gets the release-trigger evidence.
export interface NotifyCtx {
  entity: string;
  orderNo: string;
  mpn: string;
  lotCode: string;
  qty: number;
  sampleQty?: number;
  dateCode?: string;
  reportNo?: string;
  reportDate?: string;
  workOrderNo?: string;
  conclusion?: string;      // ACCEPTABLE / NOT_ACCEPTABLE / SUSPECT_COUNTERFEIT
  anyFar?: boolean;
  clientPoNo?: string;
  supplierPoNo?: string;
  escrowRef?: string;
  releasable?: number;      // A1 still releasable, for the escrow mail
  currency?: string;
  lab?: string;
}

export interface NotifyTemplate {
  party: NotifyParty;
  label: string;
  hint: string;
  to: (c: NotifyCtx) => string;   // mock address; edit before sending
  masking?: string;               // what must NOT appear in this mail
  subject: (c: NotifyCtx) => string;
  body: (c: NotifyCtx) => string;
}

const verdictWord = (c: NotifyCtx) =>
  c.conclusion === "ACCEPTABLE" ? (c.anyFar ? "Acceptable (with one process flagged F.A.R.)" : "Acceptable")
  : c.conclusion === "NOT_ACCEPTABLE" ? "Not Acceptable"
  : c.conclusion === "SUSPECT_COUNTERFEIT" ? "Suspect Counterfeit"
  : "pending";

const lotRef = (c: NotifyCtx) => [
  `· MPN: ${c.mpn}${c.dateCode ? ` (date code ${c.dateCode})` : ""}`,
  `· Lot: ${c.lotCode} — qty ${c.qty}${c.sampleQty ? `, sample ${c.sampleQty}` : ""}`,
  c.reportNo && `· Test report: ${c.reportNo}${c.reportDate ? ` dated ${c.reportDate}` : ""}`,
  c.conclusion && `· Conclusion: ${verdictWord(c)}`,
].filter(Boolean).join("\n");

export const NOTIFY_TEMPLATES: NotifyTemplate[] = [
  {
    party: "SUPPLIER", label: "Notify supplier", hint: "Result + report to the supplier (buyer stays masked)",
    to: () => "quality@supplier.example",
    masking: "The buyer's identity, client PO and sell prices are never included.",
    subject: (c) => `Test result — ${c.mpn} / Lot ${c.lotCode} — ${verdictWord(c)}${c.supplierPoNo ? ` (${c.supplierPoNo})` : ""}`,
    body: (c) => `Dear supplier,\n\nThe independent test on the lot supplied against ${c.supplierPoNo ?? "our PO"} is complete.\n\n${lotRef(c)}\n\n${
      c.conclusion === "ACCEPTABLE"
        ? `The lot is accepted${c.anyFar ? ", subject to closing out the process flagged for further analysis" : ""}. We are proceeding with onward logistics and payment per the agreed terms.`
        : `The lot is NOT accepted. Per the PO, the cost of test failure and return sits with the supplier. Please confirm within 2 business days whether you will (a) replace the lot with fully traceable stock, or (b) accept return and refund.`
    }\n\nThe attached report is issued to us by White Horse Laboratories under NDA and is shared with you solely to evidence this lot's disposition — please do not redistribute it further.\n\nRegards,\nSourcing Ops\n${c.entity}`,
  },
  {
    party: "BUYER", label: "Notify buyer / client", hint: "Result + report to the client (supplier stays masked)",
    to: () => "procurement@client.example",
    masking: "The supplier's identity, buy prices and inbound AWB are never included.",
    subject: (c) => `${c.orderNo} — test result for ${c.mpn} / Lot ${c.lotCode} — ${verdictWord(c)}`,
    body: (c) => `Dear customer,\n\nIndependent testing on your order${c.clientPoNo ? ` against ${c.clientPoNo}` : ""} is complete.\n\n${lotRef(c)}\n${c.lab ? `· Laboratory: ${c.lab}\n` : ""}\n${
      c.conclusion === "ACCEPTABLE"
        ? `The lot has passed the agreed screen${c.anyFar ? ", with one process flagged for further analysis — we are closing that out with the laboratory before dispatch" : " and is cleared for dispatch"}. We will confirm the delivery schedule shortly.`
        : `The lot did not pass the agreed screen and will not be dispatched to you. We are sourcing replacement stock and will confirm the revised schedule; your funds remain protected under the agreed payment terms.`
    }\n\nThe laboratory report is attached for your records. It is issued under NDA — kindly keep it internal to your organisation.\n\nRegards,\nSourcing Ops\n${c.entity}`,
  },
  {
    party: "ESCROW", label: "Notify escrow provider", hint: "Release-trigger evidence to HKIN",
    to: () => "ops@hkin.example",
    masking: "Sent by the masking entity only — counterparties are referenced by escrow token.",
    subject: (c) => `Escrow ${c.escrowRef ?? "(ref)"} — release trigger evidence — Lot ${c.lotCode} ${verdictWord(c)}`,
    body: (c) => `Dear HKIN team,\n\nRe escrow ${c.escrowRef ?? "(ref)"} for ${c.orderNo}:\n\n${lotRef(c)}\n\n${
      c.conclusion === "ACCEPTABLE"
        ? `The release trigger (independent lab PASS) is satisfied for this lot.${c.anyFar ? " Note one process is flagged F.A.R.; we are proceeding on the overall Acceptable conclusion." : ""} Please treat the attached report as the supporting evidence for the tranche release${c.releasable ? ` of up to ${c.currency ?? ""} ${c.releasable}` : ""}.`
        : `The lab result is ${verdictWord(c)} — the release trigger is NOT satisfied. Please hold the funds; a refund instruction may follow once the return is agreed with the seller.`
    }\n\nRegards,\nSourcing Ops\n${c.entity}`,
  },
  {
    party: "WHL", label: "Acknowledge to WHL", hint: "Confirm receipt of the report to the lab",
    to: () => WHL_CONTACT,
    subject: (c) => `Report received — ${c.reportNo ?? "(report)"} / WO ${c.workOrderNo ?? "—"} / Lot ${c.lotCode}`,
    body: (c) => `Hi WHL team,\n\nThank you — report ${c.reportNo ?? ""} for the lot below is received and logged.\n\n${lotRef(c)}\n\n${
      c.anyFar ? "One process is flagged F.A.R. — we will revert separately on the further analysis.\n\n" : ""
    }Please retain the samples until we confirm disposition.\n\nThanks,\nSourcing Ops\n${c.entity}`,
  },
];

export const notifyTemplate = (party: NotifyParty) =>
  NOTIFY_TEMPLATES.find((t) => t.party === party) ?? NOTIFY_TEMPLATES[0];

// ---- digest (many lots, one mail) ----------------------------------------------------
// At 50 lots you don't send 50 mails. A digest lists every selected lot with its verdict
// and splits the disposition paragraph by outcome, so one mail can carry mixed results.
export interface NotifyDigestLot {
  mpn: string;
  lotCode: string;
  qty: number;
  sampleQty?: number;
  dateCode?: string;
  reportNo?: string;
  reportDate?: string;
  conclusion?: string;
  anyFar?: boolean;
  lab?: string;
  workOrderNo?: string;
}

export interface NotifyDigestCtx {
  entity: string;
  orderNo: string;
  supplierPoNo?: string;
  clientPoNo?: string;
  escrowRef?: string;
  currency?: string;
  releasable?: number;
  lots: NotifyDigestLot[];
}

const lotLine = (l: NotifyDigestLot, i: number) => {
  const verdict = l.conclusion === "ACCEPTABLE" ? (l.anyFar ? "Acceptable (one process F.A.R.)" : "Acceptable")
    : l.conclusion === "NOT_ACCEPTABLE" ? "Not Acceptable"
    : l.conclusion === "SUSPECT_COUNTERFEIT" ? "Suspect Counterfeit"
    : "result pending";
  return `${i + 1}. ${l.mpn}${l.dateCode ? ` (DC ${l.dateCode})` : ""} · Lot ${l.lotCode} · qty ${l.qty}`
    + `${l.reportNo ? ` · report ${l.reportNo}${l.reportDate ? ` (${l.reportDate})` : ""}` : ""} — ${verdict}`;
};

const split = (lots: NotifyDigestLot[]) => ({
  ok: lots.filter((l) => l.conclusion === "ACCEPTABLE" && !l.anyFar),
  far: lots.filter((l) => l.conclusion === "ACCEPTABLE" && l.anyFar),
  bad: lots.filter((l) => l.conclusion === "NOT_ACCEPTABLE" || l.conclusion === "SUSPECT_COUNTERFEIT"),
  pending: lots.filter((l) => !l.conclusion),
});
const codes = (lots: NotifyDigestLot[]) => lots.map((l) => l.lotCode).join(", ");

/** Subject + body for a multi-lot notification to one party. */
export function notifyDigest(party: NotifyParty, c: NotifyDigestCtx): { subject: string; body: string } {
  const n = c.lots.length;
  const list = c.lots.map(lotLine).join("\n");
  const g = split(c.lots);
  const nda = "The attached report(s) are issued to us by White Horse Laboratories under NDA and are shared solely to evidence these lots' disposition — please do not redistribute them further.";
  const sign = `Regards,\nSourcing Ops\n${c.entity}`;
  const mixed = [
    g.ok.length ? `Accepted: ${codes(g.ok)}.` : "",
    g.far.length ? `Accepted subject to F.A.R. close-out: ${codes(g.far)}.` : "",
    g.bad.length ? `Not accepted: ${codes(g.bad)}.` : "",
    g.pending.length ? `Result still pending: ${codes(g.pending)}.` : "",
  ].filter(Boolean).join("\n");

  switch (party) {
    case "SUPPLIER":
      return {
        subject: `Test results — ${n} lot(s) against ${c.supplierPoNo ?? "our PO"}${g.bad.length ? ` — ${g.bad.length} not accepted` : ""}`,
        body: `Dear supplier,\n\nIndependent testing is complete on the following lot(s) supplied against ${c.supplierPoNo ?? "our PO"}:\n\n${list}\n\n${mixed}\n\n${
          g.bad.length ? "For the lots not accepted, the PO places the cost of test failure and return with the supplier. Please confirm within 2 business days whether you will replace with fully traceable stock, or accept return and refund.\n\n" : ""
        }${g.ok.length + g.far.length ? "For the accepted lots we are proceeding with onward logistics and payment per the agreed terms.\n\n" : ""}${nda}\n\n${sign}`,
      };
    case "BUYER":
      return {
        subject: `${c.orderNo} — test results for ${n} lot(s)${c.clientPoNo ? ` (${c.clientPoNo})` : ""}`,
        body: `Dear customer,\n\nIndependent testing on your order${c.clientPoNo ? ` against ${c.clientPoNo}` : ""} is complete for the following lot(s):\n\n${list}\n\n${mixed}\n\n${
          g.ok.length + g.far.length ? "The accepted lots are cleared for dispatch and we will confirm the delivery schedule shortly.\n\n" : ""
        }${g.bad.length ? "The lots not accepted will not be dispatched to you. We are sourcing replacement stock and will confirm the revised schedule; your funds remain protected under the agreed payment terms.\n\n" : ""}The laboratory report(s) are attached for your records. They are issued under NDA — kindly keep them internal to your organisation.\n\n${sign}`,
      };
    case "ESCROW":
      return {
        subject: `Escrow ${c.escrowRef ?? "(ref)"} — release trigger evidence — ${n} lot(s)`,
        body: `Dear HKIN team,\n\nRe escrow ${c.escrowRef ?? "(ref)"} for ${c.orderNo}, the independent lab results for the following lot(s):\n\n${list}\n\n${mixed}\n\n${
          g.ok.length + g.far.length ? `The release trigger (independent lab PASS) is satisfied for ${codes([...g.ok, ...g.far])}. Please treat the attached report(s) as supporting evidence for the tranche release${c.releasable ? ` of up to ${c.currency ?? ""} ${c.releasable}` : ""}.\n\n` : ""
        }${g.bad.length ? `The trigger is NOT satisfied for ${codes(g.bad)} — please hold those funds; a refund instruction may follow once the return is agreed with the seller.\n\n` : ""}${sign}`,
      };
    case "WHL":
    default:
      return {
        subject: `Reports received — ${n} lot(s) / ${c.orderNo}`,
        body: `Hi WHL team,\n\nThank you — the following reports are received and logged:\n\n${list}\n\n${
          g.far.length ? `We will revert separately on the further analysis for ${codes(g.far)}.\n\n` : ""
        }Please retain the samples until we confirm disposition.\n\nThanks,\nSourcing Ops\n${c.entity}`,
      };
  }
}

// Access control — only these personas may override auto-filled tests or email WHL on our behalf.
export const TEST_EDIT_ROLES: Role[] = ["SC", "Mgmt"];
export const LAB_EMAIL_ROLES: Role[] = ["SC", "Mgmt"];

export const WORKSPACE_TABS = [
  "Overview", "Lines", "Allocations", "Journey", "Testing", "Escrow", "Payments",
  "Shipments", "Customs", "Delivery", "Documents", "Events", "Approvals",
] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
