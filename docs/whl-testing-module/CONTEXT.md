# WHL Testing Module — Portable Specification

Complete, implementation-ready spec for the **WHL (White Horse Laboratories) testing section** of a
component-trade fulfilment console. It is written to be dropped into *any* codebase: it defines the
data model, derived state, actions, mock integration contracts, email/notification copy, UI layout and
invariants precisely enough to rebuild the module byte-for-behaviour without seeing the original code.

Pair this file with `PROMPT.md` (the instruction to give Claude in the target repo).

- **Frontend only.** No backend, no real mail, no real OCR. All external systems are in-memory mock
  adapters behind a logging transport; all state is client-side and persisted locally.
- **Reference implementation:** `poc-sourceops-workflow` (Next.js 16 + React 19 + Zustand + Tailwind v4).
  File inventory in §12. Nothing here depends on those choices — §11 maps the seams.

---

## 1. What the module does

The primary screen lives on **one order** and answers four questions:

1. **What tests does each MPN need?** — auto-filled by parsing the PO (never hand-typed), with an
   audited manual override and an explicit "auto-fill failed — needs manual review" state.
2. **Where does every test stand, per lot?** — a live status tracker per MPN × lot × test, updated
   automatically from inbound lab email, with full timestamped history (not just latest state).
3. **What does the report say?** — a per-lot report repository holding *all* revisions, with the key
   fields and the process-level result matrix parsed on screen so nobody opens the PDF.
4. **What happens next?** — per-lot and bulk follow-through: notify supplier / buyer / escrow / lab
   (report attached), or hand off to logistics with a shipment pre-filled.

Plus the plumbing that makes it trustworthy: a WHL correspondence thread per lot, a manual-match queue
for unroutable inbound mail, reconciliation alerts, an SLA clock on unanswered chases, an audit trail on
every change, role-gated actions and an NDA access log on reports.

### Non-goals

- Lot creation / numbering / association logic is **pre-existing and unchanged** — this module consumes
  lots, it does not redesign them.
- The escrow/payment state machine is **unchanged** — the lot verdict keeps driving it exactly as before.

---

## 2. Domain primer (read this or the model won't make sense)

| Term | Meaning |
|---|---|
| **Masked back-to-back trade** | Three parties: client (buyer) → masking entity (us) → supplier. The buyer must never learn the supplier and vice-versa. Every outbound mail must respect this. |
| **MPN** | Manufacturer part number, e.g. `STM32F407VGT6`. The unit of demand and of test requirements. |
| **Lot** | A physical batch of one MPN submitted for testing: lot code, date code, qty, sample qty, lab, work-order no. One MPN can have several lots; one order has many lots. |
| **WHL** | The independent test lab. Communicates **by email**: interim status notes, delay notices, report PDFs, revised reports. |
| **Work order no.** | WHL's internal job id for a submitted lot, e.g. `352146`. |
| **Report no. + revision** | WHL issues `352146.1`, then `352146.2` when a result is revised. All versions are kept; exactly one is *current*. |
| **Client PO no.** | The buyer's PO. Appears on WHL reports and must reconcile with the PO on file — WHL sometimes prints `PO Unknown`. |
| **Process** | A step inside a report (Documentation & Packaging, General Inspection, External Visual, Electrical Test, X-Ray, Decapsulation & Die Analysis, …), each independently graded. |
| **F.A.R.** | *Further Analysis Recommended.* A per-process verdict. A report can be **Acceptable overall** while one process is F.A.R. — that still needs follow-up. This is the single most-missed nuance. |
| **Conclusion set** | WHL's own overall verdicts: **Acceptable / Not Acceptable / Suspect Counterfeit**. Not a generic pass/fail. |
| **Escrow release trigger** | Money is released to the supplier on an independent lab PASS. So a lot verdict has financial consequence. |
| **Three identifiers** | Client PO no., WHL work-order no., WHL report no. (with revision) are *separate* keys and must all be tracked; email routing and reconciliation depend on them. |

---

## 3. Data model

Verbatim TypeScript. Field comments are part of the spec.

```ts
// ---- status vocabularies ----
export type TestStatus = "PENDING" | "PASS" | "FAIL" | "MAYBE";          // LOT-level (pre-existing)
export type TestProcessStatus = "PENDING" | "IN_PROGRESS" | "PASSED" | "FAILED" | "NOT_CONDUCTED" | "FAR";
export type WhlProcessResult = "ACCEPTABLE" | "NOT_ACCEPTABLE" | "FAR" | "NOT_CONDUCTED";
export type WhlConclusion = "ACCEPTABLE" | "NOT_ACCEPTABLE" | "SUSPECT_COUNTERFEIT";
export type TestSource = "AUTO_PO" | "MANUAL";
export type AutofillState = "PENDING" | "OK" | "FAILED";
export type LabEmailDirection = "OUT" | "IN";
export type LabEmailStatus = "AWAITING_RESPONSE" | "UPDATE_RECEIVED" | "REPORT_DELIVERED" | "ESCALATED" | "SENT";
export type NotifyParty = "SUPPLIER" | "BUYER" | "ESCROW" | "WHL";

/** One audit row. Every manual test edit and every status change (automated or manual) writes one. */
export interface TestAuditEntry {
  id: string;
  at: string;                 // "YYYY-MM-DD HH:mm" — datetime precise, not date
  by: string;                 // operator, or the automation ("WHL inbox (auto)", "Doc extraction (auto)")
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
  confidence?: number;        // 0..1
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

export interface WhlReportProcess {
  name: string;
  result: WhlProcessResult;
  acceptQty?: number;
  rejectQty?: number;
  note?: string;
}

/** One version of a WHL report (WHL revises: 352146.1, 352146.2 …). */
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
  msl?: string;               // e.g. "MSL 3"
  packageType?: string;       // e.g. "LQFP-100"
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
  by: string;                 // "You (demo)" / "WHL Reports"
  status: LabEmailStatus;
  kind: "REQUEST_UPDATE" | "CUSTOM" | "STATUS_UPDATE" | "REPORT" | "ESCALATION";
  attachments?: string[];
  matchedBy?: string;         // set when an operator resolved it out of the manual-match queue
  matchNote?: string;         // why auto-matching failed
}

/** A circulated result: who was told, when, and whether the report rode along. */
export interface LotNotification {
  id: string;
  party: NotifyParty;
  to: string;
  subject: string;
  body: string;
  attachments?: string[];
  reportNo?: string;
  at: string;
  by: string;
  status: "SENT" | "FAILED";
  note?: string;             // masking caveat / NDA disclosure / failure reason
}

/** EXISTING entity — only the last four fields are added by this module. */
export interface Lot {
  id: string;
  orderLineMpn: string;
  lotCode: string;
  dateCode: string;
  qty: number;
  sampleQty: number;
  testStatus: TestStatus;     // drives escrow release / refund — DO NOT repurpose
  lab?: string;
  workOrderNo?: string;
  reportNo?: string;          // current report no (incl. revision)
  tatDays?: number;
  testedAt?: string;
  clientPoNo?: string;        // ← added: client PO this lot's demand belongs to (reconciliation)
  tests?: LotTest[];          // ← added: inherited from the MPN's spec at lot creation
  reports?: WhlReport[];      // ← added: all versions; exactly one `current`
  lastUpdateRequestAt?: string; // ← added: SLA clock for an unanswered "Request Update"
  notifications?: LotNotification[]; // ← added
}

/** Order-level containers added by this module. */
export interface OrderBundle /* extends the host's order aggregate */ {
  mpnTests?: MpnTestSpec[];   // PO-parsed test requirements per MPN on this order
  labEmails?: LabEmail[];     // full WHL correspondence (incl. unmatched inbound)
}
```

**Entity chain:** `PO → MpnTestSpec (per MPN) → Lot → LotTest → TestAuditEntry[] → WhlReport[] (versioned) → LabEmail[] / LotNotification[]`

### Status → colour tone map

Feed these into the host's existing badge/pill component. Tones: `ok | bad | warn | active | neutral`.

| Tone | Values |
|---|---|
| `ok` | `PASS`, `PASSED`, `ACCEPTABLE`, `REPORT_DELIVERED`, `DONE`, `APPROVED`, `RELEASED`, `DELIVERED` |
| `bad` | `FAIL`, `FAILED`, `NOT_ACCEPTABLE`, `SUSPECT_COUNTERFEIT`, `ESCALATED`, `REJECTED`, `BLOCKED`, `REFUNDED` |
| `warn` | `FAR`, `MAYBE`, `PENDING`, `AWAITING_RESPONSE`, `FUNDED`, `REQUESTED` |
| `active` | `IN_PROGRESS`, `UPDATE_RECEIVED`, `ACTIVE`, `IN_TRANSIT` |
| `neutral` | `NOT_CONDUCTED`, `SENT`, anything unmapped |

Display rule: render `FAR` as **“F.A.R.”**, never “Far”. Render other enums title-cased with `_` → space.

---

## 4. Reference data (exact values)

```ts
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
export const WHL_SLA_BUSINESS_DAYS = 3;   // unanswered "Request Update" past this → flagged

export const WHL_CONFIDENTIALITY =
  "CONFIDENTIAL — issued to <MASKING ENTITY> under NDA. Internal use only; no redistribution to the client or supplier without WHL's written consent.";

// role gate — only these personas may override auto-filled tests or mail on our behalf
export const TEST_EDIT_ROLES = ["SC", "Mgmt"];
export const LAB_EMAIL_ROLES = ["SC", "Mgmt"];
```

Test plan by testing mode (used by the PO parser mock):

- `WHL` → first **6** of `WHL_PROCESSES`, standard `AS6081`
- `SUPPLIER_SELF` → `["Documentation & Packaging Inspection", "General Inspection", "Electrical Test"]`, no standard
- `NONE` → empty list + note `"PO specifies no incoming test for this MPN."` (this is **not** a failure)

---

## 5. Derived state (pure functions)

```ts
specForMpn(bundle, mpn)            → MpnTestSpec | undefined

lotTestProgress(lot)               → { total, settled, far, failed, open, notConducted }
// settled = tests with status PASSED. open = PENDING + IN_PROGRESS.
// F.A.R. and NOT_CONDUCTED are NOT settled — they need follow-up.

currentReport(lot)                 → the report with current === true, else highest revision

lotEmails(bundle, lotId)           → emails whose lotId matches
unmatchedEmails(bundle)            → inbound emails with no lotId  (the manual-match queue)

testAutofillGaps(bundle)           → for each order line with testingMode !== "NONE":
                                     no spec, or spec.autofill === "FAILED", or spec.tests empty

overdueUpdateRequests(bundle)      → lots with lastUpdateRequestAt whose business-day age
                                     >= WHL_SLA_BUSINESS_DAYS, as { lot, days }

reconciliationAlerts(bundle)       → for every CURRENT report, one entry per parseFlag:
                                     { lotId, lotCode, reportId, reportNo, message, kind }
                                     kind = "PO" if the flag mentions client p/o,
                                            "MPN" if it mentions mpn, else "DATA"

testingSummary(bundle, lotId?)     → { lots, tests, passed, far, failed, notConducted, open,
                                       reports, awaiting, unmatched, gaps, overdue }
// lotId scopes EVERY number to one lot — except `unmatched`, which is always order-wide
// (unmatched mail isn't attached to a lot yet; that's the point of the queue).
// reports = sum of lot.reports.length (revisions count separately).

lotResults(bundle)                 → one row per lot:
   { lot, progress, pct, report, revisions, awaiting, overdueDays, blocker }
// pct = round(progress.settled / progress.total * 100), 0 when total === 0
// awaiting = count of OUT emails on the lot with status AWAITING_RESPONSE
// blocker = first match, in this order:
//     failed > 0        → "not-acceptable result"
//     far > 0           → "F.A.R. — needs follow-up"
//     notConducted > 0  → "process not conducted"
//     total === 0       → "no tests on file"
//     open > 0          → "<n> test(s) still open"
//     else              → null   (rendered as "clear")
```

Business-day age: count weekdays strictly between the request date and today (`Mon–Fri`), i.e. iterate
days from the date, count non-weekend days, subtract 1.

---

## 6. Actions (state transitions)

Every action is optimistic-then-confirmed where it calls an adapter, toasts its outcome, and writes audit
where the spec says so. `stamp()` = `"YYYY-MM-DD HH:mm"`, `today()` = `"YYYY-MM-DD"`.

| Action | Signature | Behaviour |
|---|---|---|
| **autofillMpnTests** | `(orderId, mpn?)` | Parse the PO's test table for one MPN or all lines. Per MPN: build/replace the spec, `autofill: "OK"` or `"FAILED"` (+ note), stamp `sourceDoc`/`parsedAt`/`confidence`. **Preserve existing MANUAL tests across a re-parse.** Append an `AUTOFILL` audit row (before = old test count, after = new). Push newly-parsed tests onto every existing lot of that MPN that lacks them (each with an `ADD` history row). Whole-document failure ⇒ mark *every* target MPN `FAILED` with the error as the note — never leave blank. Toast: success, or `"N MPN(s) need manual review — auto-fill failed."` |
| **addMpnTest** | `(orderId, mpn, { name, standard? })` | Manual override. Ignore duplicates (case-insensitive). Push `TestRequirement` with `source: "MANUAL"`, `addedBy`, `addedAt`. Append `ADD` audit row noting "Manual override of the auto-filled list." If spec was `FAILED`, move it to `PENDING` (a human has now reviewed it). Propagate to every lot of that MPN. |
| **removeMpnTest** | `(orderId, mpn, testId)` | Remove from spec, append `DELETE` audit row (before = "auto-filled test"/"manual test", after = "—"), remove the matching row from every lot of that MPN. |
| **setLotTestStatus** | `(orderId, lotId, lotTestId, status, note?)` | No-op if unchanged. Set status + `updatedAt`, append `STATUS` history row (before → after, by = operator). |
| **fetchWhlReport** | `(orderId, lotId)` | Guard: needs `workOrderNo`. `revision = max(existing revisions) + 1` → calling it again fetches the **next revision**. On success: mark all existing reports `current: false`, push the new one as current, set `lot.reportNo`/`testedAt`, set `lot.testStatus = conclusionToLotStatus(...)`, roll the process matrix onto `lot.tests` (create missing rows; append a `REPORT` history row per process citing the report no), append a `REPORT_DELIVERED` inbound email to the thread, add a `WHL_REPORT` document to the order's document vault, clear `lastUpdateRequestAt`, flip any `AWAITING_RESPONSE` outbound mails on that lot to `UPDATE_RECEIVED`. Add reconciliation `parseFlags` when the report MPN ≠ lot MPN, or report client PO ≠ the PO on file. |
| **requestWhlUpdate** | `(orderId, lotId)` | Send the `STATUS_REQUEST` template (same source as the compose modal) and set `lot.lastUpdateRequestAt = today()` (starts the SLA clock). |
| **sendLabEmail** | `(orderId, { lotId?, subject, body })` | Unshift an OUT email with `status: "AWAITING_RESPONSE"`, `kind = subject.startsWith("Status request") ? "REQUEST_UPDATE" : "CUSTOM"`, then call the mail adapter. On failure mark that email `ESCALATED` with a retry note. |
| **syncWhlInbox** | `(orderId)` | Poll the lab mailbox for all lots that have a work order. For each message: route by `lotCode` then `workOrderNo`. Matched ⇒ apply its per-test interim statuses (**never downgrade a test already `PASSED`/`FAILED` by a report**), status `UPDATE_RECEIVED`/`REPORT_DELIVERED`, and flip that lot's awaiting outbound mails to `UPDATE_RECEIVED`. Unmatched ⇒ store with `lotId: undefined` + `matchNote` (“Subject line carries no work order, lot or report number — match it manually.”). Toast `"N update(s) applied · M need manual matching"`. |
| **matchLabEmail** | `(orderId, emailId, lotId)` | Attach the email to the lot (copy lotCode/mpn/workOrderNo/poNo), set `matchedBy`, clear `matchNote`, set status by kind, and append an `EMAIL` audit row on that MPN's spec. |
| **escalateLabEmail** | `(orderId, emailId)` | Set status `ESCALATED`. |
| **logReportAccess** | `(orderId, lotId, reportId, "VIEW" \| "DOWNLOAD")` | Unshift `{ at, by, action }` onto the report's `accessLog` (NDA requirement). |
| **reconcileReportPo** | `(orderId, lotId, reportId)` | Guard: a client PO must exist on the lot (or via the order's sourcing allocations) else error-toast. Set `report.clientPo` to it, drop the client-p/o `parseFlags`, append a `RECONCILE` audit row (before → after). |
| **notifyLotResult** | `(orderId, lotId, { party, to, subject, body, attachReport })` | Optimistically log a `LotNotification` (attachments = current report filename when ticked; `note` = the party's masking caveat + NDA line), call the notify adapter, then write an order event. `ESCROW` also appends a zero-amount `HOLD` escrow-ledger row citing lot + report + conclusion. `WHL` also appends the message to the lab thread. Failure ⇒ mark the notification `FAILED` with a retry note. |
| **notifyLotsResult** | `(orderId, lotIds[], { party, to, subject, body, attachReports })` | **One** mail for many lots. Attachments = de-duplicated current-report filenames. Write the notification row onto **every** lot it covered, each `note`d `"Sent as one digest covering N lot(s): A, B, C."`. One order event, one escrow marker, one thread entry — not N. Failure ⇒ mark all rows `FAILED`. |

Mapping helpers:

```ts
conclusionToLotStatus(conclusion, anyFar): TestStatus =
  conclusion === "ACCEPTABLE" ? (anyFar ? "MAYBE" : "PASS") : "FAIL";

processToTestStatus(result): TestProcessStatus =
  result === "ACCEPTABLE" ? "PASSED" :
  result === "NOT_ACCEPTABLE" ? "FAILED" :
  result === "FAR" ? "FAR" : "NOT_CONDUCTED";
```

---

## 7. Mock integration adapters

All adapters share a transport that (a) logs each call to a visible integration console as
pending → ok/error, (b) sleeps a random latency in a given range, (c) can inject failures from a global
"chaos" rate plus a per-call rate, (d) throws a typed error `{ code, message, status }`. Keep that seam —
swapping in `fetch` later must be a one-line change per adapter.

### 7.1 `extractPoTestRequirements({ sourceDoc, mpns[], testingModes })`
Latency 700–2000 ms · failure `UNPARSEABLE_FILE / "Could not parse the PO test table — needs manual review" / 422`.

Returns `{ sourceDoc, mpns: [{ mpn, tests: [{name, standard?}], confidence, note? }], overallConfidence }`.

Rules: mode `NONE` ⇒ empty + note `"PO specifies no incoming test for this MPN."`; **the second MPN of a
PO fails ~45% of the time** with note `"Test table on page 2 is a low-resolution scan — columns could not
be resolved."` (confidence ≈ 0.31) — this exercises the manual-review path; otherwise the mode's plan with
confidence 0.90–0.99.

### 7.2 `whlFetchReport({ workOrderNo, mpn, manufacturer, lotQty, client, clientPo?, revision, testNames[] })`
Latency 600–1800 ms · failure `REPORT_NOT_READY / "Report not yet issued for this work order" / 404`.

Builds a realistic report:
- `conclusion` weighted **ACCEPTABLE 72 / NOT_ACCEPTABLE 18 / SUSPECT_COUNTERFEIT 10**.
- one process row per requested test name (fall back to the first 5 `WHL_PROCESSES`); sample = `min(lotQty, 20)`.
- if conclusion is ACCEPTABLE: each process weighted **ACCEPTABLE 80 / FAR 12 / NOT_CONDUCTED 8**
  (so “Acceptable overall, one process F.A.R.” happens naturally).
- if not ACCEPTABLE: first process ACCEPTABLE, the rest weighted **NOT_ACCEPTABLE 55 / FAR 25 / ACCEPTABLE 20**.
- `rejectQty` = 15% of sample on NOT_ACCEPTABLE, 1 on FAR, 0 otherwise; `acceptQty = sample − rejectQty`;
  both `undefined` on NOT_CONDUCTED. FAR note: `"Further analysis recommended — anomaly on sampled unit."`
- `anyFar` = any process FAR. `reportNo = "<wo>.<revision>"`, `fileName = "WHL-<reportNo>.pdf"`.
- **`clientPo` returns the literal `"PO Unknown"` when absent or ~25% of the time**, adding parse flag
  `"Client P/O came back as “PO Unknown” — reconcile against the PO on file."`
- any NOT_CONDUCTED adds `"One or more processes were Not Conducted — confirm the agreed test plan was run in full."`
- fixed extras: `approvedBy "K. Ng" / "Laboratory Manager"`, `standards ["AS6081","AS6171"]`,
  `riskClass "ERAI Low Risk"`, `msl "MSL 3"`, `packageType "LQFP-100"`, the confidentiality note, and for
  `revision > 1`: `revisionNote = "Revision N — supersedes <wo>.<N-1> (electrical re-test on the flagged units)."`

### 7.3 `whlPollInbox({ workOrders: [{ workOrderNo, lotCode, mpn, testNames }] })`
Latency 500–1500 ms · no injected failure beyond chaos.

One message per work order, kind weighted **STATUS_UPDATE 45 / REPORT 25 / DELAY 15 / AMBIGUOUS 15**:
- `AMBIGUOUS`: subject `"RE: Testing update"`, **no** work order / lot / report keys → must land in the
  manual-match queue. Body: *"Hi, quick update on the parts you sent through — one of the lots needs another
  day on the electrical bench. Will revert with the report. Regards, WHL"*
- `REPORT`: subject `"WHL Report <wo>.1 — <mpn> (Lot <lot>)"`, attachment `"WHL-<wo>.1.pdf"`.
- `STATUS_UPDATE`: subject `"Interim status — WO <wo> / Lot <lot>"`, `testUpdates` = first 2 test names → `IN_PROGRESS`.
- `DELAY`: subject `"Delay notice — WO <wo> / Lot <lot>"`, `testUpdates` → `PENDING`, note
  `"Delayed — bench backlog at WHL"`.

### 7.4 `whlSendMail({ to, subject, body, workOrderNo?, lotCode?, mpn?, poNo? })`
Latency 300–900 ms · failure `MAIL_RELAY_DOWN / "Mail relay unavailable — retry" / 503`. Returns `{ messageId, to, queuedAt }`.

### 7.5 `sendPartyNotification({ party, to, subject, body, attachments[], orderNo, lotCode, reportNo? })`
Latency 350–1100 ms · same failure as above. Returns `{ messageId, to, queuedAt, attachments }`.

---

## 8. Template library (copy verbatim — this is product copy, not filler)

### 8.1 WHL compose templates (9)

Shared builders:

```
refLine(c) = the non-empty lines of:
  · MPN: {mpn}{ (date code {dateCode}) }
  · Lot: {lotCode}{ — qty {qty}{, sample {sampleQty}} }
  · Work order: {workOrderNo}
  · Report: {reportNo}
  · Client PO: {clientPoNo}
  · Lab site: {lab}

head(c) = "Hi WHL team,\n\nReference:\n" + refLine(c) + "\n\n"
sign(c) = "Thanks,\nSourcing Ops\n{entity}"
tag(c)  = "WO {workOrderNo|(pending)} / Lot {lotCode|—} / {mpn|—}"
```

| id | label · hint | subject | body |
|---|---|---|---|
| `STATUS_REQUEST` | Status request · *Where is this lot? (also used by “Request Update”)* | `Status request — {tag}` | `{head}Could you share the current status of the above lot — which processes are complete, which are in progress, and the expected date for the report?\n\nIf the report is already issued, please attach the latest revision.\n\n{sign}` |
| `REPORT_REQUEST` | Report / latest revision · *Ask for the PDF or the newest revision* | `Report request — {tag}` | `{head}Please send the test report for this lot as a PDF. If a revision has been issued since {reportNo}, share the current version and confirm which report number supersedes which.\n\n{sign}` |
| `RETEST_REQUEST` | Re-test request (result disputed) · *Supplier disputes a Not-Acceptable result* | `Re-test request — {tag}` | `{head}The supplier has disputed the result recorded in report {reportNo} for this lot.\n\nCould you re-test the affected units and issue a revised report? Please confirm:\n1. the units to be re-tested and the method used,\n2. the additional TAT, and\n3. whether any re-test cost applies.\n\n{sign}` |
| `FAR_FOLLOWUP` | F.A.R. follow-up · *A process came back Further Analysis Recommended* | `F.A.R. follow-up — {tag}` | `{head}Report {reportNo} is Acceptable overall, but a process is flagged F.A.R. (Further Analysis Recommended).\n\nBefore we release this lot, please confirm:\n1. which units and which process the F.A.R. applies to,\n2. what further analysis you recommend, with cost and TAT, and\n3. whether the lot can be accepted as-is with a documented caveat.\n\n{sign}` |
| `TAT_ESCALATION` | TAT escalation · *Past the quoted turnaround / unanswered chase* | `Escalation — TAT overdue — {tag}` | `{head}This lot is past the quoted turnaround and our earlier request is still unanswered. The order is held on this result.\n\nPlease confirm today: current stage, blocker, and a committed report date. If the lab site is the constraint, let us know whether the balance testing can be moved.\n\n{sign}` |
| `PO_RECONCILE` | Reference mismatch · *Report shows “PO Unknown” or the wrong reference* | `Reference correction — {tag}` | `{head}The report we received does not carry our reference correctly — it should read Client P/O {clientPoNo}.\n\nPlease re-issue with the correct Client P/O, MPN and lot code so the report reconciles against our PO on file.\n\n{sign}` |
| `SAMPLE_QUERY` | Sample / test-plan query · *Confirm sample size or a Not-Conducted process* | `Test plan query — {tag}` | `{head}Could you confirm the test plan applied to this lot — sample size drawn, standard followed, and the reason any process was recorded as Not Conducted?\n\nOur PO requires the full screen, so please advise if anything is outstanding.\n\n{sign}` |
| `NEW_SUBMISSION` | New submission / booking · *Tell WHL a lot is on its way* | `Incoming submission — {mpn} / Lot {lotCode}` | `{head}We are shipping the above lot to you for testing per our PO test plan.\n\nPlease confirm receipt, the work-order number raised against it, and the expected TAT.\n\n{sign}` |
| `FREE_TEXT` | Blank (free text) · *Context block only — write your own ask* | `{tag}` | `{head}\n\n{sign}` |

### 8.2 Party notification templates (single lot, 4)

Shared: `verdictWord` = `Acceptable` / `Acceptable (with one process flagged F.A.R.)` / `Not Acceptable` /
`Suspect Counterfeit` / `pending`. `lotRef(c)` = MPN line, Lot line, `· Test report: {reportNo} dated {reportDate}`,
`· Conclusion: {verdictWord}`.

| party | label · hint · default To | masking rule shown in the UI | subject | body |
|---|---|---|---|---|
| `SUPPLIER` | Notify supplier · *Result + report to the supplier (buyer stays masked)* · `quality@supplier.example` | “The buyer's identity, client PO and sell prices are never included.” | `Test result — {mpn} / Lot {lotCode} — {verdictWord} ({supplierPoNo})` | `Dear supplier,\n\nThe independent test on the lot supplied against {supplierPoNo} is complete.\n\n{lotRef}\n\n` + **if ACCEPTABLE** `The lot is accepted{, subject to closing out the process flagged for further analysis}. We are proceeding with onward logistics and payment per the agreed terms.` **else** `The lot is NOT accepted. Per the PO, the cost of test failure and return sits with the supplier. Please confirm within 2 business days whether you will (a) replace the lot with fully traceable stock, or (b) accept return and refund.` + `\n\nThe attached report is issued to us by White Horse Laboratories under NDA and is shared with you solely to evidence this lot's disposition — please do not redistribute it further.\n\nRegards,\nSourcing Ops\n{entity}` |
| `BUYER` | Notify buyer / client · *Result + report to the client (supplier stays masked)* · `procurement@client.example` | “The supplier's identity, buy prices and inbound AWB are never included.” | `{orderNo} — test result for {mpn} / Lot {lotCode} — {verdictWord}` | `Dear customer,\n\nIndependent testing on your order against {clientPoNo} is complete.\n\n{lotRef}\n· Laboratory: {lab}\n\n` + **if ACCEPTABLE** `The lot has passed the agreed screen{, with one process flagged for further analysis — we are closing that out with the laboratory before dispatch| and is cleared for dispatch}. We will confirm the delivery schedule shortly.` **else** `The lot did not pass the agreed screen and will not be dispatched to you. We are sourcing replacement stock and will confirm the revised schedule; your funds remain protected under the agreed payment terms.` + `\n\nThe laboratory report is attached for your records. It is issued under NDA — kindly keep it internal to your organisation.\n\nRegards,\nSourcing Ops\n{entity}` |
| `ESCROW` | Notify escrow provider · *Release-trigger evidence to HKIN* · `ops@hkin.example` | “Sent by the masking entity only — counterparties are referenced by escrow token.” | `Escrow {escrowRef} — release trigger evidence — Lot {lotCode} {verdictWord}` | `Dear HKIN team,\n\nRe escrow {escrowRef} for {orderNo}:\n\n{lotRef}\n\n` + **if ACCEPTABLE** `The release trigger (independent lab PASS) is satisfied for this lot.{ Note one process is flagged F.A.R.; we are proceeding on the overall Acceptable conclusion.} Please treat the attached report as the supporting evidence for the tranche release of up to {currency} {releasable}.` **else** `The lab result is {verdictWord} — the release trigger is NOT satisfied. Please hold the funds; a refund instruction may follow once the return is agreed with the seller.` + `\n\nRegards,\nSourcing Ops\n{entity}` |
| `WHL` | Acknowledge to WHL · *Confirm receipt of the report to the lab* · `{WHL_CONTACT}` | — | `Report received — {reportNo} / WO {workOrderNo} / Lot {lotCode}` | `Hi WHL team,\n\nThank you — report {reportNo} for the lot below is received and logged.\n\n{lotRef}\n\n{One process is flagged F.A.R. — we will revert separately on the further analysis.\n\n}Please retain the samples until we confirm disposition.\n\nThanks,\nSourcing Ops\n{entity}` |

Default `attachReport` = **true** for supplier/buyer/escrow, **false** for WHL (they wrote it).

### 8.3 Digest templates (many lots, 1 mail)

Per-lot line: `{i+1}. {mpn} (DC {dateCode}) · Lot {lotCode} · qty {qty} · report {reportNo} ({reportDate}) — {verdict}`
where verdict ∈ `Acceptable` / `Acceptable (one process F.A.R.)` / `Not Acceptable` / `Suspect Counterfeit` / `result pending`.

Outcome split block (only non-empty lines):
```
Accepted: {codes}.
Accepted subject to F.A.R. close-out: {codes}.
Not accepted: {codes}.
Result still pending: {codes}.
```

| party | subject | body shape |
|---|---|---|
| `SUPPLIER` | `Test results — {n} lot(s) against {supplierPoNo}{ — {k} not accepted}` | `Dear supplier,\n\nIndependent testing is complete on the following lot(s) supplied against {supplierPoNo}:\n\n{list}\n\n{split}\n\n` + (if any bad) `For the lots not accepted, the PO places the cost of test failure and return with the supplier. Please confirm within 2 business days whether you will replace with fully traceable stock, or accept return and refund.\n\n` + (if any good) `For the accepted lots we are proceeding with onward logistics and payment per the agreed terms.\n\n` + NDA line + sign |
| `BUYER` | `{orderNo} — test results for {n} lot(s) ({clientPoNo})` | `Dear customer,\n\nIndependent testing on your order against {clientPoNo} is complete for the following lot(s):\n\n{list}\n\n{split}\n\n` + (if any good) `The accepted lots are cleared for dispatch and we will confirm the delivery schedule shortly.\n\n` + (if any bad) `The lots not accepted will not be dispatched to you. We are sourcing replacement stock and will confirm the revised schedule; your funds remain protected under the agreed payment terms.\n\n` + `The laboratory report(s) are attached for your records. They are issued under NDA — kindly keep them internal to your organisation.\n\n` + sign |
| `ESCROW` | `Escrow {escrowRef} — release trigger evidence — {n} lot(s)` | `Dear HKIN team,\n\nRe escrow {escrowRef} for {orderNo}, the independent lab results for the following lot(s):\n\n{list}\n\n{split}\n\n` + (if any good) `The release trigger (independent lab PASS) is satisfied for {codes}. Please treat the attached report(s) as supporting evidence for the tranche release of up to {currency} {releasable}.\n\n` + (if any bad) `The trigger is NOT satisfied for {codes} — please hold those funds; a refund instruction may follow once the return is agreed with the seller.\n\n` + sign |
| `WHL` | `Reports received — {n} lot(s) / {orderNo}` | `Hi WHL team,\n\nThank you — the following reports are received and logged:\n\n{list}\n\n{We will revert separately on the further analysis for {codes}.\n\n}Please retain the samples until we confirm disposition.\n\nThanks,\nSourcing Ops\n{entity}` |

**NDA line** (supplier digest): *"The attached report(s) are issued to us by White Horse Laboratories under NDA and are shared solely to evidence these lots' disposition — please do not redistribute them further."*

---

## 9. UI specification

### 9.1 Shell — the order's Testing tab

```
┌ Panel: "WHL testing — MPN × lot × test" ──────────────────────────────────────────┐
│ actions: [lot scope ▾] [Sync WHL inbox] [Auto-fill tests from PO] [+ Add lot]      │
│                                                                                    │
│ scope banner   ─ "All lots" → "Order total across N lot(s) — pick a lot above…"    │
│                ─ lot chosen → pill "viewing LOT-B" · mpn · lab · WO · qty/sample   │
│                              · verdict pill · "report X — acceptable"              │
│                              · [show order total]                                  │
│ 6 stat tiles   ─ Lots|Lot · Tests tracked · Passed n/m · F.A.R. · Not acceptable   │
│                  · Reports on file            (all scoped by the selector)         │
│ progress bar   ─ passed / tests                                                    │
│ caption        ─ "n/m required tests passed across N lot(s). k still open. F.A.R.  │
│                   and Not-Conducted results still need follow-up before release."  │
│                                                                                    │
│ alerts (stacked, only when non-empty; all scoped except unmatched)                 │
│   • reconciliation  ⚠ "LOT-B · 352147.1 — Client P/O …" [Reconcile to PO on file]  │
│   • SLA overdue     ⏱ "LOT-C — update requested …, unanswered for N business       │
│                        day(s) (SLA 3)."  [Chase again] [Escalate]                  │
│   • autofill gaps   ⚠ "Auto-fill failed / incomplete for X, Y" [Review MPNs]       │
│   • unmatched mail  ✉ "N inbound WHL email(s) couldn't be matched" [Open queue]    │
│                                                                                    │
│ bulk bar   "Select lots: all (N) · with report (n) · acceptable (n) ·              │
│             not acceptable (n) · F.A.R. (n) · clear      N selected                │
│             [Next actions (N) ▾]"                                                  │
│                                                                                    │
│ lot-wise results table (always visible)                                            │
│   ☑ | Lot (+lab/WO) | MPN | Verdict | Tests n/m + bar | F.A.R. | Not acc. |        │
│     Current report (no + conclusion pill + "k rev.") | Outstanding (blocker,       │
│     "chase Nd overdue", "awaiting reply")                                          │
│   → clicking a row scopes to that lot (click again clears); the checkbox cell      │
│     stops propagation so ticking never changes scope                               │
│                                                                                    │
│ escrow strip (unchanged behaviour) — green "A lot PASSED — release the escrow      │
│   tranche" + [Extend window] [Release escrow]; footnote about PASS/FAIL + refund   │
└────────────────────────────────────────────────────────────────────────────────────┘

sub-tabs:  [MPNs & tests (gapBadge)] [Lots · status · reports] [WHL correspondence (unmatchedBadge)]
```

Default sub-tab: **Lots · status · reports**. Badges are small warn-coloured counts.

### 9.2 Sub-tab — MPNs & tests

Intro line: *"Test requirements are **parsed off the PO**, never typed — the PO already carries the test
table. Manual edits are allowed as an override and every one is logged (who · when · before → after)."*

One panel per order line (filtered to the scoped lot's MPN when a lot is selected):
- title: `MPN` (mono) · testing-mode pill · `make · qty N · k lot(s)`
- actions: state pill (`auto-filled` / `auto-fill failed` / `not parsed`) · `[🕘 auditCount]` toggle ·
  `[✎ Edit tests | Done]` (role-gated)
- `auto-fill failed` ⇒ red notice with the reason + `[Retry parse]`
- no spec at all (and mode ≠ NONE) ⇒ amber notice + `[Auto-fill now]`
- meta row: `source: <PO>` · `parsed: <ts>` · `confidence: n%` · `k auto · m manual`
- test list rows: name · standard pill · source pill (`from PO` / `manual`) · `addedBy · addedAt` for
  manual · trash icon in edit mode
- edit mode footer: process `<select>` (from `WHL_PROCESSES`) + standard `<select>` + `[+ Add]`,
  caption *"Adds to this MPN's list and to every lot of it. Logged as a manual override."*
- audit panel (toggle): newest-first rows — action pill (`ADD` warn / `DELETE` bad / else neutral),
  `target · before → after`, `by · at · note`
- empty states: mode NONE ⇒ *"This MPN needs no incoming test per the PO."*; else *"No tests on file for this MPN."*
- when the role can't edit: *"🔒 Editing tests needs the SC or Mgmt persona"*

### 9.3 Sub-tab — Lots · status · reports

One card per lot (only the scoped lot when filtered, with a note explaining the filter):

- **title**: flask icon · lot code · MPN (mono) · `lab · WO n · qty N / sample M · DC x`
- **actions**: verdict pill · `[⚡ Next actions ▾]` (disabled until a report exists) ·
  `[Fetch report | Fetch revision]` · `[Email WHL]`
- **status tracker** header: `Test status tracker  n/m passed · k F.A.R. · k not acceptable · k not conducted · k open`
- **tracker table**: `Test | Std | Source | Status | Accept / Reject | Updated | Set`
  - the test name is a disclosure toggle; expanded row shows **Status history** newest-first:
    `at · before → after (pills) · by · note · "from inbound email"`
  - `Set` is a `<select>` over `TEST_PROCESS_STATUSES` (role-gated), labels title-cased, `FAR` → `F.A.R.`
  - empty: *"No tests on this lot — the MPN's test list is empty or failed to auto-fill (see MPNs & tests)."*
- **report repository** (§9.4)
- **result circulated** block (only when a report exists): party pills
  `Supplier ✓ <ts> · report attached` / `Buyer · not notified` (ok / bad / neutral tones), then a
  line-per-notification log `at · party → to · subject · attachments`, failures in red with the reason.
  Caption: *"use **Next actions** above to send"*.
- **footer**: `Lot verdict [PASS][MAYBE][FAIL]` (unchanged lot logic) + *"drives the escrow release /
  refund path"*; right side: `awaiting WHL reply` chip, `n message(s)`, and context buttons —
  `[Request update]` when no report, `[F.A.R. follow-up]` when `anyFar`, `[Re-test request]` when FAIL,
  `[Escalate TAT]` when awaiting.

### 9.4 Report repository + parsed summary (per lot)

No reports ⇒ dashed block: **"WHL report — Not Available"**, *"Nothing received by email for WO n yet.
Update requested <date>."*, `[✉ Request Update]` (role-gated, tooltip names the lab address).

With reports ⇒ bordered block:
- header: `WHL report repository · k version(s)` + one button per version, newest first, current marked
  with a ✓; clicking selects **and logs a VIEW** access entry.
- summary body for the selected version:
  - top row: report no (mono) · `current` / `superseded` pill · conclusion pill (ok when ACCEPTABLE, else
    bad) · amber pill **"F.A.R. on a process — follow up"** when `anyFar`
  - right: `[🛡 accessCount]` toggle · `[👁 Open PDF]` · `[⬇ Download]` (both log access)
  - `revisionNote` in a muted box when present
  - parse flags as amber notices; a client-p/o flag gets `[Set to <PO on file>]`
  - field grid (2-col): Report no · date | Work order | Part number (MPN — **red when ≠ lot MPN**) |
    Manufacturer | Lot qty (+ *"(lot on file N)"* when different) | Client | Client P/O (**amber when
    “PO Unknown”**) | Approved by + title | Standards | Risk classification | MSL | Package type
  - **process-level results** table: `Process | Result (pill) | Acceptable qty | Not-acceptable qty | Note`
    with caption *"A report can be **Acceptable** overall while one process is **F.A.R.** — the matrix is
    the source of truth, not the headline conclusion."*
  - access log (toggle): `at · by · action`
  - NDA footer with a lock icon

### 9.5 Sub-tab — WHL correspondence

1. **Panel "Compose from a template — subject & body pre-filled"** — a chip per WHL template (tooltip =
   hint) opening the compose modal for that template; caption explains the auto-fill; role note when gated.
2. **Panel "WHL inbox — manual match queue"** — `[Sync inbox]` `[Compose]`; each unmatched mail in an
   amber card: subject, `by · at · attachments`, body, the match note, `[Match to lot]`. Empty: *"Nothing
   waiting — every inbound WHL email is matched to a lot."* Caption: *"Unroutable mail is held here rather
   than dropped or applied to the wrong lot. Matching it applies its updates to that lot's tracker."*
3. **Panel "Correspondence & tracking history"** — lot filter `<select>` (defaults to the header's scope,
   still overridable); chronological thread with a dot (primary = sent, ok = received), `sent`/`received`
   pill, status pill, timestamp, `lotCode · mpn · WO`, subject, body (pre-wrapped), then
   `by · attachments · matched by · [Mark escalated]` for awaiting outbound mail.

### 9.6 Menus and modals

**Per-lot "Next actions"** (disabled until a report exists; tooltip *"Available once a test report is
received"*). Header line: `LOT-A · 352146.2 · acceptable`. Items — label / sub-label / icon:

- **Notify supplier** — *Result + report; buyer stays masked* — factory icon
- **Notify buyer / client** — *Result + report; supplier stays masked* — users icon
- **Notify escrow provider** — *Release-trigger evidence to HKIN (`<ref>`)*, or *No escrow on this order* — bank icon
- **Acknowledge to WHL** — *Confirm the report is received and logged* — flask icon
- *— separator —*
- **Arrange logistics for this lot** — *Opens Logistics with a shipment pre-filled for this lot* — truck icon

Already-sent items show a ✓ and *"already sent <timestamp>"* instead of the sub-label. All notify items
are role-gated.

**Bulk "Next actions (N)"** — same five items, disabled when nothing is ticked. Header line:
`N lot(s) · k with a report · (m listed as pending)`. Sub-labels state the batching: *"One digest covering
N lot(s)"*, or for the buyer with several client POs *"Split into k mails — one per client PO"*.
"Acknowledge to WHL" is disabled when no selected lot has a report.

**Compose WHL email modal** — template `<select>` (hint under it) + lot `<select>`; changing either
re-fills; `To` is fixed to the lab, `Subject` + `Message` (tall mono textarea) pre-filled and editable;
*"Reset to the “X” template"* link appears once edited; footer `[Open in mail client]` (mailto) +
`[Send & log]`.

**Notify (single lot) modal** — context strip (lot · MPN · qty · report + conclusion + F.A.R.), amber
masking rule banner, `To` / `Subject` / `Message` pre-filled + editable, checkbox *"Attach the test report
<file>"* with caption *"WHL reports are issued under NDA — attaching one records the disclosure on the
lot's notification log."*, reset link, `[Send notification]`.

**Bulk notify modal** — title `<label> — N lot(s)`; note *"One digest instead of N separate mails."*
(+ *"Split into k mails — one per client PO, so no client sees another's lots"*); masking banner; amber
warning listing lots without a report ("listed as ‘result pending’"); group chips when split; a scrollable
**"Lots in this mail (k)"** list (lot · MPN · qty · report + conclusion, or "no report yet"); per-group
`To`/`Subject`/`Message` editable; checkbox *"Attach all available reports (k PDFs)"* with caption *"Each
disclosure is logged on every lot the digest covered."*; footer `[Send k mails]`.

**Match-email modal** — the mail in a bordered preview, the match note, a lot `<select>` with hint *"the
mail's updates get applied to this lot's tracker"*, `[Match]`.

### 9.7 Logistics hand-off (separate screen)

Deep link: `/<logistics-route>?order=<orderId>&lot=<lotId>` (single) or `&lots=a,b,c` (bulk).

The logistics screen, when the link is present, shows a panel above its usual board:
- title `Create logistics for a tested lot` / `… for N tested lots`
- summary row: order link · `lots N` · `to move Q across k MPN(s)` · `from <origins joined>`
- table: `Lot | MPN | Qty | Verdict | Report | Currently at`
- caption listing the merge: *"Lots of the same MPN are merged into one shipment line: MPN ×Q (capped from
  W — rest already shipped) · … . Destination is the 1Buy hub for relabelling."*
- warnings: multiple origins (*"one AWB can only collect from one origin"*), failed lots (*"book the return
  leg to the supplier"*), lots with no report (*"moving them now pre-empts the result"*)
- actions `[Dismiss]` (clears the query string) and `[Create shipment | Fully shipped]`
- it **auto-opens** the host's create-shipment modal, pre-filled: lines = per-MPN summed qty **capped by
  what is still unshipped on the inbound leg**, origin = the lab holding the goods, destination = the hub,
  leg = inbound. The modal shows a primary-tinted strip: *"Pre-filled from N tested lots LOT-A, LOT-B ·
  MPN ×Q · origin <lab> (where the goods currently sit)"*.

If the host route is statically pre-rendered, wrap the search-param reader in a Suspense boundary.

---

## 10. Invariants — the rules that make this correct

1. **Never blank on a parse failure.** A failed auto-fill is an explicit flagged state with a reason and a
   retry, never an empty list that looks intentional.
2. **Never drop or misapply inbound mail.** Anything unroutable goes to the manual-match queue.
3. **Tests are never hand-typed as the primary path.** Manual entry exists only as an audited override, and
   auto vs. manual stays visually distinguishable forever (`from PO` / `manual` pills + `addedBy`).
4. **History, not just state.** Every status change (automated or manual) appends a row; the current value
   is never the only record. Automated rows name the automation and link the source email.
5. **The process matrix is the source of truth, not the headline conclusion.** F.A.R. and Not-Conducted are
   never counted as done, and a lot with `anyFar` maps to `MAYBE`, not `PASS`.
6. **All report versions are kept.** Exactly one `current`; superseded versions stay openable and labelled.
7. **Same MPN, different POs, different test lists.** Specs are keyed by order + MPN.
8. **Masking is absolute.** Supplier mail never contains buyer identity / client PO / sell price; buyer mail
   never contains supplier identity / buy price / inbound AWB. A buyer digest spanning several client POs is
   **split into one mail per client PO**.
9. **NDA on reports.** Every view/download is access-logged; every attachment records the disclosure on the
   lot; the confidentiality note is always visible.
10. **A digest is logged on every lot it covered** — one mail, N truthful lot trails, one order event, one
    escrow marker.
11. **Lot logic is untouched.** Lot creation/numbering/association and `lot.testStatus` → escrow behaviour
    stay exactly as the host already has them; this module only adds fields and reads.
12. **Reconciliation is automatic, resolution is explicit.** Mismatches surface themselves; a human clicks to
    reconcile, and that click is audited.
13. **Logistics quantities are capped by reality.** Never offer to ship more than is unshipped; say when a
    quantity was capped rather than silently reducing it.
14. **Role gating lives in one place** (a `useRole()`-style hook), not sprinkled through components.
15. **Nothing silently truncates.** Counts, caps, exclusions and pending lots are always stated on screen.

---

## 11. Host-adaptation matrix

| Seam | Reference implementation | What to do in the target repo |
|---|---|---|
| State | Zustand + immer + `persist` (localStorage), actions on one store | Use whatever the host uses (Redux slice, Pinia, MobX, React Query + reducer, service class). Keep the action names/semantics from §6. |
| Schema drift | a `normalizeBundle()` that defaults every new array | Mirror it: `tests`, `reports`, `notifications`, `mpnTests`, `labEmails` must default to `[]`. |
| Persisted seed | store `version` bump + `migrate` returning `undefined` for older versions | Do the equivalent so stale local state can't hide the new demo data. |
| Routing | Next.js App Router, `useRouter().push` + `useSearchParams` | Any router; keep the `?order=&lot=` / `?order=&lots=` contract. |
| UI kit | local primitives: `Panel`, `Pill`, `StatusPill`, `Button`, `Progress`, `Field`, `DataTable`, `Dialog`, `Labeled`, `Input`, `Select`, `Textarea` | Map onto the host's equivalents; do not introduce a second design language. |
| Toasts | `sonner` | Host's notification system; keep the messages. |
| Permissions | `useRole()` reading a persisted persona + a change event | Host's auth/permission source; keep `canEditTests` / `canEmailLab`. |
| Mock transport | `mockCall(system, label, endpoint, req, produce, opts)` writing to an integration console | Host's mock/fixture layer; preserve latency + failure injection + visible logging. |
| Money/qty format | `money()`, `qtyfmt()` | Host's formatters. |

---

## 12. Reference file inventory

| File | Role | ~size |
|---|---|---|
| `src/types/index.ts` | all interfaces from §3 | +190 lines added |
| `src/data/enums.ts` | reference data §4, tone map §3, templates §8, role gates | +330 |
| `src/lib/role.ts` | `useRole()` + `setActiveRole()` via an external-store subscription | 45 |
| `src/integrations/lab-whl.ts` | §7.2–7.4 + `conclusionToLotStatus` / `processToTestStatus` | 200 |
| `src/integrations/doc-extract.ts` | §7.1 | +55 |
| `src/integrations/notify.ts` | §7.5 | 35 |
| `src/store/store.ts` | actions §6 | +420 |
| `src/store/selectors.ts` | derived state §5 | +120 |
| `src/components/order/testing-tab.tsx` | the whole screen §9.1–9.5 + both menus | 780 |
| `src/components/order/modals.tsx` | compose / notify / bulk-notify / match / shipment-prefill | +340 |
| `src/app/fulfilment/logistics/page.tsx` | §9.7 hand-off | +90 |
| `src/data/fixtures.ts`, `src/data/order-details.ts` | demo seed §13 | +700 |

---

## 13. Demo seed (so every state is visible without clicking)

Seed **one order** with three lots that between them exercise everything:

| Lot | MPN | State | Demonstrates |
|---|---|---|---|
| **LOT-A** | MCU, qty 300, sample 20, WO `352146` | `PASS`, two reports: `352146.1` Not Acceptable (electrical 18/2, die analysis Not Conducted) superseded by **`352146.2` Acceptable** (all six processes acceptable, revision note) | revision history · superseded vs current · a settled lot · full test history including a FAILED → IN_PROGRESS → PASSED progression |
| **LOT-B** | power IC, qty 150, sample 20, WO `352147` | `MAYBE`, report `352147.1` **Acceptable with X-Ray F.A.R.** (19/1) and `clientPo: "PO Unknown"` | the Acceptable-but-F.A.R. nuance · reconciliation alert + one-click fix · blocker text "F.A.R. — needs follow-up" |
| **LOT-C** | same MPN as B, qty 100, sample 15, WO `352151` | `PENDING`, **no report**, `lastUpdateRequestAt` ≈ 4 business days ago, tests `IN_PROGRESS`/`PENDING` | "Not Available" + Request Update · SLA-overdue banner with Chase/Escalate · an open lot in the roll-up |

Also seed:
- **MPN specs**: MCU = auto-filled OK (5 from the PO + 1 manual `Decapsulation & Die Analysis` with a real
  reason) · power IC = **`autofill: "FAILED"`** ("low-resolution scan") with 4 manually-added tests and an
  audit trail that includes a `DELETE` ("Added in error — not on this PO")
- **7 lab emails**: one **unmatched** (`"RE: Testing update"`), a request/reply pair, two report deliveries,
  a re-test request, an interim update
- **Notifications**: LOT-A already circulated to supplier + buyer + escrow (report attached, masking notes);
  LOT-B and LOT-C deliberately **not** notified so the flow has something to do
- **Shipment headroom**: the inbound AWB must cover *only* the passed lot, so "Arrange logistics" has real
  quantity to book (otherwise every prefill is ×0 and looks broken)

Extra orders worth seeding to show the range: a **Suspect Counterfeit** order (visual/X-ray/die all
non-conforming, electrical Not Conducted, quality-hold approval, dispute thread), a **supplier self-test**
order (CoC instead of a WHL report, F.A.R. on visual), a **Not Acceptable + escrow hold** order (chase past
SLA, unmatched mail, X-Ray Not Conducted because the bench was down), a **closed** order (all passed, escrow
released, notifications to all four parties), and a **no-testing** order (`"PO specifies no incoming test"`).

---

## 14. Acceptance checklist

Data & auto-fill
- [ ] Auto-fill from PO populates per-MPN test lists; re-running keeps manual additions.
- [ ] A failed parse shows "Auto-fill failed — needs manual review" + reason + Retry; never an empty list.
- [ ] Manual add/delete is logged with who · when · before → after, and stays distinguishable (`from PO` / `manual`).
- [ ] The same MPN on a different order/PO can carry a different test list.

Tracker
- [ ] Every lot shows every required test with status, accept/reject qty and last-updated.
- [ ] Expanding a test shows the full timestamped progression, naming the automation and source email.
- [ ] `Sync WHL inbox` applies interim statuses; a report never gets downgraded by a later interim note.
- [ ] Unroutable inbound mail lands in the manual-match queue; matching applies its updates.

Reports
- [ ] Fetching twice produces `.1` and `.2`; both stay openable; exactly one is current.
- [ ] The parsed summary shows every §9.4 field plus the full process matrix — no PDF needed.
- [ ] An Acceptable report with one F.A.R. process is flagged, sets the lot to MAYBE, and blocks "clear".
- [ ] `PO Unknown` / MPN mismatch raise reconciliation alerts; the fix is one click and audited.
- [ ] Views and downloads are access-logged; the NDA note is visible.

Roll-up & filter
- [ ] The lot selector scopes tiles, progress, alerts and all three sub-tabs; "All lots" restores the total.
- [ ] The lot-wise table shows verdict, tests n/m, F.A.R., not-acceptable, current report and the blocker.
- [ ] Clicking a row scopes; clicking again clears; ticking a checkbox never changes scope.

Actions
- [ ] "Next actions" is disabled until a report exists, and shows ✓ + timestamp for parties already told.
- [ ] Supplier / buyer mails are masked from each other; the modal states the rule.
- [ ] Escrow notification also writes an escrow-ledger marker; the WHL one also joins the lab thread.
- [ ] Bulk: quick filters select by report/verdict/F.A.R.; one digest lists every lot with its verdict and
      splits the disposition by outcome; buyer digests split per client PO.
- [ ] A digest writes a notification row on every lot it covered, but only one order event.
- [ ] Logistics deep links (single + bulk) pre-fill a shipment with merged, capped quantities and warn about
      mixed origins, failed lots and missing reports.

Non-functional
- [ ] Edit-tests and all mail actions are role-gated with a visible reason when denied.
- [ ] Every adapter call appears in the integration console; injected failures surface as retryable errors.
- [ ] Typecheck, lint and production build are clean; the screen renders for an order with 0 lots, 1 lot and
      many lots without layout breakage.
